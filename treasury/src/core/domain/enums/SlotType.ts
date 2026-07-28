/** The kind of value a conversation slot collects. Drives validation + the input affordance. */
export enum SlotType {
  STRING = "string",
  MONEY = "money",
  DATE = "date",
  CHOICE = "choice",
  PARTY = "party",
  /**
   * A reference to an existing Ledger event (a settlement's origin). Like PARTY, it grounds a
   * mention to a real id; without a directory it is asked explicitly. Treasury does not verify the
   * referenced event exists — the Ledger validates lineage and a bad reference drives a re-ask.
   */
  EVENT_REF = "event_ref",
}
