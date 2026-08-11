import type { PositionItem, PositionLifecycleEvent } from "@/types/dashboard";

/**
 * The pure decision layer for the lifecycle view — the dashboard's first, kept here rather than
 * inside a component so it can be tested without mounting anything (see ARCHITECTURE.md).
 */

/**
 * Whether this position still has something outstanding.
 *
 * The criterion is the balance, never the status. A cash-basis position — a payroll, a penalty, an
 * infrastructure expense — is reported `open` by the Ledger because nothing was originated to close
 * against, yet its balance is 0.00 and nothing is pending; the Ledger's own truth table names that
 * row "cash-basis payable — nothing originated, none claimed". Filtering by status therefore lists a
 * paid payroll under open positions, beneath a figure the Ledger computed from balances.
 *
 * This mirrors `aggregateOpenBalancesByObjectType` in the Ledger, which skips zero balances and
 * positions with no origination, and never reads status.
 *
 * A null balance is an unknown origination — not zero, and not outstanding either. The Ledger
 * refuses to fold an unknown into a total; so does this. Such a position stays visible in the full
 * positions table, where its status says plainly that its origin is unknown.
 */
export function hasOutstandingBalance(position: Pick<PositionItem, "openBalance">): boolean {
  return position.openBalance !== null && Number(position.openBalance) > 0;
}

export type Rectifiability =
  | { available: true }
  /** `unsupported` — treasury cannot describe a correction of this kind of position yet.
   *  `contextual` — the event names this position without moving it, so correcting it here would
   *  act on a position this timeline is not showing. */
  | { available: false; reason: "unsupported" | "contextual" };

/**
 * Whether this event can be rectified from this position's timeline.
 *
 * Until this was derived, the answer was a hardcoded list of object kinds copied from the backend
 * — one rule in two places, kept in step by discipline, and the very shape this work set out to
 * remove. It now comes from the position's admissible actions, which the server derives from the
 * Ledger's own algebra; widening a matrix in the Ledger reaches this screen with nothing edited.
 *
 * The object type is no longer a parameter: it decided the answer only while the answer was a list
 * of types. Keeping it would suggest it still informs something.
 *
 * Absence still means offer, not refuse. `actions` undefined — still loading — is unknown, and
 * unknown is not unsupported: that is the Ledger's own stance, and refusing on missing information
 * would treat an absence as a fact.
 */
export function rectifiability(
  event: Pick<PositionLifecycleEvent, "relation">,
  /**
   * What the server said can be recorded about this position — derived from the Ledger's algebra
   * crossed with what treasury can produce. Undefined while it is still loading, which is not the
   * same as "nothing": the action stays offered and the backend answers.
   */
  actions?: readonly { relation: string }[],
): Rectifiability {
  if (event.relation === "references") return { available: false, reason: "contextual" };
  if (actions && !actions.some((action) => action.relation === "retracts")) {
    return { available: false, reason: "unsupported" };
  }
  return { available: true };
}

/**
 * The event a `relatedEventId` points at, when it is one this position's own history contains.
 *
 * `relatedEventId` is the event THIS event speaks about — the assertion a rectification retracts, or
 * the causal origin of a settlement. On screen it is otherwise a bare id, which tells a reader that
 * a correction happened without telling them WHAT it corrected. Resolving it is what turns the
 * chain into an audit trail.
 *
 * It is resolved against the events already on hand and nothing is fetched: a rectification normally
 * retracts an event of the position being read, so the answer is almost always right here. Null
 * means one of two things the CALLER can tell apart by looking at `relatedEventId` itself — there
 * was no related event, or there was one and it belongs to a position this screen is not showing.
 * The second must be said out loud rather than rendered as an unresolved id, because a reader cannot
 * otherwise tell a missing lookup from a missing event.
 */
export function relatedEventOf(
  events: readonly PositionLifecycleEvent[],
  relatedEventId: string | null,
): PositionLifecycleEvent | null {
  if (relatedEventId === null) return null;
  return events.find((event) => event.eventId === relatedEventId) ?? null;
}

/** A correction that was started and not finished, as the position itself reveals it. */
export interface PendingCorrection {
  retractionEventId: string;
  targetEventId: string;
}

/**
 * Whether this position is halfway through a correction.
 *
 * A correction records two facts — the withdrawal and the corrected entry — and there is no
 * transaction across them, so it can be interrupted between the two. The book is then honest but
 * incomplete: the withdrawal stands, the replacement does not, and the position reads as though
 * nothing was ever originated.
 *
 * Nothing is stored to track this. The withdrawal declares it expects a sequel (`requiresFollowup`,
 * set at creation and inside the hash), and whether it is STILL pending is derived: it is pending
 * exactly while no standing entry has landed on the position after it. The moment the corrected
 * entry is recorded the condition stops holding on its own.
 *
 * Mirrors `PendingCorrection.ts` on the server, which answers the same question for the same reason.
 * The rule lives twice because both sides need it without a round trip; the two must not drift.
 */
export function pendingCorrection(
  events: readonly PositionLifecycleEvent[],
): PendingCorrection | null {
  const standing = events.filter((event) => !event.retracted);

  for (let i = standing.length - 1; i >= 0; i--) {
    const event = standing[i];
    const awaiting =
      event.relation === "retracts" && event.requiresFollowup && event.relatedEventId !== null;
    if (!awaiting) continue;

    const replaced = standing.slice(i + 1).some((later) => later.relation !== "retracts");
    return replaced
      ? null
      : { retractionEventId: event.eventId, targetEventId: event.relatedEventId! };
  }

  return null;
}
