import { Direction } from "../../domain/enums/Direction";
import { EconomicEffect } from "../../domain/enums/EconomicEffect";
import { Money } from "../../domain/value-objects/Money";
import { CashStatement } from "../dtos/CashStatement";
import { LedgerEventRepository } from "../repositories/LedgerEventRepository";

export class CashStatementService {
  constructor(
    private readonly repo: LedgerEventRepository,
    private readonly usinaPartyId: string,
  ) {}

  async summarize(from: Date, to: Date): Promise<CashStatement> {
    const { cashInUnits: prevIn, cashOutUnits: prevOut, currency } =
      await this.repo.aggregateCashFlowsBefore(from);

    const openingBalanceNegative = prevOut > prevIn;
    const openingUnits = openingBalanceNegative ? prevOut - prevIn : prevIn - prevOut;
    const openingBalance = Money.fromUnits(openingUnits, currency);

    const periodEvents = await this.repo.findByPeriod(from, to);
    let cashInUnits = 0n;
    let cashOutUnits = 0n;

    for (const event of periodEvents) {
      if (event.economicEffect === EconomicEffect.CASH_IN) {
        const match = event.getParties().some(
          (p) => p.partyId.value === this.usinaPartyId && p.direction === Direction.IN,
        );
        if (match) cashInUnits += event.amount.toUnits();
      } else if (event.economicEffect === EconomicEffect.CASH_OUT) {
        const match = event.getParties().some(
          (p) => p.partyId.value === this.usinaPartyId && p.direction === Direction.OUT,
        );
        if (match) cashOutUnits += event.amount.toUnits();
      }
    }

    const totalCashIn = Money.fromUnits(cashInUnits, currency);
    const totalCashOut = Money.fromUnits(cashOutUnits, currency);

    const netUnits = cashInUnits >= cashOutUnits ? cashInUnits - cashOutUnits : cashOutUnits - cashInUnits;
    const netFlow = Money.fromUnits(netUnits, currency);

    const totalIn  = prevIn  + cashInUnits;
    const totalOut = prevOut + cashOutUnits;
    const closingBalanceNegative = totalOut > totalIn;
    const closeUnits = closingBalanceNegative ? totalOut - totalIn : totalIn - totalOut;
    const closingBalance = Money.fromUnits(closeUnits, currency);

    return {
      period: { from, to },
      openingBalance,
      openingBalanceNegative,
      closingBalance,
      closingBalanceNegative,
      totalCashIn,
      totalCashOut,
      netFlow,
      currency,
    };
  }
}
