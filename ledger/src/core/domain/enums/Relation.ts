export enum Relation {
  ORIGINATES = "originates",
  ADJUSTS = "adjusts",
  SETTLES = "settles",
  REVERSES = "reverses",
  REFERENCES = "references",

  /**
   * Names the position an event speaks ABOUT without moving it. Its sole use is rectification: a
   * LEDGER_CORRECTION declares, via `relatedEventId`, that a previously recorded event never
   * corresponded to the world. The correction must name an object (every event must), but naming it
   * cannot originate, settle, adjust or cancel anything — the retraction's effect is to remove the
   * TARGET's contribution, never to add one of its own.
   *
   * It contributes nothing to any accumulator, which is why it is the only relation that leaves a
   * positional object untouched. Admitted by the LEDGER_CORRECTION contract alone.
   */
  RETRACTS = "retracts",
}
