import { fromCents, toCents } from "@/utils/money";
import type { CashMovement } from "@/types/dashboard";

/**
 * What a movement adds to the cash balance, in cents. Only the two cash effects move money:
 * `cash_internal`, `non_cash` and `contingent` are recorded facts that left the balance where it
 * was, so they contribute zero rather than being skipped — the row still carries a balance, and it
 * is the same one as the row before it, which is exactly what happened.
 *
 * Null when the amount is not a figure that can be added. It is not treated as zero: an amount the
 * client cannot parse is an unknown movement, and the balance after it is unknowable.
 */
function delta(movement: CashMovement): bigint | null {
  if (movement.effect === "cash_in") return toCents(movement.amount);
  if (movement.effect === "cash_out") {
    const cents = toCents(movement.amount);
    return cents === null ? null : -cents;
  }
  return 0n;
}

/**
 * Chronological order — the only order a balance can be accumulated in. `occurredAt` is when the
 * money moved; `recordedAt` and the event id break ties so that the same movements always produce
 * the same balances no matter which order the caller happens to hold them in.
 */
function chronologically(a: CashMovement, b: CashMovement): number {
  if (a.occurredAt !== b.occurredAt) return a.occurredAt < b.occurredAt ? -1 : 1;
  if (a.recordedAt !== b.recordedAt) return a.recordedAt < b.recordedAt ? -1 : 1;
  return a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0;
}

/**
 * The cash balance standing immediately after each movement, keyed by event id.
 *
 * Accumulated over the movements the caller holds, sorted by when they occurred, so the result does
 * not depend on the order the table happens to render them in. The value for a movement is the
 * balance INCLUDING it: opening 1000 plus a 500 cash-in reads 1500 on that row.
 *
 * `openingBalance` is what the balance stood at before the first of these movements. It defaults to
 * zero, which is right when the list starts at the beginning of the book — the case the dashboard
 * feeds it. A caller holding a window that starts later must pass the balance before that window,
 * or every row would be short by the same amount.
 *
 * Once an unparsable amount appears, that row and every row after it come back null: a balance that
 * follows an unknown movement is not known either, and showing the previous total there would claim
 * the movement was zero.
 */
export function runningBalances(
  movements: CashMovement[],
  openingBalance = "0",
): Map<string, string | null> {
  const balances = new Map<string, string | null>();
  let running = toCents(openingBalance);

  for (const movement of [...movements].sort(chronologically)) {
    const step = delta(movement);
    running = running === null || step === null ? null : running + step;
    balances.set(movement.eventId, running === null ? null : fromCents(running));
  }

  return balances;
}
