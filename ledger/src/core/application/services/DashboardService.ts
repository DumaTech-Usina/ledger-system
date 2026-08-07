import { EconomicEffect } from "../../domain/enums/EconomicEffect";
import { EventType } from "../../domain/enums/EventType";
import { Money } from "../../domain/value-objects/Money";
import { LedgerEventRepository } from "../repositories/LedgerEventRepository";
import { DashboardSummary } from "../dtos/DashboardSummary";
import { PositionAggregate } from "../dtos/PositionAggregate";
import { PositionListItem } from "../dtos/PositionAggregate";
import { PositionProjectionService } from "./PositionProjectionService";
import { BookHealthService } from "./BookHealthService";
import { derivePositionStatus, computeCapitalMetrics } from "../dtos/positionUtils";

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
    // Phase 1: 3 independent DB operations in parallel.
    // findAllPositionAggregates replaces the old while-loop that fired N×2 serial CTE queries.
    // aggregatePeriodCashFlow replaces findByPeriod full entity hydration with a single GROUP BY.
    // findRecentCashMovements filters by economic_effect in SQL instead of over-fetching 4× in JS.
    const [allAggs, periodCashFlow, recentMovements] = await Promise.all([
      this.repo.findAllPositionAggregates(),
      this.repo.aggregatePeriodCashFlow(from, to),
      this.repo.findRecentCashMovements(RECENT_MOVEMENTS_LIMIT),
    ]);

    // Phase 2: health score needs allAggs for currency resolution and open-book computation.
    const healthScore = await this.bookHealthService.compute(allAggs);

    // ── Period cash flow ─────────────────────────────────────────────────────
    // periodCashFlow rows are already grouped by (event_type × economic_effect) — no accumulation needed.
    const currency = this.resolveCurrency(periodCashFlow, allAggs);
    let cashInUnits  = 0n;
    let cashOutUnits = 0n;
    const cashInByType:  Partial<Record<EventType, Money>> = {};
    const cashOutByType: Partial<Record<EventType, Money>> = {};

    for (const row of periodCashFlow) {
      if (row.currency !== currency) continue;
      if (row.economicEffect === EconomicEffect.CASH_IN) {
        cashInUnits += row.totalUnits;
        cashInByType[row.eventType] = Money.fromUnits(row.totalUnits, row.currency);
      } else if (row.economicEffect === EconomicEffect.CASH_OUT) {
        cashOutUnits += row.totalUnits;
        cashOutByType[row.eventType] = Money.fromUnits(row.totalUnits, row.currency);
      }
    }

    const cashIn  = Money.fromUnits(cashInUnits,  currency);
    const cashOut = Money.fromUnits(cashOutUnits, currency);
    const netCashUnits = cashInUnits - cashOutUnits;

    // ── Current-state position metrics ───────────────────────────────────────
    // `asOf` is passed explicitly rather than left to default: overdue is a reading of the chain at a
    // moment, and the moment belongs to the caller of the fold, not to the fold.
    const {
      openExposureUnits,
      capitalAtRiskUnits,
      openPayableExposureUnits,
      overduePayableUnits,
      upcomingPayableUnits,
      undatedPayableUnits,
    } = computeCapitalMetrics(allAggs, currency, Date.now() - THIRTY_DAYS_MS, new Date());

    const attentionAggs: PositionAggregate[] = [];
    for (const agg of allAggs) {
      if (agg.currency !== currency) continue;
      const status = derivePositionStatus(agg);
      if (status === "open" || status === "partially_settled") {
        attentionAggs.push(agg);
      }
    }

    const openExposure        = Money.fromUnits(openExposureUnits,        currency);
    const capitalAtRisk       = Money.fromUnits(capitalAtRiskUnits,       currency);
    const openPayableExposure = Money.fromUnits(openPayableExposureUnits, currency);
    const overduePayable      = Money.fromUnits(overduePayableUnits,      currency);
    const upcomingPayable     = Money.fromUnits(upcomingPayableUnits,     currency);
    const undatedPayable      = Money.fromUnits(undatedPayableUnits,      currency);

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
      openPayableExposure,
      overduePayable,
      upcomingPayable,
      undatedPayable,
      capitalAtRisk,
      cashInByType,
      cashOutByType,
      healthScore,
      attentionPositions,
      recentMovements,
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private resolveCurrency(
    periodCashFlow: Array<{ currency: string }>,
    allAggs: PositionAggregate[],
  ): string {
    return (
      periodCashFlow[0]?.currency ??
      allAggs[0]?.currency ??
      DEFAULT_CURRENCY
    );
  }

}

