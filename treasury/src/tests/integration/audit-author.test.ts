import { describe, it, expect } from "vitest";
import { InMemoryIntentRepository } from "../../infra/persistence/InMemoryIntentRepository";
import { InMemoryAuditLog } from "../../infra/audit/InMemoryAuditLog";
import { StubCandidateSubmissionAdapter } from "../../infra/submission/StubCandidateSubmissionAdapter";
import { StartIntentUseCase } from "../../core/application/use-cases/StartIntent";
import { ApplyAnswersUseCase } from "../../core/application/use-cases/ApplyAnswers";
import { SubmitIntentUseCase } from "../../core/application/use-cases/SubmitIntent";
import { CandidateMapper } from "../../core/application/services/CandidateMapper";
import type { AuditEntry } from "../../core/application/ports/AuditLog";
import type { Clock } from "../../core/application/ports/Clock";
import type { IdGenerator } from "../../core/application/ports/IdGenerator";
import { PARTY, partyDirectory } from "../fixtures/parties";

/** REQ-802 and REQ-803: every entry answers who, when and what. Persistence (REQ-801) comes next. */
const clock: Clock = { now: () => "2026-11-03T12:00:00.000Z" };

async function submitPayroll(submittedBy?: string, submission = new StubCandidateSubmissionAdapter()) {
  const directory = partyDirectory();
  const repo = new InMemoryIntentRepository();
  const audit = new InMemoryAuditLog();
  const ids: IdGenerator = { next: () => "i1" };
  const { intentId } = await new StartIntentUseCase(repo, clock, ids, audit).execute({
    scenarioId: "register_payroll",
    userId: "cfo",
  });
  await new ApplyAnswersUseCase(repo, clock, audit, directory).execute({
    intentId,
    answers: [
      { key: "payee", value: PARTY.ACME },
      { key: "amount", value: "1500.00" },
      { key: "currency", value: "BRL" },
      { key: "occurredAt", value: "2026-11-03" },
    ],
  });
  await new SubmitIntentUseCase(repo, new CandidateMapper(PARTY.USINA), submission, audit, clock, directory).execute(
    intentId,
    submittedBy,
  );
  return audit.listByIntent(intentId);
}

const ofType = (entries: AuditEntry[], type: string) => entries.find((e) => e.type === type);

describe("REQ-802 — todo registro identifica o autor", () => {
  it("CA-801: o gestor que envia a folha aparece como autor do envio e do desfecho", async () => {
    const entries = await submitPayroll("cfo");

    expect(ofType(entries, "intent.submitted")?.actor).toEqual({ kind: "user", id: "cfo" });
    expect(ofType(entries, "intent.accepted")?.actor).toEqual({ kind: "user", id: "cfo" });
  });

  it("o autor do envio é quem enviou, mesmo que outra pessoa tenha iniciado", async () => {
    const entries = await submitPayroll("outra-gestora");

    expect(ofType(entries, "intent.started")?.actor.id).toBe("cfo");
    expect(ofType(entries, "intent.submitted")?.actor.id).toBe("outra-gestora");
  });

  it("nenhum registro do percurso fica sem autor", async () => {
    const entries = await submitPayroll();

    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) expect(entry.actor.id.trim()).not.toBe("");
  });

  it.each([
    ["sem autor", undefined],
    ["com autor em branco", { kind: "user", id: "  " }],
  ])("REJ-802: um registro %s é recusado", async (_label, actor) => {
    const audit = new InMemoryAuditLog();

    await expect(
      audit.record({ actor, intentId: "i1", at: clock.now(), type: "intent.submitted" } as never),
    ).rejects.toThrow(/author/i);
    expect(await audit.listByIntent("i1")).toEqual([]);
  });

  it("o modelo aceita um sistema externo identificado como autor", async () => {
    const audit = new InMemoryAuditLog();

    await audit.record({
      actor: { kind: "external_system", id: "sistema-comissoes" },
      intentId: "i1",
      at: clock.now(),
      type: "intent.submitted",
    });

    expect((await audit.listByIntent("i1"))[0].actor.kind).toBe("external_system");
  });
});

describe("REQ-803 — quem, quando e o quê", () => {
  it("o registro do envio responde às três perguntas", async () => {
    const submitted = ofType(await submitPayroll("cfo"), "intent.submitted");

    expect(submitted).toMatchObject({
      actor: { id: "cfo" },
      at: clock.now(),
      type: "intent.submitted",
      detail: "intent:i1",
    });
  });
});
