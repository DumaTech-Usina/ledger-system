import type { PositionLifecycle, PositionLifecycleEvent } from "../dtos/LedgerReadModels";

/** A correction that was started and not finished, as the position itself reveals it. */
export interface PendingCorrection {
  /** The withdrawal that is still waiting for the entry meant to replace it. */
  retractionEventId: string;
  /** The entry that was withdrawn — what the reissue is a corrected version of. */
  targetEventId: string;
}

/**
 * Whether this position is halfway through a correction.
 *
 * There is no transaction across events, so a correction that withdraws an entry and records the
 * corrected one can be interrupted between the two. The book is then honest but incomplete: the
 * withdrawal stands, the replacement does not, and the position reads as though nothing was ever
 * originated. It has to be visible and resumable, without inventing state to track it.
 *
 * Two things make that possible, and neither is stored mutable state:
 *
 *   1. The withdrawal itself declares that it expects a sequel — `reason.requiresFollowup`, the
 *      Ledger's own vocabulary for "something here is still pending". Set at creation, inside the
 *      hash, never edited.
 *   2. Whether it is STILL pending is **derived**: it is pending exactly while no standing entry has
 *      landed on the position after it. The moment the reissue is recorded the condition stops
 *      holding on its own — nothing is marked as resolved, because nothing was marked as open.
 *
 * A withdrawal that was always meant to stand alone — the only thing treasury can offer for an entry
 * it cannot record again — carries no follow-up flag and never appears here.
 */
export function pendingCorrection(lifecycle: PositionLifecycle): PendingCorrection | null {
  const standing = lifecycle.events.filter((e) => !e.retracted);

  // Ordered by the Ledger (recordedAt ascending) and passed through untouched, so "after" is just
  // "later in this list". Treasury does not re-sort what the Ledger already ordered.
  for (let i = standing.length - 1; i >= 0; i--) {
    const event = standing[i];
    if (!isAwaitingReissue(event)) continue;

    const replaced = standing.slice(i + 1).some((later) => !isRetraction(later));
    return replaced ? null : { retractionEventId: event.eventId, targetEventId: event.relatedEventId! };
  }

  return null;
}

const isRetraction = (event: PositionLifecycleEvent): boolean => event.relation === "retracts";

/**
 * A withdrawal that declared a sequel. `relatedEventId` is what it withdrew, and the Ledger requires
 * it on every retraction — but it is checked here anyway, because deriving a target from an absence
 * would be inventing one.
 */
const isAwaitingReissue = (event: PositionLifecycleEvent): boolean =>
  isRetraction(event) && event.requiresFollowup && event.relatedEventId !== null;
