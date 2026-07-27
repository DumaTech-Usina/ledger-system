import type { Candidate } from "../../domain/value-objects/Candidate";

export type SubmissionStatus = "accepted" | "rejected";

/**
 * Disposition of a rejection — the ONLY thing treasury branches on. `input`/`lineage` are fixable
 * (re-ask the implicated slot); `duplicate`/`internal` are terminal. This mirrors the Ledger's
 * published contract (ledger/.../services/RejectionCatalog); treasury does NOT import Ledger code.
 */
export type RejectionCategory = "input" | "lineage" | "duplicate" | "internal";

/**
 * One structured rejection. `code` is the Ledger's stable domain code (treated as opaque published
 * vocabulary, like the tuple strings in Candidate); treasury decides the conversational move from
 * `category` alone. `field` is a CANDIDATE field path treasury maps back to a slot (CandidateMapper).
 */
export interface RejectionDetail {
  code: string;
  category: RejectionCategory;
  field?: string;
  detail: string;
  hint?: Record<string, string>;
}

export interface SubmissionOutcome {
  status: SubmissionStatus;
  /** Present on acceptance — the Ledger's reference to the resulting fact. */
  ledgerReference?: string;
  /** Present on rejection — a legible reason to surface to the user (back-compat / fallback). */
  reason?: string;
  /**
   * Present on rejection from a contract-aware boundary — the structured, machine-actionable
   * rejections. Absent from a legacy boundary; treasury then treats the rejection as terminal.
   */
  rejections?: RejectionDetail[];
}

/**
 * The User App ↔ Ledger submission boundary. Its concrete implementation (HTTP endpoint vs.
 * messaging seam) is the PARKED integration-contract decision. The MVP uses a stub adapter so the
 * full experience works before that decision is made.
 */
export interface CandidateSubmissionPort {
  submit(candidate: Candidate): Promise<SubmissionOutcome>;
}
