/**
 * Lifecycle of a user intent inside the User App. This is the *intent* lifecycle —
 * distinct from the Ledger's *fact* lifecycle. An intent only becomes a fact once a
 * candidate derived from it is accepted by the Ledger pipeline.
 */
export enum IntentStatus {
  DRAFT = "draft",
  GATHERING = "gathering",
  AWAITING_CONFIRMATION = "awaiting_confirmation",
  CONFIRMED = "confirmed",
  SUBMITTED = "submitted",
  /**
   * The Ledger rejected the candidate with a *fixable* (input/lineage) reason. The intent is not
   * terminal: the user edits the implicated slot(s) and resubmits. Distinct from REJECTED (terminal:
   * duplicate/internal) so the conversation knows to re-ask rather than end.
   */
  AWAITING_CORRECTION = "awaiting_correction",
  ACCEPTED = "accepted",
  REJECTED = "rejected",
}
