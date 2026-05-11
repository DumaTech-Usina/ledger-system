import { CashStatement } from "../../../../core/application/dtos/CashStatement";

export function serializeCashStatement(stmt: CashStatement) {
  return {
    period: {
      from: stmt.period.from.toISOString(),
      to:   stmt.period.to.toISOString(),
    },
    openingBalance: `${stmt.openingBalanceNegative ? '-' : ''}${stmt.openingBalance.toString()}`,
    closingBalance: `${stmt.closingBalanceNegative ? '-' : ''}${stmt.closingBalance.toString()}`,
    totalCashIn:    stmt.totalCashIn.toString(),
    totalCashOut:   stmt.totalCashOut.toString(),
    netFlow:        stmt.netFlow.toString(),
    currency:       stmt.currency,
  };
}
