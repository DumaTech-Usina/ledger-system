import { PositionAggregate } from "./PositionAggregate";
import { PositionStatus } from "./PositionSummary";

export function derivePositionStatus(agg: PositionAggregate): PositionStatus {
  if (agg.hasReversal) return "reversed";
  const totalClosed = agg.totalSettledUnits + agg.totalAdjustedUnits;
  if (agg.totalOriginatedUnits === 0n) return "open";
  if (totalClosed >= agg.totalOriginatedUnits) return "fully_settled";
  if (totalClosed > 0n) return "partially_settled";
  return "open";
}

export function openBalanceUnitsOf(agg: PositionAggregate): bigint {
  const totalClosed = agg.totalSettledUnits + agg.totalAdjustedUnits;
  return totalClosed >= agg.totalOriginatedUnits
    ? 0n
    : agg.totalOriginatedUnits - totalClosed;
}

export function computeCapitalMetrics(
  aggs: PositionAggregate[],
  currency: string,
  riskCutoffMs: number,
): { openExposureUnits: bigint; capitalAtRiskUnits: bigint } {
  const riskCutoff = new Date(riskCutoffMs);
  let openExposureUnits = 0n;
  let capitalAtRiskUnits = 0n;
  for (const agg of aggs) {
    if (agg.currency !== currency || agg.hasReversal) continue;
    const openBalance = openBalanceUnitsOf(agg);
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
  return { openExposureUnits, capitalAtRiskUnits };
}
