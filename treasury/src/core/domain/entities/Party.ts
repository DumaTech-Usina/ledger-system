import { PartyIdentityState } from "../enums/PartyIdentityState";
import type { PartyAttribute } from "../value-objects/PartyAttribute";

/**
 * The Treasury's operational identity for a counterparty — the aggregate the Party Directory owns.
 *
 * Distinct from the Ledger's LedgerEventParty, which is a party's *role inside one event* and stays
 * in the Ledger. Only `partyId` ever crosses the boundary; every attribute below stays here, because
 * names, documents and classifications are mutable operational state and the Ledger is an immutable
 * chain of financial facts.
 *
 * Phase 1 note: this is a read model. Nothing here emits a PartyId or mutates a Party — emission is
 * an explicit decision and arrives with the phase that introduces it.
 */
export interface Party {
  /** Opaque, immutable, surrogate. Issued only by the Directory. Never derived from a document. */
  partyId: string;
  identityState: PartyIdentityState;
  /** Display name / legal name. Mutable; renaming never fragments history (the id does not move). */
  displayName: string;
  /**
   * Every form this entity has already been mentioned by — including free-text identifiers already
   * written into past events. First-class infrastructure, not a convenience: this is what makes
   * deterministic grounding and legacy convergence possible.
   */
  aliases: string[];
  /** Ids in originating systems. Unique per system, not globally. */
  externalIds: { system: string; value: string }[];
  /** Keyed by PartyAttributeKey. An absent key means UNKNOWN. */
  attributes: Record<string, PartyAttribute>;
  /** Set only when identityState is MERGED — the surviving party this one resolves to. */
  mergedInto?: string;
}
