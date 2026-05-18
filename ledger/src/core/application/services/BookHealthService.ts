import { LedgerEventRepository } from "../repositories/LedgerEventRepository";
import { BookHealthScore, HealthLabel, HealthTrend } from "../dtos/BookHealthScore";
import { PositionAggregate } from "../dtos/PositionAggregate";
import { computeCapitalMetrics } from "../dtos/positionUtils";

const WINDOW_DAYS = 90;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_CURRENCY = "BRL";

export class BookHealthService {
  constructor(private readonly repo: LedgerEventRepository) {}

  async compute(allAggs: PositionAggregate[]): Promise<BookHealthScore> {
    const now = new Date();
    const currentFrom = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const prevTo      = new Date(currentFrom.getTime() - 24 * 60 * 60 * 1000);
    const prevFrom    = new Date(prevTo.getTime()      - WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const currency = allAggs[0]?.currency ?? DEFAULT_CURRENCY;

    const [currentStats, prevStats] = await Promise.all([
      this.repo.aggregateClosureStats(currentFrom, now, currency),
      this.repo.aggregateClosureStats(prevFrom, prevTo, currency),
    ]);

    const currentLeg1 = this.computeClosureQuality(currentStats);
    const prevLeg1    = this.computeClosureQuality(prevStats);
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

  private computeClosureQuality(
    stats: { cashInSettledUnits: bigint; totalSettledUnits: bigint },
  ): number {
    return stats.totalSettledUnits === 0n
      ? 1.0
      : Number(stats.cashInSettledUnits * 10000n / stats.totalSettledUnits) / 10000;
  }

  /**
   * Leg 2: 1 − (capitalAtRisk / openExposure).
   * capitalAtRisk = open positions with zero settlement originated > 30 days ago.
   * Fully settled book defaults to 1.0.
   */
  private computeOpenBookHealth(aggs: PositionAggregate[], currency: string): number {
    const { openExposureUnits, capitalAtRiskUnits } = computeCapitalMetrics(
      aggs,
      currency,
      Date.now() - THIRTY_DAYS_MS,
    );
    return openExposureUnits === 0n
      ? 1.0
      : 1 - Number(capitalAtRiskUnits * 10000n / openExposureUnits) / 10000;
  }

  private toLabel(score: number): HealthLabel {
    if (score >= 80) return 'healthy';
    if (score >= 50) return 'at_risk';
    return 'critical';
  }

}
