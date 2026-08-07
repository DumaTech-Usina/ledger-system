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
export function computeCapitalMetrics(
  aggs: PositionAggregate[],
  currency: string,
  riskCutoffMs: number,
): { openExposureUnits: bigint; capitalAtRiskUnits: bigint; openPayableExposureUnits: bigint } {
  const riskCutoff = new Date(riskCutoffMs);
  let openExposureUnits = 0n;
  let capitalAtRiskUnits = 0n;
  let openPayableExposureUnits = 0n;
  for (const agg of aggs) {
    if (agg.currency !== currency || agg.hasReversal) continue;
    const openBalance = openBalanceUnitsOf(agg);
    // An unknown exposure is not a zero exposure — it is simply not summable. Adding it as zero
    // would understate the book; it is left out and surfaced by the position's own status.
    if (openBalance === null) continue;
    if (USINA_PAYABLE_OBJECT_TYPES.has(agg.objectType)) {
      // What Usina owes is not capital at risk: the risk of an unpaid obligation is the creditor's.
      openPayableExposureUnits += openBalance;
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
  return { openExposureUnits, capitalAtRiskUnits, openPayableExposureUnits };
}
