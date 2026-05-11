import { CashPositionSummary } from "../../../../core/application/dtos/CashPositionSummary";
import { Money } from "../../../../core/domain/value-objects/Money";

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
    contingentExposure: summary.contingentExposure.toString(),
    currency:           summary.currency,
    asOf:               summary.asOf.toISOString(),
  };
}
