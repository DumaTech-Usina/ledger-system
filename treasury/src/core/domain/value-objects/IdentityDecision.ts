/**
 * The act that authorizes a PartyId to exist during a conversation. Only two of these happen, and
 * both are deliberate. Choosing a party that already exists is not here: it issues nothing.
 * Registering a party is not here either: that is curation (REQ-311), and it happens outside any
 * operation.
 *
 * Every conversational PartyId traces back to one of these records, with an author and a moment.
 */
export enum IdentityDecisionKind {
  /**
   * Someone known who is not registered yet. The fact is recorded under this identity (REQ-320), the
   * notification shows until a curator links it, and a second fact with the same name reuses it.
   */
  PROVISIONAL = "provisional",
  /**
   * The counterparty cannot be identified. Still issues a PartyId — the Ledger rejects a party
   * without one, so this can never be expressed as an absence.
   */
  UNIDENTIFIABLE = "unidentifiable",
}

export interface IdentityDecision {
  kind: IdentityDecisionKind;
  /** The PartyId this decision brought into existence, or reused. */
  partyId: string;
  /** What the user actually said. Empty when they had nothing to say — a valid state. */
  mention: string;
  /** The slot the decision answers. */
  slot: string;
  /** Required for UNIDENTIFIABLE: why identification was not possible. */
  justification?: string;
  decidedBy: string;
  decidedAt: string;
  intentId: string;
}
