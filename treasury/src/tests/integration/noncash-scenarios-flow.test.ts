import { describe, it, expect } from "vitest";
import { InMemoryIntentRepository } from "../../infra/persistence/InMemoryIntentRepository";
import { InMemoryAuditLog } from "../../infra/audit/InMemoryAuditLog";
import { StubCandidateSubmissionAdapter } from "../../infra/submission/StubCandidateSubmissionAdapter";
import { CandidateMapper } from "../../core/application/services/CandidateMapper";
import { StartIntentUseCase } from "../../core/application/use-cases/StartIntent";
import { AdvanceDialogUseCase } from "../../core/application/use-cases/AdvanceDialog";
import { PreviewIntentUseCase } from "../../core/application/use-cases/PreviewIntent";
import { SubmitIntentUseCase } from "../../core/application/use-cases/SubmitIntent";
import { IntentStatus } from "../../core/domain/enums/IntentStatus";
import type { Clock } from "../../core/application/ports/Clock";
import type { IdGenerator } from "../../core/application/ports/IdGenerator";
import { PARTY, partyDirectory } from "../fixtures/parties";

/**
 * Phase 5: the NON_CASH operations are reachable end-to-end via the guided path and produce valid
 * candidates. The mold (single beneficiary party carrying no amount; multi-object) is the new
 * capability; the Ledger accepts these exact shapes (proven in ledger submit-endpoint.test.ts).
 */
const clock: Clock = { now: () => "2026-07-09T00:00:00.000Z" };

function wire() {
  const directory = partyDirectory();
  const repo = new InMemoryIntentRepository();
  const audit = new InMemoryAuditLog();
  const mapper = new CandidateMapper(PARTY.USINA);
  let n = 0;
  const ids: IdGenerator = { next: () => `intent-${++n}` };
  return {
    repo,
    start: new StartIntentUseCase(repo, clock, ids, audit),
    advance: new AdvanceDialogUseCase(repo, clock, audit, directory),
    preview: new PreviewIntentUseCase(repo, mapper, directory),
    submit: new SubmitIntentUseCase(repo, mapper, new StubCandidateSubmissionAdapter(), audit, clock, directory),
  };
}

async function fill(w: ReturnType<typeof wire>, scenarioId: string, answers: Record<string, string>) {
  const { intentId } = await w.start.execute({ scenarioId, userId: "cfo" });
  let last;
  for (const [key, value] of Object.entries(answers)) {
    last = await w.advance.execute({ intentId, key, value });
  }
  return { intentId, last: last! };
}

describe("NON_CASH scenarios flow (Phase 5)", () => {
  it("commission waiver: no party carries an amount; object relation follows the basis choice", async () => {
    const w = wire();
    const { intentId, last } = await fill(w, "register_waiver", {
      payee: PARTY.BROKER, basis: "reversal", amount: "500.00", currency: "BRL", occurredAt: "2026-07-09",
    });
    expect(last.state.kind).toBe("ready");

    const preview = await w.preview.execute(intentId);
    expect(preview.candidate.economicEffect).toBe("non_cash");
    expect(preview.candidate.objects[0].relation).toBe("reverses");
    expect(preview.candidate.parties.every((p) => p.amount === undefined)).toBe(true);

    const result = await w.submit.execute(intentId);
    expect(result.intentStatus).toBe(IntentStatus.ACCEPTED);
  });

  it("commission accrual: usina-only party, no counterparty slot asked", async () => {
    const w = wire();
    const { intentId } = await fill(w, "register_commission_accrual", {
      amount: "1000.00", currency: "BRL", occurredAt: "2026-07-09",
    });
    const preview = await w.preview.execute(intentId);
    expect(preview.candidate.eventType).toBe("commission_expected");
    expect(preview.candidate.parties).toEqual([{ partyId: PARTY.USINA, role: "beneficiary", direction: "neutral" }]);

    const result = await w.submit.execute(intentId);
    expect(result.intentStatus).toBe(IntentStatus.ACCEPTED);
  });

  it("direct payment acknowledgement: two settled objects, accepted", async () => {
    const w = wire();
    const { intentId } = await fill(w, "register_direct_payment", {
      payee: PARTY.BROKER, amount: "1000.00", currency: "BRL", occurredAt: "2026-07-09",
    });
    const preview = await w.preview.execute(intentId);
    expect(preview.candidate.objects).toHaveLength(2);
    expect(preview.candidate.objects.map((o) => o.objectType)).toEqual(["commission_receivable", "commission_entitlement"]);

    const result = await w.submit.execute(intentId);
    expect(result.intentStatus).toBe(IntentStatus.ACCEPTED);
  });
});
