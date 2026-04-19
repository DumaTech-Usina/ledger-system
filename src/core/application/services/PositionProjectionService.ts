import { LedgerEvent } from "../../domain/entities/LedgerEvent";
import { EconomicEffect } from "../../domain/enums/EconomicEffect";
import { Relation } from "../../domain/enums/Relation";
import { Money } from "../../domain/value-objects/Money";
import { LedgerEventRepository } from "../repositories/LedgerEventRepository";
import {
  EconomicOutcome,
  PositionStatus,
  PositionSummary,
} from "../dtos/PositionSummary";

export class PositionProjectionService {
  /** Default objectId batch size when iterating all positions. Tune via constructor. */
  static readonly DEFAULT_BATCH_SIZE = 50;

  constructor(
    private readonly repo: LedgerEventRepository,
    private readonly batchSize = PositionProjectionService.DEFAULT_BATCH_SIZE,
  ) {}

  /** Returns the projected summary for a single objectId, or null if unknown. */
  async summarize(objectId: string): Promise<PositionSummary | null> {
    const events = await this.repo.findByObjectId(objectId);
    if (events.length === 0) return null;
    return this.project(objectId, events);
  }

  /**
   * Yields one PositionSummary per known objectId, processing them in batches
   * of `batchSize` to avoid loading the entire ledger into memory at once.
   */
  async *streamAll(): AsyncGenerator<PositionSummary> {
    const allIds = await this.repo.findAllObjectIds();

    for (let offset = 0; offset < allIds.length; offset += this.batchSize) {
      const batch = allIds.slice(offset, offset + this.batchSize);

      for (const objectId of batch) {
        const events = await this.repo.findByObjectId(objectId);
        if (events.length > 0) {
          yield this.project(objectId, events);
        }
      }
    }
  }

  /** Collects all positions into an array. Prefer `streamAll()` for large ledgers. */
  async summarizeAll(): Promise<PositionSummary[]> {
    const results: PositionSummary[] = [];
    for await (const summary of this.streamAll()) {
      results.push(summary);
    }
    return results;
  }

  // ─── private ────────────────────────────────────────────────────────────────

  private project(objectId: string, events: LedgerEvent[]): PositionSummary {
    const currency = events[0].amount.currency;

    let totalOriginated = Money.zero(currency);
    let totalSettled = Money.zero(currency);
    let totalAdjusted = Money.zero(currency);
    let cashRecovered = Money.zero(currency);
    let nonCashClosed = Money.zero(currency);
    let refCashIn = Money.zero(currency);
    let refCashOut = Money.zero(currency);
    let hasReversal = false;

    for (const event of events) {
      const objects = event.getObjects().filter((o) => o.objectId.value === objectId);

      for (const obj of objects) {
        switch (obj.relation) {
          case Relation.ORIGINATES:
            totalOriginated = totalOriginated.add(event.amount);
            break;

          case Relation.SETTLES:
            totalSettled = totalSettled.add(event.amount);
            if (event.economicEffect === EconomicEffect.CASH_IN) {
              cashRecovered = cashRecovered.add(event.amount);
            } else if (event.economicEffect === EconomicEffect.NON_CASH) {
              nonCashClosed = nonCashClosed.add(event.amount);
            }
            break;

          case Relation.ADJUSTS:
            totalAdjusted = totalAdjusted.add(event.amount);
            break;

          case Relation.REVERSES:
            hasReversal = true;
            break;

          case Relation.REFERENCES:
            if (event.economicEffect === EconomicEffect.CASH_IN) {
              refCashIn = refCashIn.add(event.amount);
            } else if (event.economicEffect === EconomicEffect.CASH_OUT) {
              refCashOut = refCashOut.add(event.amount);
            }
            break;
        }
      }
    }

    const totalClosed = totalSettled.add(totalAdjusted);

    const openBalance =
      totalClosed.toUnits() >= totalOriginated.toUnits()
        ? Money.zero(currency)
        : totalOriginated.subtract(totalClosed);

    const overSettlement =
      totalOriginated.isZero() || totalClosed.toUnits() <= totalOriginated.toUnits()
        ? Money.zero(currency)
        : totalClosed.subtract(totalOriginated);

    const allocationGap =
      refCashIn.toUnits() <= refCashOut.toUnits()
        ? Money.zero(currency)
        : refCashIn.subtract(refCashOut);

    const status = this.deriveStatus(totalOriginated, totalClosed, hasReversal);
    const outcome = this.deriveOutcome(status, cashRecovered, nonCashClosed);

    return {
      objectId,
      status,
      totalOriginated,
      totalSettled,
      totalAdjusted,
      openBalance,
      overSettlement,
      cashRecovered,
      nonCashClosed,
      allocationGap,
      outcome,
      eventCount: events.length,
      events,
    };
  }

  private deriveStatus(
    originated: Money,
    totalClosed: Money,
    hasReversal: boolean,
  ): PositionStatus {
    if (hasReversal) return "reversed";
    if (originated.isZero()) return "open";
    if (totalClosed.toUnits() >= originated.toUnits()) return "fully_settled";
    if (!totalClosed.isZero()) return "partially_settled";
    return "open";
  }

  private deriveOutcome(
    status: PositionStatus,
    cashRecovered: Money,
    nonCashClosed: Money,
  ): EconomicOutcome {
    if (status === "reversed") return "cancelled";
    if (status === "open" || status === "partially_settled") return "pending";
    // fully_settled
    if (nonCashClosed.isZero()) return "gain";
    if (cashRecovered.isZero()) return "full_loss";
    return "partial_loss";
  }
}
