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

/**
 * Phase 1 business flow: the two credit scenarios (advance, loan) are reachable end-to-end via the
 * guided path — start → fill every required slot → preview → submit → accepted — exactly like the
 * existing shape-A scenarios, with no new plumbing. Proves "a new scenario is data only".
 */
const clock: Clock = { now: () => "2026-07-09T00:00:00.000Z" };

function wire() {
  const repo = new InMemoryIntentRepository();
  const audit = new InMemoryAuditLog();
  const mapper = new CandidateMapper("party-usina");
  let n = 0;
  const ids: IdGenerator = { next: () => `intent-${++n}` };
  return {
    repo,
    start: new StartIntentUseCase(repo, clock, ids, audit),
    advance: new AdvanceDialogUseCase(repo, clock, audit),
    preview: new PreviewIntentUseCase(repo, mapper),
    submit: new SubmitIntentUseCase(repo, mapper, new StubCandidateSubmissionAdapter(), audit, clock),
  };
}

async function fill(w: ReturnType<typeof wire>, scenarioId: string) {
  const { intentId } = await w.start.execute({ scenarioId, userId: "cfo" });
  await w.advance.execute({ intentId, key: "payee", value: "party-broker" });
  await w.advance.execute({ intentId, key: "amount", value: "1500.00" });
  await w.advance.execute({ intentId, key: "currency", value: "BRL" });
  await w.advance.execute({ intentId, key: "occurredAt", value: "2026-07-09" });
  return intentId;
}

describe("credit scenarios flow (Phase 1)", () => {
  it.each([
    { scenarioId: "register_advance", eventType: "advance_payment", objectType: "advance" },
    { scenarioId: "register_loan", eventType: "loan_origination", objectType: "loan" },
  ])("$scenarioId reaches ready, previews the right tuple, and is accepted", async ({ scenarioId, eventType, objectType }) => {
    const w = wire();
    const intentId = await fill(w, scenarioId);

    const preview = await w.preview.execute(intentId);
    expect(preview.candidate.eventType).toBe(eventType);
    expect(preview.candidate.economicEffect).toBe("cash_out");
    expect(preview.candidate.objects[0]).toMatchObject({ objectType, relation: "originates" });

    const intent = await w.repo.findById(intentId);
    expect(intent?.status).toBe(IntentStatus.AWAITING_CONFIRMATION);

    const result = await w.submit.execute(intentId);
    expect(result.status).toBe("accepted");
    expect(result.ledgerReference).toBeTruthy();

    const after = await w.repo.findById(intentId);
    expect(after?.status).toBe(IntentStatus.ACCEPTED);
  });
});
