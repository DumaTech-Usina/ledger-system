/**
 * The entity axis of a Party's state — persistent, and deliberately separate from the dialog axis
 * (unresolved/ambiguous/resolved, which belongs to a conversation turn and never to an entity) and
 * from enrichment completeness (which is *derived* from the attributes, never stored).
 */
export enum PartyIdentityState {
  /** Has a PartyId through an explicit decision or an import. The normal state. */
  IDENTIFIED = "identified",
  /**
   * Explicitly declared not identifiable. Still a Party with its own PartyId: the Ledger rejects a
   * party without an id, so "not identifiable" can never be expressed as an absence.
   */
  UNIDENTIFIABLE = "unidentifiable",
  /** Superseded by another Party. Never deleted; still resolves, pointing at the survivor. */
  MERGED = "merged",
}
