import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { SqliteIntentRepository } from "../../infra/persistence/SqliteIntentRepository";
import { SqliteAuditLog } from "../../infra/audit/SqliteAuditLog";
import { SqliteConversationLog } from "../../infra/audit/SqliteConversationLog";
import { StubCandidateSubmissionAdapter } from "../../infra/submission/StubCandidateSubmissionAdapter";
import { CandidateMapper } from "../../core/application/services/CandidateMapper";
import { StartIntentUseCase } from "../../core/application/use-cases/StartIntent";
import { ApplyAnswersUseCase } from "../../core/application/use-cases/ApplyAnswers";
import { AdvanceDialogUseCase } from "../../core/application/use-cases/AdvanceDialog";
import { SubmitIntentUseCase } from "../../core/application/use-cases/SubmitIntent";
import { SubmitRectificationUseCase } from "../../core/application/use-cases/SubmitRectification";
import { GetIntentUseCase } from "../../core/application/use-cases/GetIntent";
import { IntentStatus } from "../../core/domain/enums/IntentStatus";
import { IntentNotEditableError } from "../../core/domain/errors/IntentNotEditableError";
import type { Clock } from "../../core/application/ports/Clock";
import type { IdGenerator } from "../../core/application/ports/IdGenerator";
import { PARTY, partyDirectory } from "../fixtures/parties";

/**
 * REQ-801, REQ-501 and REQ-804 against a real file. A restart is what a restart actually is here: the
 * handles are closed and new ones opened on the same path, with nothing carried over in memory.
 */
const clock: Clock = { now: () => "2026-11-03T12:00:00.000Z" };
const PAYROLL = [
  { key: "payee", value: PARTY.ACME },
  { key: "amount", value: "1500.00" },
  { key: "currency", value: "BRL" },
  { key: "occurredAt", value: "2026-11-03" },
];

let dir: string;
let file: string;
let openHandles: { close(): void }[] = [];

function boot() {
  const directory = partyDirectory();
  const repo = new SqliteIntentRepository(file);
  const audit = new SqliteAuditLog(file);
  const log = new SqliteConversationLog(file);
  openHandles.push(repo, audit, log);
  let n = 0;
  const ids: IdGenerator = { next: () => `id-${Date.now()}-${++n}` };
  const start = new StartIntentUseCase(repo, clock, ids, log);
  const apply = new ApplyAnswersUseCase(repo, clock, log, directory);
  const submit = new SubmitIntentUseCase(
    repo,
    new CandidateMapper(PARTY.USINA),
    new StubCandidateSubmissionAdapter(),
    audit,
    clock,
    directory,
  );
  return {
    repo,
    audit,
    log,
    start,
    apply,
    submit,
    advance: new AdvanceDialogUseCase(repo, clock, log, directory),
    get: new GetIntentUseCase(repo, audit, log),
    rectification: (ledgerEvents: ConstructorParameters<typeof SubmitRectificationUseCase>[0]) =>
      new SubmitRectificationUseCase(ledgerEvents, start, apply, submit, clock, PARTY.USINA),
  };
}

function shutdown() {
  for (const handle of openHandles) handle.close();
  openHandles = [];
}

/** Straight at the file, with no port in the way: the promises have to hold there too. */
function raw() {
  const db = new Database(file);
  openHandles.push(db);
  return db;
}

async function acceptedPayroll(world: ReturnType<typeof boot>) {
  const { intentId } = await world.start.execute({ scenarioId: "register_payroll", userId: "cfo" });
  await world.apply.execute({ intentId, answers: PAYROLL });
  const { ledgerReference } = await world.submit.execute(intentId, "cfo");
  return { intentId, ledgerReference: ledgerReference! };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "treasury-operations-"));
  file = join(dir, "treasury.db");
});

afterEach(() => {
  shutdown();
  rmSync(dir, { recursive: true, force: true });
});

