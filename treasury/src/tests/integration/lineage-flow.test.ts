import { describe, it, expect } from "vitest";
import { InMemoryIntentRepository } from "../../infra/persistence/InMemoryIntentRepository";
import { InMemoryAuditLog } from "../../infra/audit/InMemoryAuditLog";
import { StubCandidateSubmissionAdapter } from "../../infra/submission/StubCandidateSubmissionAdapter";
import { CandidateMapper } from "../../core/application/services/CandidateMapper";
import { StartIntentUseCase } from "../../core/application/use-cases/StartIntent";
import { AdvanceDialogUseCase } from "../../core/application/use-cases/AdvanceDialog";
import { ApplyAnswersUseCase } from "../../core/application/use-cases/ApplyAnswers";
import { PreviewIntentUseCase } from "../../core/application/use-cases/PreviewIntent";
import { SubmitIntentUseCase } from "../../core/application/use-cases/SubmitIntent";
import { IntentStatus } from "../../core/domain/enums/IntentStatus";
import type { Candidate } from "../../core/domain/value-objects/Candidate";
import type { CandidateSubmissionPort, SubmissionOutcome } from "../../core/application/ports/CandidateSubmissionPort";
import type { Clock } from "../../core/application/ports/Clock";
import type { IdGenerator } from "../../core/application/ports/IdGenerator";
import { PARTY, partyDirectory } from "../fixtures/parties";

const clock: Clock = { now: () => "2026-07-09T00:00:00.000Z" };

/** Rejects a specific bad origin id with a structured lineage rejection, accepts anything else. */
class OriginGate implements CandidateSubmissionPort {
  constructor(private readonly badOrigin: string) {}
  async submit(c: Candidate): Promise<SubmissionOutcome> {
    if (c.relatedEventId === this.badOrigin) {
      return {
        status: "rejected",
        reason: "origin not found",
        rejections: [{ code: "ORIGIN_NOT_FOUND", category: "lineage", field: "relatedEventId", detail: "The referenced originating entry could not be found." }],
      };
    }
    return { status: "accepted", ledgerReference: "evt_ok" };
  }
}

function wire(submission: CandidateSubmissionPort = new StubCandidateSubmissionAdapter()) {
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
    apply: new ApplyAnswersUseCase(repo, clock, audit, directory),
    preview: new PreviewIntentUseCase(repo, mapper, directory),
    submit: new SubmitIntentUseCase(repo, mapper, submission, audit, clock, directory),
  };
}

async function fill(w: ReturnType<typeof wire>, scenarioId: string, answers: Record<string, string>) {
  const { intentId } = await w.start.execute({ scenarioId, userId: "cfo" });
  let last;
  for (const [key, value] of Object.entries(answers)) last = await w.advance.execute({ intentId, key, value });
  return { intentId, last: last! };
}

describe("lineage flow (Phase 6)", () => {
  it("commission received with an origin is ready and accepted; the candidate carries relatedEventId", async () => {
    const w = wire();
    const { intentId, last } = await fill(w, "register_commission_received", {
      payer: PARTY.OPERATOR, amount: "1000.00", currency: "BRL", occurredAt: "2026-07-09", origin: "evt-expected-1",
      description: "",
    });
    expect(last.state.kind).toBe("ready");
    const preview = await w.preview.execute(intentId);
    expect(preview.candidate.relatedEventId).toBe("evt-expected-1");
    expect((await w.submit.execute(intentId)).intentStatus).toBe(IntentStatus.ACCEPTED);
  });

  it("commission received is ready WITHOUT an origin (orphan path) and is accepted", async () => {
    const w = wire();
    // origin is optional → omitting it still reaches ready; the mapper records an orphan.
    const { intentId, last } = await fill(w, "register_commission_received", {
      payer: PARTY.OPERATOR, amount: "1000.00", currency: "BRL", occurredAt: "2026-07-09", description: "",
    });
    expect(last.state.kind).toBe("ready");
    const preview = await w.preview.execute(intentId);
    expect(preview.candidate.relatedEventId).toBeUndefined();
    expect(preview.candidate.reason.type).toBe("unknown_origin");
    expect((await w.submit.execute(intentId)).intentStatus).toBe(IntentStatus.ACCEPTED);
  });

  it("advance recovery requires an origin — the dialog keeps asking until it is provided", async () => {
    const w = wire();
    const { intentId, last } = await fill(w, "register_advance_settlement", {
      payer: PARTY.BROKER, amount: "500.00", currency: "BRL", occurredAt: "2026-07-09",
    });
    // origin still missing → not ready, and the next question is the origin slot.
    expect(last.state.kind).toBe("question");
    if (last.state.kind === "question") expect(last.state.slot.key).toBe("origin");
  });

  it("a bad origin → lineage rejection → AWAITING_CORRECTION re-asking `origin` → fix → accepted", async () => {
    const w = wire(new OriginGate("evt-bad"));
    const { intentId } = await fill(w, "register_advance_settlement", {
      payer: PARTY.BROKER, amount: "500.00", currency: "BRL", occurredAt: "2026-07-09", origin: "evt-bad",
      description: "",
    });

    const first = await w.submit.execute(intentId);
    expect(first.intentStatus).toBe(IntentStatus.AWAITING_CORRECTION);
    expect(first.correction?.slots).toEqual(["origin"]);
    expect(first.rejections?.[0].code).toBe("ORIGIN_NOT_FOUND");

    // Fix the origin reference in `edit` mode → back to AWAITING_CONFIRMATION → resubmit succeeds.
    await w.apply.execute({ intentId, answers: [{ key: "origin", value: "evt-good" }], mode: "edit" });
    expect((await w.repo.findById(intentId))?.status).toBe(IntentStatus.AWAITING_CONFIRMATION);
    expect((await w.submit.execute(intentId)).intentStatus).toBe(IntentStatus.ACCEPTED);
  });
});
