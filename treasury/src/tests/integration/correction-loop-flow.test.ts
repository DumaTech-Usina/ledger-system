import { describe, it, expect } from "vitest";
import { InMemoryIntentRepository } from "../../infra/persistence/InMemoryIntentRepository";
import { InMemoryAuditLog } from "../../infra/audit/InMemoryAuditLog";
import { CandidateMapper } from "../../core/application/services/CandidateMapper";
import { StartIntentUseCase } from "../../core/application/use-cases/StartIntent";
import { AdvanceDialogUseCase } from "../../core/application/use-cases/AdvanceDialog";
import { ApplyAnswersUseCase } from "../../core/application/use-cases/ApplyAnswers";
import { SubmitIntentUseCase } from "../../core/application/use-cases/SubmitIntent";
import { IntentStatus } from "../../core/domain/enums/IntentStatus";
import type { Candidate } from "../../core/domain/value-objects/Candidate";
import type { CandidateSubmissionPort, SubmissionOutcome } from "../../core/application/ports/CandidateSubmissionPort";
import type { Clock } from "../../core/application/ports/Clock";
import type { IdGenerator } from "../../core/application/ports/IdGenerator";

const clock: Clock = { now: () => "2026-07-09T00:00:00.000Z" };

/**
 * A gate that rejects a specific amount with a structured INPUT rejection (fixable), and accepts
 * everything else. Lets us prove treasury's correction loop in isolation — the Ledger's real
 * validation is covered on the Ledger side (Phase 2). The correction loop is treasury's concern.
 */
class AmountGate implements CandidateSubmissionPort {
  constructor(private readonly badAmount: string) {}
  async submit(c: Candidate): Promise<SubmissionOutcome> {
    if (c.amount === this.badAmount) {
      return {
        status: "rejected",
        reason: "The amount is invalid.",
        rejections: [{ code: "AMOUNT_INVALID", category: "input", field: "amount", detail: "The amount is invalid." }],
      };
    }
    return { status: "accepted", ledgerReference: "evt_ok" };
  }
}

/** A gate that always rejects with the given structured rejection (terminal-path coverage). */
class FixedGate implements CandidateSubmissionPort {
  constructor(private readonly outcome: SubmissionOutcome) {}
  async submit(): Promise<SubmissionOutcome> {
    return this.outcome;
  }
}

function wire(submission: CandidateSubmissionPort) {
  const repo = new InMemoryIntentRepository();
  const audit = new InMemoryAuditLog();
  const mapper = new CandidateMapper("party-usina");
  let n = 0;
  const ids: IdGenerator = { next: () => `intent-${++n}` };
  return {
    repo,
    audit,
    start: new StartIntentUseCase(repo, clock, ids, audit),
    advance: new AdvanceDialogUseCase(repo, clock, audit),
    apply: new ApplyAnswersUseCase(repo, clock, audit),
    submit: new SubmitIntentUseCase(repo, mapper, submission, audit, clock),
  };
}

async function fillPenalty(w: ReturnType<typeof wire>, amount: string) {
  const { intentId } = await w.start.execute({ scenarioId: "register_penalty", userId: "cfo" });
  await w.advance.execute({ intentId, key: "payee", value: "party-authority" });
  await w.advance.execute({ intentId, key: "amount", value: amount });
  await w.advance.execute({ intentId, key: "currency", value: "BRL" });
  await w.advance.execute({ intentId, key: "occurredAt", value: "2026-07-09" });
  return intentId;
}

describe("correction loop (Phase 3)", () => {
  it("input rejection → AWAITING_CORRECTION with the implicated slot → fix → resubmit → accepted", async () => {
    const w = wire(new AmountGate("1500.00"));
    const intentId = await fillPenalty(w, "1500.00");

    // First submit is rejected for a fixable (input) reason — the intent is NOT terminal.
    const first = await w.submit.execute(intentId);
    expect(first.status).toBe("rejected");
    expect(first.intentStatus).toBe(IntentStatus.AWAITING_CORRECTION);
    expect(first.correction?.slots).toEqual(["amount"]);
    expect(first.rejections?.[0].code).toBe("AMOUNT_INVALID");
    expect((await w.repo.findById(intentId))?.status).toBe(IntentStatus.AWAITING_CORRECTION);

    // The user fixes the implicated slot in `edit` mode → intent returns to AWAITING_CONFIRMATION.
    const applied = await w.apply.execute({ intentId, answers: [{ key: "amount", value: "2000.00" }], mode: "edit" });
    expect(applied.state.kind).toBe("ready");
    expect((await w.repo.findById(intentId))?.status).toBe(IntentStatus.AWAITING_CONFIRMATION);

    // Resubmit now succeeds — no restart, same intent.
    const second = await w.submit.execute(intentId);
    expect(second.status).toBe("accepted");
    expect(second.intentStatus).toBe(IntentStatus.ACCEPTED);
    expect(second.ledgerReference).toBe("evt_ok");
    expect((await w.repo.findById(intentId))?.status).toBe(IntentStatus.ACCEPTED);
  });

  it("records a correction audit event naming the slot to re-ask", async () => {
    const w = wire(new AmountGate("1500.00"));
    const intentId = await fillPenalty(w, "1500.00");
    await w.submit.execute(intentId);
    const history = await w.audit.listByIntent(intentId);
    const correction = history.find((h) => h.type === "intent.correction");
    expect(correction?.detail).toContain("amount");
  });

  it("duplicate rejection is terminal (REJECTED, no correction)", async () => {
    const w = wire(new FixedGate({
      status: "rejected",
      reason: "This entry was already recorded.",
      rejections: [{ code: "DUPLICATE", category: "duplicate", detail: "This entry was already recorded." }],
    }));
    const intentId = await fillPenalty(w, "1500.00");
    const result = await w.submit.execute(intentId);
    expect(result.intentStatus).toBe(IntentStatus.REJECTED);
    expect(result.correction).toBeUndefined();
    expect((await w.repo.findById(intentId))?.status).toBe(IntentStatus.REJECTED);
  });

  it("internal rejection is terminal and exposes no slot to re-ask", async () => {
    const w = wire(new FixedGate({
      status: "rejected",
      reason: "routed for review",
      rejections: [{ code: "TUPLE_INVALID", category: "internal", detail: "This operation could not be recorded automatically and was routed for review." }],
    }));
    const intentId = await fillPenalty(w, "1500.00");
    const result = await w.submit.execute(intentId);
    expect(result.intentStatus).toBe(IntentStatus.REJECTED);
    expect(result.correction).toBeUndefined();
  });

  it("a legacy boundary (no rejections[]) degrades to a terminal rejection", async () => {
    const w = wire(new FixedGate({ status: "rejected", reason: "Rejected by the Ledger." }));
    const intentId = await fillPenalty(w, "1500.00");
    const result = await w.submit.execute(intentId);
    expect(result.intentStatus).toBe(IntentStatus.REJECTED);
    expect(result.correction).toBeUndefined();
  });
});