describe("CA-804 — a auditoria cobre só o que vai ao Ledger", () => {
  it("responder três campos e desistir: nada é auditado, e os passos ficam no log da conversa", async () => {
    const world = boot();
    const { intentId } = await world.start.execute({ scenarioId: "register_payroll", userId: "cfo" });

    await world.advance.execute({ intentId, key: "payee", value: PARTY.ACME });
    await world.advance.execute({ intentId, key: "amount", value: "abc" });
    await world.advance.execute({ intentId, key: "amount", value: "1500.00" });
    await world.advance.execute({ intentId, key: "currency", value: "BRL" });

    expect(await world.audit.listByIntent(intentId)).toEqual([]);
    expect((await world.log.listByIntent(intentId)).map((e) => e.type)).toContain("slot.rejected");
  });

  it("corrigir na prévia não é auditado (§12)", async () => {
    const world = boot();
    const { intentId } = await world.start.execute({ scenarioId: "register_payroll", userId: "cfo" });
    await world.apply.execute({ intentId, answers: PAYROLL });

    await world.apply.execute({ intentId, mode: "edit", answers: [{ key: "amount", value: "1550.00" }] });

    expect(await world.audit.listByIntent(intentId)).toEqual([]);
  });

  it("enviar é auditado: o envio e a resposta do Ledger, e só eles", async () => {
    const world = boot();
    const { intentId } = await acceptedPayroll(world);

    expect((await world.audit.listByIntent(intentId)).map((e) => e.type)).toEqual([
      "intent.submitted",
      "intent.accepted",
    ]);
  });

  it("a retificação é auditada nos dois passos, com autor (§12)", async () => {
    const world = boot();

    const result = await world
      .rectification({
        event: async () => ({
          eventId: "evt-400",
          eventType: "advance_payment",
          economicEffect: "cash_out",
          amount: "400.00",
          currency: "BRL",
          occurredAt: "2026-10-20T00:00:00.000Z",
          description: null,
          relatedEventId: null,
          objects: [{ objectId: "intent:adv", objectType: "advance", relation: "originates" }],
          parties: [{ partyId: PARTY.BROKER, role: "beneficiary", direction: "neutral", amount: "400.00" }],
        }) as never,
      })
      .execute({ targetEventId: "evt-400", userId: "cfo", corrected: { amount: "450.00" } });

    for (const step of [result.retraction!, result.reissue!]) {
      const entries = await world.audit.listByIntent(step.intentId);
      expect(entries.map((e) => [e.type, e.actor.id])).toEqual([
        ["intent.submitted", "cfo"],
        ["intent.accepted", "cfo"],
      ]);
    }
  });
});

describe("o histórico da tela", () => {
  it("mostra os passos e a auditoria juntos, na ordem", async () => {
    const world = boot();
    const { intentId } = await acceptedPayroll(world);

    const types = (await world.get.execute(intentId)).history.map((e) => e.type);

    expect(types[0]).toBe("intent.started");
    expect(types).toContain("slot.answered");
    expect(types.slice(-2)).toEqual(["intent.submitted", "intent.accepted"]);
  });
});

