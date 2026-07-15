import { describe, it, expect } from "vitest";
import { InMemoryIntentRepository } from "../../infra/persistence/InMemoryIntentRepository";
import { InMemoryAuditLog } from "../../infra/audit/InMemoryAuditLog";
import { StubCandidateSubmissionAdapter } from "../../infra/submission/StubCandidateSubmissionAdapter";
import { CandidateMapper } from "../../core/application/services/CandidateMapper";
import { StartIntentUseCase } from "../../core/application/use-cases/StartIntent";
import { AdvanceDialogUseCase } from "../../core/application/use-cases/AdvanceDialog";
import { PreviewIntentUseCase } from "../../core/application/use-cases/PreviewIntent";
import { SubmitIntentUseCase } from "../../core/application/use-cases/SubmitIntent";
import { GetIntentUseCase } from "../../core/application/use-cases/GetIntent";
import { IntentStatus } from "../../core/domain/enums/IntentStatus";
import type { Clock } from "../../core/application/ports/Clock";
import type { IdGenerator } from "../../core/application/ports/IdGenerator";

const clock: Clock = { now: () => "2026-07-09T00:00:00.000Z" };

function wire() {
  const repo = new InMemoryIntentRepository();
  const audit = new InMemoryAuditLog();
  const mapper = new CandidateMapper("party-usina");
  const submission = new StubCandidateSubmissionAdapter();
  let n = 0;
  const ids: IdGenerator = { next: () => `intent-${++n}` };
  return {
    repo,
    audit,
    start: new StartIntentUseCase(repo, clock, ids, audit),
    advance: new AdvanceDialogUseCase(repo, clock, audit),
    preview: new PreviewIntentUseCase(repo, mapper),
    submit: new SubmitIntentUseCase(repo, mapper, submission, audit, clock),
    get: new GetIntentUseCase(repo, audit),
  };
}

async function fillAddCharge(w: ReturnType<typeof wire>, description = "") {
  const { intentId } = await w.start.execute({ scenarioId: "register_payment", userId: "cfo" });
  await w.advance.execute({ intentId, key: "payee", value: "ACME" });
  await w.advance.execute({ intentId, key: "amount", value: "1500.00" });
  await w.advance.execute({ intentId, key: "currency", value: "BRL" });
  await w.advance.execute({ intentId, key: "occurredAt", value: "2026-07-09" });
  if (description) await w.advance.execute({ intentId, key: "description", value: description });
  return intentId;
}

describe("submit flow", () => {
  it("previews the exact candidate without changing state", async () => {
    const w = wire();
    const intentId = await fillAddCharge(w);
    const preview = await w.preview.execute(intentId);

    expect(preview.candidate.amount).toBe("1500.00");
    expect(preview.candidate.reporter.reporterType).toBe("user");
    expect(preview.candidate.sourceReference).toBe(`intent:${intentId}`);

    const intent = await w.repo.findById(intentId);
    expect(intent?.status).toBe(IntentStatus.AWAITING_CONFIRMATION); // unchanged by preview
  });

  it("submits and is accepted, recording the ledger reference + audit trail", async () => {
    const w = wire();
    const intentId = await fillAddCharge(w);
    const result = await w.submit.execute(intentId);

    expect(result.status).toBe("accepted");
    expect(result.ledgerReference).toBeTruthy();

    const detail = await w.get.execute(intentId);
    expect(detail.intent.status).toBe(IntentStatus.ACCEPTED);
    expect(detail.history.map((h) => h.type)).toEqual(
      expect.arrayContaining(["intent.started", "intent.submitted", "intent.accepted"]),
    );
  });

  it("is rejected when the stub flags it, and surfaces the reason", async () => {
    const w = wire();
    const intentId = await fillAddCharge(w, "test entry"); // stub rejects descriptions containing 'test'
    const result = await w.submit.execute(intentId);

    expect(result.status).toBe("rejected");
    expect(result.reason).toMatch(/manual review/i);

    const intent = await w.repo.findById(intentId);
    expect(intent?.status).toBe(IntentStatus.REJECTED);
    expect(intent?.rejectionReason).toBeTruthy();
  });

  it("refuses to submit an intent that is not ready", async () => {
    const w = wire();
    const { intentId } = await w.start.execute({ scenarioId: "register_payment", userId: "cfo" });
    await expect(w.submit.execute(intentId)).rejects.toThrow(/not ready to submit/i);
  });
});
