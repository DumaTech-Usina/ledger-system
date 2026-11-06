import { describe, it, expect } from "vitest";
import "../../config/env"; // the usina's timezone, which decides what "today" is
import { InMemoryIntentRepository } from "../../infra/persistence/InMemoryIntentRepository";
import { InMemoryConversationLog } from "../../infra/audit/InMemoryConversationLog";
import { InMemoryAuditLog } from "../../infra/audit/InMemoryAuditLog";
import { StubSlotExtractionAdapter } from "../../infra/nlp/StubSlotExtractionAdapter";
import { StartIntentUseCase } from "../../core/application/use-cases/StartIntent";
import { ApplyAnswersUseCase } from "../../core/application/use-cases/ApplyAnswers";
import { AdvanceDialogUseCase } from "../../core/application/use-cases/AdvanceDialog";
import { InterpretUtteranceUseCase } from "../../core/application/use-cases/InterpretUtterance";
import { StartPositionActionUseCase } from "../../core/application/use-cases/StartPositionAction";
import { SubmitIntentUseCase } from "../../core/application/use-cases/SubmitIntent";
import { SubmitRectificationUseCase } from "../../core/application/use-cases/SubmitRectification";
import { CandidateMapper } from "../../core/application/services/CandidateMapper";
import { DialogEngine } from "../../core/domain/services/DialogEngine";
import { getScenario, listScenarios } from "../../core/domain/scenarios/Scenario";
import type { Candidate } from "../../core/domain/value-objects/Candidate";
import type { Clock } from "../../core/application/ports/Clock";
import type { IdGenerator } from "../../core/application/ports/IdGenerator";
import { PARTY, partyDirectory } from "../fixtures/parties";

/** REQ-222 and REQ-226. Noon on the 3rd in São Paulo unless a test says otherwise. */
const NOON = "2026-11-03T15:00:00.000Z";

function wire(now = NOON) {
  const clock: Clock = { now: () => now };
  const directory = partyDirectory();
  const repo = new InMemoryIntentRepository();
  const log = new InMemoryConversationLog();
  let n = 0;
  const ids: IdGenerator = { next: () => `i-${++n}` };
  const start = new StartIntentUseCase(repo, clock, ids, log);
  const apply = new ApplyAnswersUseCase(repo, clock, log, directory);
  const submitted: Candidate[] = [];
  const submit = new SubmitIntentUseCase(
    repo,
    new CandidateMapper(PARTY.USINA),
    {
      submit: async (candidate: Candidate) => {
        submitted.push(candidate);
        return { status: "accepted" as const, ledgerReference: `evt-${submitted.length}` };
      },
    },
    new InMemoryAuditLog(),
    clock,
    directory,
  );
  return {
    clock,
    repo,
    start,
    apply,
    submit,
    submitted,
    advance: new AdvanceDialogUseCase(repo, clock, log, directory),
    interpret: new InterpretUtteranceUseCase(repo, new StubSlotExtractionAdapter(), apply, log, clock, ids, directory),
  };
}

const payroll = async (w: ReturnType<typeof wire>) =>
  (await w.start.execute({ scenarioId: "register_payroll", userId: "cfo" })).intentId;

