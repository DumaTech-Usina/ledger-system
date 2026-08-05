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

/**
 * Object kinds treasury can describe a correction of. Mirrored from the backend's
 * `SUPPORTED_OBJECT_TYPES` in `core/application/use-cases/SubmitRectification.ts` — the authority
 * is there, and this copy exists only so the interface can explain the limit before a round-trip
 * instead of after a 400. Widen the backend first; this list follows.
 */
export const RECTIFIABLE_OBJECT_TYPES = ["advance", "loan", "commission_receivable"] as const;

export type Rectifiability =
  | { available: true }
  /** `unsupported` — treasury cannot describe a correction of this kind of position yet.
   *  `contextual` — the event names this position without moving it, so correcting it here would
   *  act on a position this timeline is not showing. */
  | { available: false; reason: "unsupported" | "contextual" };

/**
 * Whether this event can be rectified from this position's timeline.
 *
 * `objectType` is undefined when the position was opened by id, where no row supplied its type.
 * Unknown is not the same as unsupported — the Ledger's own stance — so the action stays offered
 * and the backend answers. Refusing on missing information would treat an absence as a fact.
 */
export function rectifiability(
  event: Pick<PositionLifecycleEvent, "relation">,
  objectType: string | undefined,
): Rectifiability {
  if (event.relation === "references") return { available: false, reason: "contextual" };
  if (objectType !== undefined && !RECTIFIABLE_OBJECT_TYPES.includes(objectType as never)) {
    return { available: false, reason: "unsupported" };
  }
  return { available: true };
}
