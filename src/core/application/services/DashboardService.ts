import { EconomicEffect } from "../../domain/enums/EconomicEffect";
import { EventType } from "../../domain/enums/EventType";
import { Money } from "../../domain/value-objects/Money";
import { LedgerEventRepository } from "../repositories/LedgerEventRepository";
import { DashboardSummary } from "../dtos/DashboardSummary";
import { PositionAggregate } from "../dtos/PositionAggregate";
import { PositionListItem } from "../dtos/PositionAggregate";
import { PositionStatus } from "../dtos/PositionSummary";
import { PositionProjectionService } from "./PositionProjectionService";
import { BookHealthService } from "./BookHealthService";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const RECENT_MOVEMENTS_LIMIT = 8;
const ATTENTION_POSITIONS_LIMIT = 6;
const DEFAULT_CURRENCY = "BRL";

export class DashboardService {
  constructor(
    private readonly repo: LedgerEventRepository,
    private readonly positionService: PositionProjectionService,
    private readonly bookHealthService: BookHealthService,
  ) {}

  async compute(from: Date, to: Date): Promise<DashboardSummary> {
    const riskCutoff = new Date(Date.now() - THIRTY_DAYS_MS);

    const [periodEvents, allAggs, recentMovements, healthScore] = await Promise.all([
      this.repo.findByPeriod(from, to),
      this.loadAllPositionAggregates(),
      this.loadRecentMovements(),
      this.bookHealthService.compute(),
    ]);

    // ── Period cash flow ─────────────────────────────────────────────────────
    const currency = this.resolveCurrency(periodEvents, allAggs);
    let cashInUnits  = 0n;
    let cashOutUnits = 0n;
    const cashInByType:  Partial<Record<EventType, Money>> = {};
    const cashOutByType: Partial<Record<EventType, Money>> = {};

    for (const ev of periodEvents) {
      if (ev.amount.currency !== currency) continue;
      const units = ev.amount.toUnits();

      if (ev.economicEffect === EconomicEffect.CASH_IN) {
        cashInUnits += units;
        const prev = cashInByType[ev.eventType];
        cashInByType[ev.eventType] = prev ? prev.add(ev.amount) : ev.amount;
      } else if (ev.economicEffect === EconomicEffect.CASH_OUT) {
        cashOutUnits += units;
        const prev = cashOutByType[ev.eventType];
        cashOutByType[ev.eventType] = prev ? prev.add(ev.amount) : ev.amount;
      }
    }

    const cashIn  = Money.fromUnits(cashInUnits,  currency);
    const cashOut = Money.fromUnits(cashOutUnits, currency);
    const netCashUnits = cashInUnits - cashOutUnits;

    // ── Current-state position metrics ───────────────────────────────────────
    let openExposureUnits  = 0n;
    let capitalAtRiskUnits = 0n;
    const attentionAggs: PositionAggregate[] = [];

    for (const agg of allAggs) {
      if (agg.currency !== currency) continue;

      const status = this.deriveStatus(agg);
      const totalClosed = agg.totalSettledUnits + agg.totalAdjustedUnits;
      const openBalanceUnits =
        totalClosed >= agg.totalOriginatedUnits
          ? 0n
          : agg.totalOriginatedUnits - totalClosed;

      openExposureUnits += openBalanceUnits;

      // capitalAtRisk: no settlement at all + originated > 30 days ago
      if (
        status === "open" &&
        agg.totalSettledUnits === 0n &&
        agg.totalAdjustedUnits === 0n &&
        agg.originatedAt !== null &&
        agg.originatedAt <= riskCutoff
      ) {
        capitalAtRiskUnits += openBalanceUnits;
      }

      if (status === "open" || status === "partially_settled") {
        attentionAggs.push(agg);
      }
    }

    const openExposure  = Money.fromUnits(openExposureUnits,  currency);
    const capitalAtRisk = Money.fromUnits(capitalAtRiskUnits, currency);

    // ── Attention positions: sorted oldest-origination first ─────────────────
    attentionAggs.sort((a, b) => {
      const aMs = a.originatedAt?.getTime() ?? 0;
      const bMs = b.originatedAt?.getTime() ?? 0;
      return aMs - bMs;
    });
    const attentionPositions: PositionListItem[] = attentionAggs
      .slice(0, ATTENTION_POSITIONS_LIMIT)
      .map((agg) => this.positionService.aggregateToListItem(agg));

    return {
      period: { from, to },
      currency,
      cashIn,
      cashOut,
      netCashUnits,
      openExposure,
      capitalAtRisk,
      cashInByType,
      cashOutByType,
      healthScore,
      attentionPositions,
      recentMovements,
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async loadAllPositionAggregates(): Promise<PositionAggregate[]> {
    const all: PositionAggregate[] = [];
    let page = 1;
    while (true) {
      const result = await this.repo.findPositionAggregates({ page, limit: 200 });
      all.push(...result.data);
      if (page >= result.totalPages) break;
      page++;
    }
    return all;
  }

  private async loadRecentMovements() {
    const result = await this.repo.findPaginated({
      page: 1,
      limit: RECENT_MOVEMENTS_LIMIT * 4,
      sortBy: "occurredAt",
      sortOrder: "DESC",
    });
    return result.data
      .filter(
        (e) =>
          e.economicEffect === EconomicEffect.CASH_IN ||
          e.economicEffect === EconomicEffect.CASH_OUT,
      )
      .slice(0, RECENT_MOVEMENTS_LIMIT);
  }

  private resolveCurrency(
    periodEvents: Awaited<ReturnType<LedgerEventRepository["findByPeriod"]>>,
    allAggs: PositionAggregate[],
  ): string {
    return (
      periodEvents[0]?.amount.currency ??
      allAggs[0]?.currency ??
      DEFAULT_CURRENCY
    );
  }

  private deriveStatus(agg: PositionAggregate): PositionStatus {
    if (agg.hasReversal) return "reversed";
    const totalClosed = agg.totalSettledUnits + agg.totalAdjustedUnits;
    if (agg.totalOriginatedUnits === 0n) return "open";
    if (totalClosed >= agg.totalOriginatedUnits) return "fully_settled";
    if (totalClosed > 0n) return "partially_settled";
    return "open";
  }
}
