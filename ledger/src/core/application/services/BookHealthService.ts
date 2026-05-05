import { EconomicEffect } from "../../domain/enums/EconomicEffect";
import { Relation } from "../../domain/enums/Relation";
import { LedgerEventRepository } from "../repositories/LedgerEventRepository";
import { BookHealthScore, HealthLabel, HealthTrend } from "../dtos/BookHealthScore";
import { PositionAggregate } from "../dtos/PositionAggregate";

const WINDOW_DAYS = 90;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_CURRENCY = "BRL";

export class BookHealthService {
  constructor(private readonly repo: LedgerEventRepository) {}

  async compute(): Promise<BookHealthScore> {
    const now = new Date();
    const currentFrom = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const prevTo      = new Date(currentFrom.getTime() - 24 * 60 * 60 * 1000);
    const prevFrom    = new Date(prevTo.getTime()      - WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const [currentWindow, prevWindow, allAggs] = await Promise.all([
      this.repo.findByPeriod(currentFrom, now),
      this.repo.findByPeriod(prevFrom, prevTo),
      this.loadAllAggregates(),
    ]);

    const currency = allAggs[0]?.currency ?? currentWindow[0]?.amount.currency ?? DEFAULT_CURRENCY;

    const currentLeg1 = this.computeClosureQuality(currentWindow, currency);
    const prevLeg1    = this.computeClosureQuality(prevWindow,    currency);
    const leg2        = this.computeOpenBookHealth(allAggs, currency);

    const score  = Math.round((currentLeg1 * 0.4 + leg2 * 0.6) * 1000) / 10;
    const label  = this.toLabel(score);
    const delta  = Math.round((currentLeg1 - prevLeg1) * 1000) / 10;
    const trend: HealthTrend = delta > 2 ? 'up' : delta < -2 ? 'down' : 'stable';

    return {
      score,
      label,
      trend,
      trendDelta: delta,
      closureQuality: Math.round(currentLeg1 * 1000) / 1000,
      openBookHealth: Math.round(leg2 * 1000) / 1000,
      windowDays: WINDOW_DAYS,
    };
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  /**
   * Leg 1: ratio of CASH_IN settlements to all settlements in the window.
   * SETTLES is object-level (event.objects.some(o => o.relation === SETTLES)).
   * Young book with no settlements defaults to 1.0 (no penalty).
   */
  private computeClosureQuality(
    events: Awaited<ReturnType<LedgerEventRepository["findByPeriod"]>>,
    currency: string,
  ): number {
    let cashInSettledUnits = 0n;
    let totalSettledUnits  = 0n;

    for (const ev of events) {
      if (ev.amount.currency !== currency) continue;
      const hasSettles = ev.getObjects().some(o => o.relation === Relation.SETTLES);
      if (!hasSettles) continue;

      totalSettledUnits += ev.amount.toUnits();
      if (ev.economicEffect === EconomicEffect.CASH_IN) {
        cashInSettledUnits += ev.amount.toUnits();
      }
    }

    return totalSettledUnits === 0n ? 1.0 : Number(cashInSettledUnits * 10000n / totalSettledUnits) / 10000;
  }

  /**
   * Leg 2: 1 − (capitalAtRisk / openExposure).
   * capitalAtRisk = open positions with zero settlement originated > 30 days ago.
   * Fully settled book defaults to 1.0.
   */
  private computeOpenBookHealth(aggs: PositionAggregate[], currency: string): number {
    const riskCutoff = new Date(Date.now() - THIRTY_DAYS_MS);
    let openExposureUnits  = 0n;
    let capitalAtRiskUnits = 0n;

    for (const agg of aggs) {
      if (agg.currency !== currency || agg.hasReversal) continue;

      const totalClosed = agg.totalSettledUnits + agg.totalAdjustedUnits;
      const openBalanceUnits =
        totalClosed >= agg.totalOriginatedUnits
          ? 0n
          : agg.totalOriginatedUnits - totalClosed;

      openExposureUnits += openBalanceUnits;

      if (
        openBalanceUnits > 0n &&
        agg.totalSettledUnits === 0n &&
        agg.totalAdjustedUnits === 0n &&
        agg.originatedAt !== null &&
        agg.originatedAt <= riskCutoff
      ) {
        capitalAtRiskUnits += openBalanceUnits;
      }
    }

    return openExposureUnits === 0n
      ? 1.0
      : 1 - Number(capitalAtRiskUnits * 10000n / openExposureUnits) / 10000;
  }

  private toLabel(score: number): HealthLabel {
    if (score >= 80) return 'saudável';
    if (score >= 50) return 'em_atencao';
    return 'crítico';
  }

  private async loadAllAggregates(): Promise<PositionAggregate[]> {
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
}
