/**
 * "This identifier is that party" (REQ-330), as one written fact of the Treasury's: who said it and
 * when. Links are only ever added (REQ-331). A provisional identity counts as resolved because a link
 * exists for it, not because anything about it was overwritten, and what the Ledger recorded under
 * the old identifier stays exactly as it is (REQ-332).
 */
export interface IdentityLink {
  id: string;
  /** A provisional or unidentifiable PartyId, or any identifier already written in the Ledger. */
  fromIdentifier: string;
  toPartyId: string;
  linkedBy: string;
  linkedAt: string;
}
