import {
  USINA_CONTINGENT_OBJECT_TYPES,
  USINA_RECEIVABLE_OBJECT_TYPES,
} from "../../domain/policies/CashPositionPolicy";
import { Money } from "../../domain/value-objects/Money";
import { CashPositionSummary } from "../dtos/CashPositionSummary";
import { LedgerEventRepository } from "../repositories/LedgerEventRepository";

export class CashPositionService {
  constructor(private readonly repo: LedgerEventRepository) {}

  async summarize(): Promise<CashPositionSummary> {
    const { totalCashIn, totalCashOut, currency } = await this.computeRealizedFlows();
    const { openReceivables, contingentExposure } = await this.computePositionTotals(currency);

    return {
      totalCashIn,
      totalCashOut,
      openReceivables,
      contingentExposure,
      currency,
      asOf: new Date(),
    };
  }

  private async computeRealizedFlows(): Promise<{
    totalCashIn: Money;
    totalCashOut: Money;
    currency: string;
  }> {
    const { cashInUnits, cashOutUnits, currency } = await this.repo.aggregateCashFlows();
    return {
      totalCashIn:  Money.fromUnits(cashInUnits,  currency),
      totalCashOut: Money.fromUnits(cashOutUnits, currency),
      currency,
    };
  }

  private async computePositionTotals(currency: string): Promise<{
    openReceivables: Money;
    contingentExposure: Money;
  }> {
    const rows = await this.repo.aggregateOpenBalancesByObjectType();

    let openReceivables    = Money.zero(currency);
    let contingentExposure = Money.zero(currency);

    for (const { objectType, openBalanceUnits, currency: rowCurrency } of rows) {
      const amount = Money.fromUnits(openBalanceUnits, rowCurrency);
      if (USINA_RECEIVABLE_OBJECT_TYPES.has(objectType)) {
        openReceivables = openReceivables.add(amount);
      } else if (USINA_CONTINGENT_OBJECT_TYPES.has(objectType)) {
        contingentExposure = contingentExposure.add(amount);
      }
    }

    return { openReceivables, contingentExposure };
  }
}
