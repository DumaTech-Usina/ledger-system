/**
 * One position a settlement could be pointing at, as the conversation would show it.
 *
 * A selection yields BOTH assertions at once: `objectId` is the continuity (which position this
 * fact moves) and `originEventId` is the lineage (which fact caused it). The user answers one
 * business question — *which advance?* — and never has to know that two different fields exist.
 */
export interface PositionCandidate {
  objectId: string;
  objectType: string;
  /**
   * The ORIGINATES event. Null when the Ledger holds no origination for this position, in which
   * case the position cannot supply lineage and only continuity would come from selecting it.
   */
  originEventId: string | null;
  /** The non-usina party on the originating event — who the advance was paid to. */
  counterpartyId: string | null;
  totalOriginated: string;
  /** Null when the origination is unknown — never zero. */
  openBalance: string | null;
  currency: string;
  originatedAt: string | null;
}

/**
 * Read-only boundary for "which positions could this settlement be about". Kept apart from
 * {@link LedgerReadPort} (dashboard aggregates) and {@link PositionLifecyclePort} (one object's
 * history) for the reason those two are kept apart from each other: different question, different
 * consumer. The same adapter may implement all three.
 *
 * An empty list is a legitimate answer and the expected one in most conversations — it means there
 * is nothing to offer, so nothing is asked.
 */
export interface PositionLookupPort {
  /**
   * Positions of `objectType` that a settlement could still move — open or partially settled.
   * Fully settled and reversed positions are excluded: offering them would invite a selection the
   * Ledger's own over-settlement guard would then refuse.
   */
  openPositions(objectType: string, limit?: number): Promise<PositionCandidate[]>;

  /**
   * Positions of `objectType` that were settled but that nothing ever originated — the shape a
   * payment leaves behind when it is recorded on its own. These are what a recognition arriving
   * after the payment would be supplying the missing origination for.
   *
   * The mirror image of {@link openPositions}: there, the origination stands and the settlement is
   * still owed; here, the settlement stands and the origination was never recorded. A position
   * whose origination is merely UNKNOWN is not in this list — "we know one exists and cannot name
   * it" is a different state from "none was ever recorded", and only the Ledger may collapse them.
   */
  unoriginatedPositions(objectType: string, limit?: number): Promise<PositionCandidate[]>;
}