describe("depois de reiniciar", () => {
  it("REQ-501: a intenção continua aceita, com a referência do fato", async () => {
    const before = boot();
    const { intentId, ledgerReference } = await acceptedPayroll(before);
    shutdown();

    const intent = (await boot().repo.findById(intentId))!;

    expect(intent.status).toBe(IntentStatus.ACCEPTED);
    expect(intent.ledgerReference).toBe(ledgerReference);
    expect(intent.answers.amount).toBe("1500.00");
  });

  it("REQ-801: a auditoria continua lá, com quem, quando e o quê", async () => {
    const before = boot();
    const { intentId } = await acceptedPayroll(before);
    const written = await before.audit.listByIntent(intentId);
    shutdown();

    const read = await boot().audit.listByIntent(intentId);

    expect(read).toEqual(written);
    expect(read[0]).toMatchObject({
      actor: { kind: "user", id: "cfo" },
      at: clock.now(),
      type: "intent.submitted",
    });
  });

  it("o histórico da tela continua completo", async () => {
    const before = boot();
    const { intentId } = await acceptedPayroll(before);
    const written = (await before.get.execute(intentId)).history;
    shutdown();

    expect((await boot().get.execute(intentId)).history).toEqual(written);
  });

  it("uma conversa em andamento continua de onde parou", async () => {
    const before = boot();
    const { intentId } = await before.start.execute({ scenarioId: "register_payroll", userId: "cfo" });
    await before.apply.execute({ intentId, answers: PAYROLL.slice(0, 2) });
    shutdown();

    const after = boot();
    const { state } = await after.apply.execute({ intentId, answers: PAYROLL.slice(2) });

    expect(state.kind).toBe("ready");
    expect((await after.repo.findById(intentId))?.status).toBe(IntentStatus.AWAITING_CONFIRMATION);
  });

  it("§11.1: a intenção aceita continua sem aceitar edição", async () => {
    const before = boot();
    const { intentId } = await acceptedPayroll(before);
    shutdown();

    await expect(
      boot().apply.execute({ intentId, mode: "edit", answers: [{ key: "amount", value: "9.00" }] }),
    ).rejects.toBeInstanceOf(IntentNotEditableError);
  });

  it("a lista do usuário mantém a ordem, e salvar de novo não duplica", async () => {
    const before = boot();
    const first = await before.start.execute({ scenarioId: "register_payroll", userId: "cfo" });
    const second = await before.start.execute({ scenarioId: "register_tax", userId: "cfo" });
    await before.start.execute({ scenarioId: "register_tax", userId: "outra" });
    await before.apply.execute({ intentId: first.intentId, answers: PAYROLL.slice(0, 1) });
    shutdown();

    const listed = await boot().repo.listByUser("cfo");

    expect(listed.map((i) => i.id)).toEqual([first.intentId, second.intentId]);
  });
});

describe("REJ-801 — o registro de auditoria nunca é apagado", () => {
  it.each([
    ["apagar", "DELETE FROM audit_log"],
    ["reescrever", "UPDATE audit_log SET actor_id = 'outra pessoa'"],
  ])("%s direto no banco é recusado", async (_label, statement) => {
    const world = boot();
    const { intentId } = await acceptedPayroll(world);
    const written = await world.audit.listByIntent(intentId);

    expect(() => raw().exec(statement)).toThrow(/append-only/);

    expect(await world.audit.listByIntent(intentId)).toEqual(written);
  });

  it("REJ-802: o banco também recusa um registro sem autor", () => {
    boot();

    expect(() =>
      raw()
        .prepare(
          `INSERT INTO audit_log (id, intent_id, at, type, actor_kind, actor_id)
           VALUES ('x', 'i', 'now', 'intent.submitted', 'user', '  ')`,
        )
        .run(),
    ).toThrow(/CHECK/);
  });

  it("REJ-802: a gravação recusa antes de chegar ao banco", async () => {
    const { audit } = boot();

    await expect(
      audit.record({ intentId: "i", at: clock.now(), type: "intent.submitted" } as never),
    ).rejects.toThrow(/author/i);
  });

  it("os guardas sobrevivem a reabrir o banco", async () => {
    const before = boot();
    await acceptedPayroll(before);
    shutdown();
    boot();

    expect(() => raw().exec("DELETE FROM audit_log")).toThrow(/append-only/);
  });
});

describe("o cadastro e as operações podem dividir o arquivo", () => {
  it("as tabelas convivem, para um único backup cobrir tudo", async () => {
    await acceptedPayroll(boot());

    const tables = (raw().prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[])
      .map((t) => t.name);

    expect(tables).toEqual(expect.arrayContaining(["intents", "audit_log", "conversation_log"]));
  });
});
