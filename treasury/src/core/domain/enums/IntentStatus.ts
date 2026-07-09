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
  ACCEPTED = "accepted",
  REJECTED = "rejected",
}
