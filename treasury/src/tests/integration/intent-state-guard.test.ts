import { describe, it, expect } from "vitest";
import { InMemoryIntentRepository } from "../../infra/persistence/InMemoryIntentRepository";
import { InMemoryConversationLog } from "../../infra/audit/InMemoryConversationLog";
import { StubSlotExtractionAdapter } from "../../infra/nlp/StubSlotExtractionAdapter";
import { StubCandidateSubmissionAdapter } from "../../infra/submission/StubCandidateSubmissionAdapter";
import { ApplyAnswersUseCase } from "../../core/application/use-cases/ApplyAnswers";
import { AdvanceDialogUseCase } from "../../core/application/use-cases/AdvanceDialog";
import { DecideIdentityUseCase } from "../../core/application/use-cases/DecideIdentity";
import { InterpretUtteranceUseCase } from "../../core/application/use-cases/InterpretUtterance";
import { SubmitIntentUseCase } from "../../core/application/use-cases/SubmitIntent";
import { CandidateMapper } from "../../core/application/services/CandidateMapper";
import { IdentityDecisionKind } from "../../core/domain/value-objects/IdentityDecision";
import { Intent } from "../../core/domain/entities/Intent";
import { IntentStatus } from "../../core/domain/enums/IntentStatus";
import { IntentNotEditableError } from "../../core/domain/errors/IntentNotEditableError";
import type { Clock } from "../../core/application/ports/Clock";
import type { IdGenerator } from "../../core/application/ports/IdGenerator";
import { PARTY, seededDirectory } from "../fixtures/parties";

/**
 * §11.1, as a table: every state against every door an edit can come through.
 *
 * Before this guard an edit on an accepted intent went through, reopened it, and a resubmission then
 * left it REJECTED — while the fact it had already recorded stood in the Ledger.
 */
const clock: Clock = { now: () => "2026-11-03T12:00:00.000Z" };
const ANSWERS = { payee: PARTY.ACME, amount: "1500.00", currency: "BRL", occurredAt: "2026-11-03" };

async function wire(status: IntentStatus) {
  const { directory, repo: parties } = seededDirectory();
  const repo = new InMemoryIntentRepository();
  const log = new InMemoryConversationLog();
  let n = 0;
  const ids: IdGenerator = { next: () => `id-${++n}` };
  const apply = new ApplyAnswersUseCase(repo, clock, log, directory);
  const advance = new AdvanceDialogUseCase(repo, clock, log, directory);
  const interpret = new InterpretUtteranceUseCase(repo, new StubSlotExtractionAdapter(), apply, log, clock, ids, directory);
  const decide = new DecideIdentityUseCase(repo, parties, clock, ids, log);

  await repo.save(
    Intent.rehydrate({
      id: "i1",
      scenarioId: "register_payroll",
      userId: "cfo",
      status,
      answers: { ...ANSWERS },
      createdAt: clock.now(),
      updatedAt: clock.now(),
      ...(status === IntentStatus.ACCEPTED ? { ledgerReference: "evt-1" } : {}),
    }),
  );

  const doors: Record<string, () => Promise<unknown>> = {
    "/answer": () => advance.execute({ intentId: "i1", key: "amount", value: "9999.00" }),
    "/apply": () =>
      apply.execute({ intentId: "i1", mode: "edit", answers: [{ key: "amount", value: "9999.00" }] }),
    "/interpret": () => interpret.execute({ intentId: "i1", utterance: "9999.00" }),
    "/identity": () =>
      decide.execute({
        intentId: "i1",
        slot: "payee",
        kind: IdentityDecisionKind.CREATE,
        mention: "Parte Nova",
        userId: "cfo",
      }),
  };
  return { repo, log, parties, doors };
}

const DOORS = ["/answer", "/apply", "/interpret", "/identity"];
const CLOSED = [IntentStatus.SUBMITTED, IntentStatus.ACCEPTED, IntentStatus.REJECTED];
const cases = CLOSED.flatMap((status) => DOORS.map((door) => [status, door] as const));

describe("§11.1 — enviada, aceita e recusada não aceitam edição", () => {
  it.each(cases)("%s por %s é recusada, sem deixar rastro", async (status, door) => {
    const { repo, log, parties, doors } = await wire(status);
    const partiesBefore = (await parties.findAll()).length;

    await expect(doors[door]()).rejects.toBeInstanceOf(IntentNotEditableError);

    const intent = (await repo.findById("i1"))!;
    expect(intent.status).toBe(status);
    expect(intent.answers).toEqual(ANSWERS);
    expect(await log.listByIntent("i1")).toEqual([]);
    expect((await parties.findAll()).length).toBe(partiesBefore);
  });

  it("a própria entidade recusa, para nenhum caminho novo poder contornar", () => {
    const intent = Intent.rehydrate({
      id: "i1",
      scenarioId: "register_payroll",
      userId: "cfo",
      status: IntentStatus.ACCEPTED,
      answers: {},
      createdAt: clock.now(),
      updatedAt: clock.now(),
    });

    expect(() => intent.record("amount", "1.00", clock.now())).toThrow(IntentNotEditableError);
  });

  it("uma leitura vazia de uma intenção encerrada continua respondendo", async () => {
    const { repo, log, parties } = await wire(IntentStatus.ACCEPTED);
    void parties;
    const apply = new ApplyAnswersUseCase(repo, clock, log, seededDirectory().directory);

    await expect(apply.execute({ intentId: "i1", answers: [] })).resolves.toMatchObject({ rejected: [] });
  });
});

describe("§11.1 — o que continua editável", () => {
  it.each([
    IntentStatus.GATHERING,
    IntentStatus.AWAITING_CONFIRMATION,
    IntentStatus.AWAITING_CORRECTION,
  ])("%s aceita a edição e volta a pronta para envio", async (status) => {
    const { repo, doors } = await wire(status);

    await doors["/apply"]();

    const intent = (await repo.findById("i1"))!;
    expect(intent.answers.amount).toBe("9999.00");
    expect(intent.status).toBe(IntentStatus.AWAITING_CONFIRMATION);
  });
});

describe("o caso que motivou a guarda", () => {
  it("uma intenção aceita continua aceita, com a referência do fato, depois de uma tentativa de edição", async () => {
    const { directory } = seededDirectory();
    const repo = new InMemoryIntentRepository();
    const log = new InMemoryConversationLog();
    const apply = new ApplyAnswersUseCase(repo, clock, log, directory);
    const submit = new SubmitIntentUseCase(
      repo,
      new CandidateMapper(PARTY.USINA),
      new StubCandidateSubmissionAdapter(),
      log,
      clock,
      directory,
    );
    await repo.save(
      Intent.rehydrate({
        id: "i2",
        scenarioId: "register_payroll",
        userId: "cfo",
        status: IntentStatus.AWAITING_CONFIRMATION,
        answers: { ...ANSWERS },
        createdAt: clock.now(),
        updatedAt: clock.now(),
      }),
    );
    const { ledgerReference } = await submit.execute("i2");

    await expect(
      apply.execute({ intentId: "i2", mode: "edit", answers: [{ key: "amount", value: "9999.00" }] }),
    ).rejects.toBeInstanceOf(IntentNotEditableError);
    await expect(submit.execute("i2")).rejects.toThrow(/not ready/i);

    const intent = (await repo.findById("i2"))!;
    expect(intent.status).toBe(IntentStatus.ACCEPTED);
    expect(intent.ledgerReference).toBe(ledgerReference);
    expect(intent.answers.amount).toBe("1500.00");
  });
});
