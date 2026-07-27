import { randomUUID } from "crypto";
import type { Candidate } from "../../core/domain/value-objects/Candidate";
import type { CandidateSubmissionPort, SubmissionOutcome } from "../../core/application/ports/CandidateSubmissionPort";

/**
 * STUB standing in for the Ledger pipeline until the integration contract is decided. It simulates
 * the two outcomes the real gate produces, so the full experience (including rejection) is
 * demonstrable now:
 *   - duplicate submission of the same intent  → rejected (mirrors the Ledger's idempotency guard)
 *   - description containing "test"             → rejected (a stand-in "manual review" rule)
 *   - otherwise                                 → accepted, with a synthetic Ledger reference
 * When the real adapter lands, only this class changes.
 */
export class StubCandidateSubmissionAdapter implements CandidateSubmissionPort {
  private readonly seen = new Set<string>();

  async submit(candidate: Candidate): Promise<SubmissionOutcome> {
    if (this.seen.has(candidate.sourceReference)) {
      return {
        status: "rejected",
        reason: "Duplicate: this intent was already submitted to the Ledger.",
        rejections: [{ code: "DUPLICATE", category: "duplicate", detail: "This entry was already recorded." }],
      };
    }
    if ((candidate.description ?? "").toLowerCase().includes("test")) {
      return {
        status: "rejected",
        reason: "Flagged for manual review (description contains 'test').",
        rejections: [{ code: "TUPLE_INVALID", category: "internal", detail: "This operation could not be recorded automatically and was routed for review." }],
      };
    }
    this.seen.add(candidate.sourceReference);
    return { status: "accepted", ledgerReference: `evt_${randomUUID().slice(0, 8)}` };
  }
}
