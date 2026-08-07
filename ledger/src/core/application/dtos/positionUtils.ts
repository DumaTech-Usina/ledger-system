import { USINA_PAYABLE_OBJECT_TYPES } from "../../domain/policies/CashPositionPolicy";
import { PositionAggregate } from "./PositionAggregate";
import { PositionStatus } from "./PositionSummary";

/**
 * A position whose origination is unknown: some event declared its lineage unresolved and no
 * ORIGINATES is on record. The baseline is missing, so every derivation that subtracts from it is
 * unknowable — never zero. Distinct from a cash-basis payable, which has no origination because
 * none exists and claims none.
 */
export function hasUnknownOrigination(agg: PositionAggregate): boolean {
  return agg.hasUnresolvedLineage && agg.totalOriginatedUnits === 0n;
}

export function derivePositionStatus(agg: PositionAggregate): PositionStatus {
  if (agg.hasReversal) return "reversed";
  if (hasUnknownOrigination(agg)) return "unknown_origin";
  const totalClosed = agg.totalSettledUnits + agg.totalAdjustedUnits;
  if (agg.totalOriginatedUnits === 0n) return "open";
  if (totalClosed >= agg.totalOriginatedUnits) return "fully_settled";
  if (totalClosed > 0n) return "partially_settled";
  return "open";
}

/** Null when the origination is unknown — the remainder is not computable. */
export function openBalanceUnitsOf(agg: PositionAggregate): bigint | null {
  if (hasUnknownOrigination(agg)) return null;
  const totalClosed = agg.totalSettledUnits + agg.totalAdjustedUnits;
  return totalClosed >= agg.totalOriginatedUnits
    ? 0n
    : agg.totalOriginatedUnits - totalClosed;
}

/**
 * Folds the open balances into the two exposures the book keeps apart.
 *
 * `openExposure` measures what is owed TO Usina; `openPayableExposure` what Usina owes. They are
 * never added together — the sum would be a number without a meaning. Obligations became summable
 * at all only with OBLIGATION_RECOGNIZED; before it nothing originated a payable position, so
 * every aggregate fell into the first total by default.
 */
/**
 * Which of the three due-date states a payable position is in, at a given moment.
 *
 * `unknown` is a state of its own and never a synonym for either of the others. An obligation whose
 * establishing document stated no terms is not overdue (nothing says it is late) and not upcoming
 * (nothing says it is not). Folding it into either total would publish a figure the book cannot
 * support — the same reason an unknown open balance is left out of exposure rather than added as zero.
 *
 * `asOf` is a parameter because "overdue" is a reading of the chain at a moment, not a property
 * stored on the position: the same obligation is upcoming today and overdue next week with no event
 * recorded in between.
 */
export type DueState = "overdue" | "upcoming" | "unknown";

export function dueStateOf(agg: PositionAggregate, asOf: Date): DueState {
  if (agg.dueAt === null) return "unknown";
  return agg.dueAt < asOf ? "overdue" : "upcoming";
}

export function computeCapitalMetrics(
  aggs: PositionAggregate[],
  currency: string,
  riskCutoffMs: number,
  /** The moment "overdue" is read against. Defaults to the risk cutoff's own now. */
  asOf: Date = new Date(),
): {
  openExposureUnits: bigint;
  capitalAtRiskUnits: bigint;
  openPayableExposureUnits: bigint;
  /** Payables past their stated due date. Excludes those with no stated due date. */
  overduePayableUnits: bigint;
  /** Payables with a stated due date still ahead. Excludes those with no stated due date. */
  upcomingPayableUnits: bigint;
  /** Payables whose establishing fact stated no terms — summable, but neither late nor upcoming. */
  undatedPayableUnits: bigint;
} {
  const riskCutoff = new Date(riskCutoffMs);
  let openExposureUnits = 0n;
  let capitalAtRiskUnits = 0n;
  let openPayableExposureUnits = 0n;
  let overduePayableUnits = 0n;
  let upcomingPayableUnits = 0n;
  let undatedPayableUnits = 0n;
  for (const agg of aggs) {
    if (agg.currency !== currency || agg.hasReversal) continue;
    const openBalance = openBalanceUnitsOf(agg);
    // An unknown exposure is not a zero exposure — it is simply not summable. Adding it as zero
    // would understate the book; it is left out and surfaced by the position's own status.
    if (openBalance === null) continue;
    if (USINA_PAYABLE_OBJECT_TYPES.has(agg.objectType)) {
      // What Usina owes is not capital at risk: the risk of an unpaid obligation is the creditor's.
      openPayableExposureUnits += openBalance;
      // Only what is still outstanding can be late or upcoming. A settled obligation had a due date
      // too, and reporting it as overdue would be reporting a debt that no longer exists.
      if (openBalance > 0n) {
        switch (dueStateOf(agg, asOf)) {
          case "overdue":  overduePayableUnits  += openBalance; break;
          case "upcoming": upcomingPayableUnits += openBalance; break;
          case "unknown":  undatedPayableUnits  += openBalance; break;
        }
      }
      continue;
    }
    openExposureUnits += openBalance;
    if (
      openBalance > 0n &&
      agg.totalSettledUnits === 0n &&
      agg.totalAdjustedUnits === 0n &&
      agg.originatedAt !== null &&
      agg.originatedAt <= riskCutoff
    ) {
      capitalAtRiskUnits += openBalance;
    }
  }
  return {
    openExposureUnits,
    capitalAtRiskUnits,
    openPayableExposureUnits,
    overduePayableUnits,
    upcomingPayableUnits,
    undatedPayableUnits,
  };
}
