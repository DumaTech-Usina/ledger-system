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
 * MVA — the continuity assertion is reachable through the real guided flow, with no new plumbing:
 * an optional slot, the existing dialog, the existing preview and submit. Answering it links the
 * settlement to the advance's position; leaving it empty reproduces today's behaviour exactly.
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

async function fill(w: ReturnType<typeof wire>, scenarioId: string, answers: Record<string, string>) {
  const { intentId } = await w.start.execute({ scenarioId, userId: "cfo" });
  let last;
  for (const [key, value] of Object.entries(answers)) last = await w.advance.execute({ intentId, key, value });
  return { intentId, last: last! };
}

describe("object continuity flow (MVA)", () => {
  it("an advance disbursed then recovered in two instalments is ONE object across three events", async () => {
    const w = wire();

    // 1. The advance is disbursed — its object identity is minted, as always.
    const disbursement = await fill(w, "register_advance", {
      payee: "party-broker", amount: "500.00", currency: "BRL", occurredAt: "2026-07-02",
    });
    const advanceObjectId = (await w.preview.execute(disbursement.intentId)).candidate.objects[0].objectId;
    expect((await w.submit.execute(disbursement.intentId)).intentStatus).toBe(IntentStatus.ACCEPTED);

    // 2 & 3. Two recoveries of 250, each asserting the position it moves.
    const recoveries = [];
    for (const _ of [1, 2]) {
      const { intentId, last } = await fill(w, "register_advance_settlement", {
        payer: "party-broker", amount: "250.00", currency: "BRL", occurredAt: "2026-07-09",
        origin: "evt-advance-1", objectRef: advanceObjectId,
      });
      expect(last.state.kind).toBe("ready");
      const { candidate } = await w.preview.execute(intentId);
      expect((await w.submit.execute(intentId)).intentStatus).toBe(IntentStatus.ACCEPTED);
      recoveries.push(candidate);
    }

    // One economic object; three independent facts.
    expect(recoveries.map((c) => c.objects[0].objectId)).toEqual([advanceObjectId, advanceObjectId]);
    expect(new Set(recoveries.map((c) => c.sourceReference)).size).toBe(2);
    expect(recoveries.every((c) => c.sourceReference !== advanceObjectId)).toBe(true);
  });

  it("the continuity slot is optional — leaving it empty reaches ready and mints as today", async () => {
    const w = wire();
    const { intentId, last } = await fill(w, "register_advance_settlement", {
      payer: "party-broker", amount: "500.00", currency: "BRL", occurredAt: "2026-07-09", origin: "evt-advance-1",
    });

    expect(last.state.kind).toBe("ready");
    const { candidate } = await w.preview.execute(intentId);
    expect(candidate.objects[0].objectId).toBe(`intent:${intentId}`);
    expect((await w.submit.execute(intentId)).intentStatus).toBe(IntentStatus.ACCEPTED);
  });
});
