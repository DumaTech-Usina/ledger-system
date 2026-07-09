/** The kind of value a conversation slot collects. Drives validation + the input affordance. */
export enum SlotType {
  STRING = "string",
  MONEY = "money",
  DATE = "date",
  CHOICE = "choice",
  PARTY = "party",
}
