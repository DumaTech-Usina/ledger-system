import { Direction } from "../../domain/enums/Direction";
import { EconomicEffect } from "../../domain/enums/EconomicEffect";
import { Money } from "../../domain/value-objects/Money";
import { CashStatement } from "../dtos/CashStatement";
import { LedgerEventRepository } from "../repositories/LedgerEventRepository";
import { retractedEventIds } from "../dtos/retractionUtils";

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

    // A retracted movement never happened, so it is not in the statement. The retraction usually
    // occurs AFTER the period it corrects, so it cannot be found among the period's own events:
    // one hop finds the retractions of each cash movement, a second finds any that were themselves
    // retracted. Depth 1 guarantees there is no third, and the fold stays in retractedEventIds so
    // this service and the aggregates can never disagree about what stands.
    const periodCash = periodEvents.filter(
      (e) =>
        e.economicEffect === EconomicEffect.CASH_IN ||
        e.economicEffect === EconomicEffect.CASH_OUT,
    );
    const firstHop = (
      await Promise.all(periodCash.map((e) => this.repo.findByRelatedEventId(e.id.value)))
    ).flat();
    const secondHop = (
      await Promise.all(firstHop.map((e) => this.repo.findByRelatedEventId(e.id.value)))
    ).flat();
    const retracted = retractedEventIds([...firstHop, ...secondHop]);

    let cashInUnits = 0n;
    let cashOutUnits = 0n;

    for (const event of periodEvents) {
      if (retracted.has(event.id.value)) continue;
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