describe("REQ-222 — a moeda é BRL", () => {
  it.each(listScenarios().map((s) => s.id))("CA-222: %s nasce em BRL, sem perguntar a moeda", async (scenarioId) => {
    const w = wire();

    const { intentId, state } = await w.start.execute({ scenarioId, userId: "cfo" });

    expect((await w.repo.findById(intentId))?.answers.currency).toBe("BRL");
    expect(state.kind === "question" && state.slot.key).not.toBe("currency");
  });

  it("nenhuma operação oferece outra moeda", () => {
    for (const scenario of listScenarios()) {
      expect(scenario.slots.find((s) => s.key === "currency")?.choices).toEqual(["BRL"]);
    }
  });

  it("a moeda não conta no progresso da conversa", async () => {
    const state = DialogEngine.nextState(getScenario("register_payroll")!, { currency: "BRL" });

    expect(state).toMatchObject({ answered: 0 });
  });

  it("USD é recusado, pela resposta direta e pela correção", async () => {
    const w = wire();
    const intentId = await payroll(w);

    const direct = await w.advance.execute({ intentId, key: "currency", value: "USD" });
    const edited = await w.apply.execute({ intentId, mode: "edit", answers: [{ key: "currency", value: "USD" }] });

    expect(direct.error).toBeDefined();
    expect(edited.rejected.map((r) => r.key)).toEqual(["currency"]);
    expect((await w.repo.findById(intentId))?.answers.currency).toBe("BRL");
  });

  it("uma frase que cita USD não muda a moeda", async () => {
    const w = wire();
    const intentId = await payroll(w);

    await w.interpret.execute({ intentId, utterance: "paguei 1500.00 em USD" });

    expect((await w.repo.findById(intentId))?.answers.currency).toBe("BRL");
  });

  it("o candidato sai em BRL", async () => {
    const w = wire();
    const intentId = await payroll(w);
    await w.apply.execute({
      intentId,
      answers: [
        { key: "payee", value: PARTY.ACME },
        { key: "amount", value: "10.00" },
        { key: "occurredAt", value: "2026-11-03" },
      ],
    });

    await w.submit.execute(intentId);

    expect(w.submitted[0].currency).toBe("BRL");
  });

  it("uma posição em outra moeda é recusada, em vez de virar BRL em silêncio", async () => {
    const w = wire();
    const action = new StartPositionActionUseCase(
      { lifecycle: async () => ({ objectId: "p1", currency: "USD", events: [] }) } as never,
      { event: async () => null } as never,
      w.start,
      w.apply,
      PARTY.USINA,
    );

    await expect(
      action.execute({ objectId: "p1", scenarioId: "register_loan_repayment", userId: "cfo" }),
    ).rejects.toThrow(/USD/);
    expect(await w.repo.listByUser("cfo")).toEqual([]);
  });

  it("uma retificação de lançamento em outra moeda é recusada antes de gravar qualquer coisa", async () => {
    const w = wire();
    const rectify = new SubmitRectificationUseCase(
      {
        event: async () => ({
          eventId: "e1",
          eventType: "advance_payment",
          economicEffect: "cash_out",
          amount: "400.00",
          currency: "USD",
          occurredAt: "2026-10-20T12:00:00.000Z",
          description: null,
          relatedEventId: null,
          objects: [{ objectId: "p1", objectType: "advance", relation: "originates" }],
          parties: [{ partyId: PARTY.BROKER, role: "beneficiary", direction: "neutral", amount: "400.00" }],
        }),
      } as never,
      w.start,
      w.apply,
      w.submit,
      w.clock,
      PARTY.USINA,
    );

    await expect(rectify.execute({ targetEventId: "e1", userId: "cfo" })).rejects.toThrow(/USD/);
    expect(w.submitted).toEqual([]);
  });
});

describe("REQ-226 — a data de ocorrência não pode ser futura", () => {
  const answer = async (w: ReturnType<typeof wire>, value: string) => {
    const intentId = await payroll(w);
    const res = await w.advance.execute({ intentId, key: "occurredAt", value });
    return { res, recorded: (await w.repo.findById(intentId))?.answers.occurredAt };
  };

  it.each(["2026-11-03", "2026-11-02"])("CA-226: %s é aceita", async (day) => {
    const { res, recorded } = await answer(wire(), day);

    expect(res.error).toBeUndefined();
    expect(recorded).toBe(day);
  });

  it.each(["2026-11-04", "2026-11-10"])("CA-226, REJ-226: %s é recusada", async (day) => {
    const { res, recorded } = await answer(wire(), day);

    expect(res.error?.key).toBe("occurredAt");
    expect(recorded).toBeUndefined();
  });

  describe("hoje é o dia em São Paulo (REQ-225)", () => {
    const LATE_EVENING = "2026-11-04T01:00:00.000Z"; // 22:00 do dia 3 em São Paulo

    it("às 22h do dia 3, o dia 3 é hoje, embora em UTC já seja dia 4", async () => {
      expect((await answer(wire(LATE_EVENING), "2026-11-03")).res.error).toBeUndefined();
    });

    it("às 22h do dia 3, o dia 4 ainda é amanhã", async () => {
      expect((await answer(wire(LATE_EVENING), "2026-11-04")).res.error).toBeDefined();
    });

    it("um instante é lido pelo dia em São Paulo: 01h UTC do dia 4 ainda é dia 3", async () => {
      expect((await answer(wire(), "2026-11-04T01:00:00.000Z")).res.error).toBeUndefined();
    });
  });

  it("vale também pelo texto livre", async () => {
    const w = wire();
    const intentId = await payroll(w);

    const res = await w.interpret.execute({ intentId, utterance: "paguei 10.00 em 2026-12-25" });

    expect(res.rejected.map((r) => r.key)).toContain("occurredAt");
    expect((await w.repo.findById(intentId))?.answers.occurredAt).toBeUndefined();
  });

  it.each(listScenarios().map((s) => s.id))("%s não aceita ocorrência futura", (scenarioId) => {
    const slot = getScenario(scenarioId)!.slots.find((s) => s.key === "occurredAt")!;

    expect(DialogEngine.validateAnswer(slot, "2026-11-04", "2026-11-03")).not.toBeNull();
  });

  it("CA-227: só o vencimento pode ser futuro", () => {
    const slots = getScenario("register_obligation_recognition")!.slots;
    const due = slots.find((s) => s.key === "dueAt")!;

    expect(DialogEngine.validateAnswer(due, "2026-12-10", "2026-11-03")).toBeNull();
  });
});
