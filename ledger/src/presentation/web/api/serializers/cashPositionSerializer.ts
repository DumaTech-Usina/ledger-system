import {
  CashPositionSummary,
  OpenBalanceByObjectType,
} from "../../../../core/application/dtos/CashPositionSummary";
import { Money } from "../../../../core/domain/value-objects/Money";

/** Each total's composition. Additive: the totals themselves keep the values they always had. */
function serializeComposition(lines: OpenBalanceByObjectType[]) {
  return lines.map((line) => ({
    objectType: line.objectType,
    openBalance: line.openBalance.toString(),
  }));
}

export function serializeCashPosition(summary: CashPositionSummary) {
  const inUnits  = summary.totalCashIn.toUnits();
  const outUnits = summary.totalCashOut.toUnits();
  const netUnits = inUnits >= outUnits ? inUnits - outUnits : outUnits - inUnits;
  const sign     = inUnits >= outUnits ? "+" : "-";
  const netMoney = Money.fromUnits(netUnits, summary.currency);

  return {
    totalCashIn:        summary.totalCashIn.toString(),
    totalCashOut:       summary.totalCashOut.toString(),
    netCashFlow:        `${sign}${netMoney.toString()}`,
    openReceivables:    summary.openReceivables.toString(),
    openPayables:       summary.openPayables.toString(),
    contingentExposure: summary.contingentExposure.toString(),
    // What each total is made of. A consumer that ignores these reads exactly what it read before.
    openReceivablesByType:    serializeComposition(summary.openReceivablesByType),
    openPayablesByType:       serializeComposition(summary.openPayablesByType),
    contingentExposureByType: serializeComposition(summary.contingentExposureByType),
    currency:           summary.currency,
    asOf:               summary.asOf.toISOString(),
  };
}
