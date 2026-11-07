/**
 * The entity axis of a Party's state — persistent, and deliberately separate from how a mention
 * resolved, which belongs to a conversation turn and never to an entity.
 */
export enum PartyIdentityState {
  /** Registered by someone with curation (REQ-311), or loaded into the registry. The normal state. */
  IDENTIFIED = "identified",
  /**
   * Someone known, not registered yet, given an identity so the fact could be recorded (REQ-320).
   * This value never changes: being resolved is derived from whether a link exists (§11.2).
   */
  PROVISIONAL = "provisional",
  /**
   * Explicitly declared not identifiable. Still a Party with its own PartyId: the Ledger rejects a
   * party without an id, so "not identifiable" can never be expressed as an absence.
   */
  UNIDENTIFIABLE = "unidentifiable",
  /** How a linked party READS (see IdentityMapping). Not stored: it follows from the link. */
  MERGED = "merged",
}
