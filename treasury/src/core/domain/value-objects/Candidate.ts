/**
 * A Ledger-compatible candidate derived from a confirmed intent. Its shape mirrors the Ledger's
 * StagingRecord essentials so mapping is lossless.
 *
 * IMPORTANT: treasury does NOT import Ledger code (bounded-context separation). The string values
 * used here are the Ledger's *published vocabulary* — which the User App↔Ledger integration
 * contract will formalize. Until then, the per-scenario economic tuple (eventType, economicEffect,
 * roles, relation, reason) is PROVISIONAL: the Ledger gate remains the sole authority and will
 * reject an invalid tuple. See CandidateMapper.
 */
export interface CandidateParty {
  partyId: string;
  role: string;
  direction: string;
  amount?: string;
}

export interface CandidateObject {
  objectId: string;
  objectType: string;
  relation: string;
}

export interface Candidate {
  sourceReference: string;
  eventType: string;
  economicEffect: string;
  occurredAt: string;
  amount: string;
  currency: string;
  description?: string;
  /**
   * Causal origin link for a settlement (e.g. a commission_received → its commission_expected).
   * Absent when the operation has no lineage, or when it is an explicit orphan (unresolved lineage,
   * carried by an UNKNOWN_ORIGIN reason). The Ledger validates it; Treasury never fabricates one.
   */
  relatedEventId?: string;
  parties: CandidateParty[];
  objects: CandidateObject[];
  reason: { type: string; description: string; confidence: string; requiresFollowup: boolean };
  reporter: { reporterType: string; reporterId: string; channel: string };
}
