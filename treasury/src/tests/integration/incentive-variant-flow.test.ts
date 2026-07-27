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
 * Phase 4: a CHOICE slot (`kind`) selects a branch of the tuple (the object). The mapper stays the
 * sole tuple authority — the user picks incentive vs bonus, never a raw Ledger value — and the whole
 * guided flow (which now asks `kind`) still ends in an accepted candidate.
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

async function fillIncentive(w: ReturnType<typeof wire>, kind: string) {
  const { intentId } = await w.start.execute({ scenarioId: "register_incentive", userId: "cfo" });
  await w.advance.execute({ intentId, key: "payee", value: "party-broker" });
  await w.advance.execute({ intentId, key: "kind", value: kind });
  await w.advance.execute({ intentId, key: "amount", value: "1500.00" });
  await w.advance.execute({ intentId, key: "currency", value: "BRL" });
  const last = await w.advance.execute({ intentId, key: "occurredAt", value: "2026-07-09" });
  return { intentId, last };
}

describe("incentive variant flow (Phase 4)", () => {
  it("rejects an invalid kind choice (deterministic engine guards it)", async () => {
    const w = wire();
    const { intentId } = await w.start.execute({ scenarioId: "register_incentive", userId: "cfo" });
    await w.advance.execute({ intentId, key: "payee", value: "party-broker" });
    const res = await w.advance.execute({ intentId, key: "kind", value: "gift" });
    expect(res.error?.key).toBe("kind");
  });

  it.each([
    { kind: "incentive", objectType: "incentive" },
    { kind: "bonus", objectType: "bonus" },
  ])("guided flow with kind=$kind previews object $objectType and is accepted", async ({ kind, objectType }) => {
    const w = wire();
    const { intentId, last } = await fillIncentive(w, kind);
    expect(last.state.kind).toBe("ready"); // asking `kind` did not block reaching ready

    const preview = await w.preview.execute(intentId);
    expect(preview.candidate.eventType).toBe("incentive_payment");
    expect(preview.candidate.economicEffect).toBe("cash_out");
    expect(preview.candidate.objects[0]).toMatchObject({ objectType, relation: "settles" });

    const result = await w.submit.execute(intentId);
    expect(result.status).toBe("accepted");
    expect(result.intentStatus).toBe(IntentStatus.ACCEPTED);
  });
});
