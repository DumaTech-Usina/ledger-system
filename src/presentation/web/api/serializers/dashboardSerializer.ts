import { DashboardSummary } from "../../../../core/application/dtos/DashboardSummary";
import { serializePositionListItem } from "./positionSerializer";
import { serializeEvent } from "./eventSerializer";

export function serializeDashboard(summary: DashboardSummary) {
  const netCashAbs = summary.netCashUnits < 0n ? -summary.netCashUnits : summary.netCashUnits;

  return {
    period: {
      from: summary.period.from.toISOString(),
      to:   summary.period.to.toISOString(),
    },
    currency: summary.currency,

    // Zone 1
    cashIn:          summary.cashIn.toString(),
    cashOut:         summary.cashOut.toString(),
    netCash:         Money_unitsToString(netCashAbs, summary.currency),
    netCashNegative: summary.netCashUnits < 0n,
    openExposure:    summary.openExposure.toString(),
    capitalAtRisk:   summary.capitalAtRisk.toString(),

    // Zone 2
    cashInByType: serializeMoneyMap(summary.cashInByType),
    cashOutByType: serializeMoneyMap(summary.cashOutByType),
    recoveryRate: summary.recoveryRate,

    // Zone 3
    attentionPositions: summary.attentionPositions.map(serializePositionListItem),
    recentMovements:    summary.recentMovements.map(serializeEvent),
  };
}

function serializeMoneyMap(
  map: Readonly<Partial<Record<string, { toString(): string }>>>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(map)) {
    if (val) out[key] = val.toString();
  }
  return out;
}

function Money_unitsToString(units: bigint, _currency: string): string {
  const factor = 100n;
  const integer = units / factor;
  const decimal = units % factor;
  return `${integer}.${decimal.toString().padStart(2, "0")}`;
}
