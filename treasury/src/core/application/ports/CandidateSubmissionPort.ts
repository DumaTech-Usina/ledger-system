import type { Candidate } from "../../domain/value-objects/Candidate";

export type SubmissionStatus = "accepted" | "rejected";

export interface SubmissionOutcome {
  status: SubmissionStatus;
  /** Present on acceptance — the Ledger's reference to the resulting fact. */
  ledgerReference?: string;
  /** Present on rejection — a legible reason to surface to the user. */
  reason?: string;
}

/**
 * The User App ↔ Ledger submission boundary. Its concrete implementation (HTTP endpoint vs.
 * messaging seam) is the PARKED integration-contract decision. The MVP uses a stub adapter so the
 * full experience works before that decision is made.
 */
export interface CandidateSubmissionPort {
  submit(candidate: Candidate): Promise<SubmissionOutcome>;
}
