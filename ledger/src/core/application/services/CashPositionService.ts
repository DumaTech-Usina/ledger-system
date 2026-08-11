import {
  USINA_CONTINGENT_OBJECT_TYPES,
  USINA_PAYABLE_OBJECT_TYPES,
  USINA_RECEIVABLE_OBJECT_TYPES,
} from "../../domain/policies/CashPositionPolicy";
import { Money } from "../../domain/value-objects/Money";
import { CashPositionSummary, OpenBalanceByObjectType } from "../dtos/CashPositionSummary";
import { LedgerEventRepository } from "../repositories/LedgerEventRepository";

export class CashPositionService {
  constructor(private readonly repo: LedgerEventRepository) {}

  async summarize(): Promise<CashPositionSummary> {
    const { totalCashIn, totalCashOut, currency } = await this.computeRealizedFlows();
    const totals = await this.computePositionTotals(currency);

    return {
      totalCashIn,
      totalCashOut,
      ...totals,
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

  /**
   * The three totals, and the per-type lines each of them is folded from.
   *
   * The lines are not a second derivation: they are the very rows the totals are summed over, kept
   * instead of discarded. A type belonging to no policy set contributes to no total and appears in
   * no list — the documented consequence of the three sets, unchanged here.
   */
  private async computePositionTotals(currency: string): Promise<{
    openReceivables: Money;
    openPayables: Money;
    contingentExposure: Money;
    openReceivablesByType: OpenBalanceByObjectType[];
    openPayablesByType: OpenBalanceByObjectType[];
    contingentExposureByType: OpenBalanceByObjectType[];
  }> {
    const rows = await this.repo.aggregateOpenBalancesByObjectType();

    let openReceivables    = Money.zero(currency);
    let openPayables       = Money.zero(currency);
    let contingentExposure = Money.zero(currency);

    const openReceivablesByType:    OpenBalanceByObjectType[] = [];
    const openPayablesByType:       OpenBalanceByObjectType[] = [];
    const contingentExposureByType: OpenBalanceByObjectType[] = [];

    for (const { objectType, openBalanceUnits, currency: rowCurrency } of rows) {
      const amount = Money.fromUnits(openBalanceUnits, rowCurrency);
      if (USINA_RECEIVABLE_OBJECT_TYPES.has(objectType)) {
        openReceivables = openReceivables.add(amount);
        openReceivablesByType.push({ objectType, openBalance: amount });
      } else if (USINA_PAYABLE_OBJECT_TYPES.has(objectType)) {
        openPayables = openPayables.add(amount);
        openPayablesByType.push({ objectType, openBalance: amount });
      } else if (USINA_CONTINGENT_OBJECT_TYPES.has(objectType)) {
        contingentExposure = contingentExposure.add(amount);
        contingentExposureByType.push({ objectType, openBalance: amount });
      }
    }

    return {
      openReceivables,
      openPayables,
      contingentExposure,
      // Largest first: the composition is read to find where the weight is. The tie-break on type
      // keeps the order stable between two reads of an unchanged book.
      openReceivablesByType:    sortByWeight(openReceivablesByType),
      openPayablesByType:       sortByWeight(openPayablesByType),
      contingentExposureByType: sortByWeight(contingentExposureByType),
    };
  }
}

function sortByWeight(lines: OpenBalanceByObjectType[]): OpenBalanceByObjectType[] {
  return [...lines].sort((a, b) => {
    const delta = b.openBalance.toUnits() - a.openBalance.toUnits();
    if (delta !== 0n) return delta > 0n ? 1 : -1;
    return a.objectType.localeCompare(b.objectType);
  });
}
