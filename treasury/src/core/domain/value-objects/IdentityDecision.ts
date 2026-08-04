/**
 * The act that authorizes a PartyId to exist. Only two of these happen in a conversation, and both
 * are deliberate: creating a new party, or declaring that the counterparty cannot be identified.
 * Associating with a party that already exists is not here — it issues nothing.
 *
 * Every conversational PartyId traces back to one of these records, with an author and a moment.
 * That is what separates "an identity was created" from "a string was typed", which is the whole
 * point: before this, the second was silently the first.
 */
export enum IdentityDecisionKind {
  /** A party the Directory did not know. The user confirmed it is genuinely new. */
  CREATE = "create",
  /**
   * The counterparty cannot be identified. Still issues a PartyId — the Ledger rejects a party
   * without one, so this can never be expressed as an absence.
   */
  UNIDENTIFIABLE = "unidentifiable",
}

export interface IdentityDecision {
  kind: IdentityDecisionKind;
  /** The PartyId this decision brought into existence. */
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
