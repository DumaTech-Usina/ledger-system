import { RejectionType } from "../../domain/value-objects/RejectionType";

/**
 * The domain-oriented rejection contract emitted at the User App ↔ Ledger submit boundary.
 *
 * This module is PRESENTATION of failure, not a new validation: it classifies rejections the Ledger
 * ALREADY produces (StagingRecordValidator's typed failures, and the invariant `Error`s thrown by
 * CreateLedgerEventUseCase / InvariantPolicy) into a small, closed contract a client can act on. It
 * changes no invariant, matrix, or entity — the throw sites are untouched; we only translate their
 * output here, at the boundary that owns communicating the outcome.
 *
 * Design rules (see treasury/docs/ledger-communication-flow.md):
 *  - `code` and `category` are CLOSED enums — a client branches on them, never parses `detail`.
 *  - `detail` is DISPLAY-SAFE — it never leaks matrix names, step numbers, or enum vocabulary.
 *    `internal` rejections carry a generic detail only.
 *  - `field` is a CANDIDATE field path (`amount`, `parties`, `relatedEventId`) — the client maps it
 *    to its own input; the Ledger stays ignorant of the client's field/slot names.
 */

/** Drives the client's next move; the client never needs to understand invariants, only this. */
export type RejectionCategory =
  | "input" // a user-provided value is missing/invalid/out of range → re-ask that input
  | "lineage" // a referenced origin event is missing/absent/wrong-kind → re-ask the origin
  | "duplicate" // the fact is already recorded → terminal
  | "internal"; // the candidate's semantic tuple is malformed (not user input) → escalate, never expose

export enum RejectionCode {
  AMOUNT_INVALID = "AMOUNT_INVALID",
  PARTY_MISSING = "PARTY_MISSING",
  FIELD_MISSING = "FIELD_MISSING",
  DUPLICATE = "DUPLICATE",
  ORIGIN_NOT_FOUND = "ORIGIN_NOT_FOUND",
  ORIGIN_WRONG_TYPE = "ORIGIN_WRONG_TYPE",
  LINEAGE_REQUIRED = "LINEAGE_REQUIRED",
  OVER_SETTLEMENT = "OVER_SETTLEMENT",
  TUPLE_INVALID = "TUPLE_INVALID",
}

export interface RejectionDetail {
  code: RejectionCode;
  category: RejectionCategory;
  /** Candidate field path implicated, when one exists (omitted for tuple-level / internal). */
  field?: string;
  /** Display-safe explanation. Never contains internal vocabulary. */
  detail: string;
  /** Optional, code-specific safe context (e.g. the outstanding limit for OVER_SETTLEMENT). */
  hint?: Record<string, string>;
}

/** Fields a user actually answers; the rest are Treasury/Ledger-supplied (missing ⇒ internal). */
const USER_FIELDS = new Set(["amount", "currency", "occurredAt"]);

const detail = (code: RejectionCode, category: RejectionCategory, field: string | undefined, text: string, hint?: Record<string, string>): RejectionDetail =>
  hint ? { code, category, field, detail: text, hint } : { code, category, field, detail: text };

const internal = (): RejectionDetail =>
  detail(RejectionCode.TUPLE_INVALID, "internal", undefined, "This operation could not be recorded automatically and was routed for review.");

/**
 * Classify a StagingRecordValidator failure (schema/shape stage). `INVALID_SCHEMA` is overloaded by
 * the validator (missing user field vs. malformed enum/metadata), so it is disambiguated by the
 * description prefix — the only place a description is inspected.
 */
export function classifyStagingFailure(failure: { type: RejectionType; description: string }): RejectionDetail {
  switch (failure.type) {
    case RejectionType.INVALID_AMOUNT:
      return detail(RejectionCode.AMOUNT_INVALID, "input", "amount", "The amount is invalid.");

    case RejectionType.DUPLICATE_EVENT:
      return detail(RejectionCode.DUPLICATE, "duplicate", undefined, "This entry was already recorded.");

    case RejectionType.MISSING_PARTY:
      // A party missing its id is the (user-provided) counterparty; anything else is a mapping defect.
      return /partyId/i.test(failure.description)
        ? detail(RejectionCode.PARTY_MISSING, "input", "parties", "A required party is missing.")
        : internal();

    case RejectionType.INVALID_SCHEMA: {
      const missing = failure.description.match(/^Missing required field:\s*(\w+)/);
      if (missing && USER_FIELDS.has(missing[1])) {
        return detail(RejectionCode.FIELD_MISSING, "input", missing[1], "A required field is missing.");
      }
      return internal();
    }

    case RejectionType.POLICY_VIOLATION:
    default:
      return internal();
  }
}

/**
 * Classify an invariant `Error` thrown by CreateLedgerEventUseCase / InvariantPolicy / LedgerEvent.
 * Matched on stable substrings of the messages those sites emit. All tuple/flow/matrix violations
 * fall through to `internal` — they are Treasury mapping defects, never something a user can answer.
 */
export function classifyError(message: string): RejectionDetail {
  if (/Duplicate source reference/i.test(message)) {
    return detail(RejectionCode.DUPLICATE, "duplicate", undefined, "This entry was already recorded.");
  }
  if (/Origin event not found/i.test(message)) {
    return detail(RejectionCode.ORIGIN_NOT_FOUND, "lineage", "relatedEventId", "The referenced originating entry could not be found.");
  }
  if (/must point to a/i.test(message)) {
    return detail(RejectionCode.ORIGIN_WRONG_TYPE, "lineage", "relatedEventId", "The referenced originating entry is not the expected kind.");
  }
  if (/requires relatedEventId/i.test(message)) {
    return detail(RejectionCode.LINEAGE_REQUIRED, "lineage", "relatedEventId", "This operation must reference an originating entry.");
  }
  // The target already carries a standing retraction. Terminal for the client: the correction it is
  // trying to make is already on record, so re-asking a field would not help.
  if (/already been retracted/i.test(message)) {
    return detail(RejectionCode.DUPLICATE, "duplicate", undefined, "This entry was already recorded.");
  }
  if (/Over-settlement/i.test(message)) {
    // The guard measures the position, so the limit it reports IS the outstanding balance — which
    // is what `detail` has always said. Before the guard was corrected it reported the origin
    // event's amount, and the two disagreed whenever the position had been partly settled.
    const limit = message.match(/outstanding balance of \S+ is\s*(.+?)\s*$/i)?.[1];
    return detail(RejectionCode.OVER_SETTLEMENT, "input", "amount", "The amount exceeds the outstanding balance.", limit ? { limit } : undefined);
  }
  if (/amount cannot be zero/i.test(message)) {
    return detail(RejectionCode.AMOUNT_INVALID, "input", "amount", "The amount is invalid.");
  }
  return internal();
}
