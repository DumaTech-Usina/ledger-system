/**
 * The Saúde Financeira screen's pure decision layer — the frontend analog of the backend's
 * `DialogEngine`/this app's other `*Engine.ts` files (see `lifecycleEngine.ts`,
 * `conversationEngine.ts`): given the numbers the dashboard already publishes, decide what the
 * gauges show and which insight sentences — with the numbers behind them — are worth surfacing. No
 * React, no fetch — every function here takes its inputs and returns its answer, which is what makes
 * it testable without mounting anything (see `financialHealthEngine.test.ts`) and keeps
 * `useFinancialHealth.ts` as the only place that touches the network.
 */

/** Below zero is the danger zone; the gap between zero and the green floor is the caution zone. */
export const CASH_GAUGE_MIN = -50_000;
/** The user's own anchor: green starts here. */
export const CASH_GAUGE_GREEN_FLOOR = 50_000;
/** Headroom past the green floor so a healthy book doesn't pin the fill at the very end of the arc. */
export const CASH_GAUGE_MAX = 150_000;

export type GaugeZone = "red" | "yellow" | "green";
/** @deprecated use `GaugeZone` — kept as an alias so existing imports keep working. */
export type CashGaugeZone = GaugeZone;

/** Which zone a net cash figure falls in — still drives the arc's single color and the status badge,
 * even though the dial itself no longer paints all three bands at once. */
export function cashGaugeZone(netCashFlow: number): GaugeZone {
  if (netCashFlow < 0) return "red";
  if (netCashFlow < CASH_GAUGE_GREEN_FLOOR) return "yellow";
  return "green";
}

/** How far along the 180°→0° arc the current value sits, as a 0–1 fraction. A value outside the
 * domain clamps to the nearest end, the way a real gauge's fill rests against its stop rather than
 * reading past 100% or below 0%. */
export function cashGaugeFillFraction(netCashFlow: number): number {
  const clamped = Math.min(CASH_GAUGE_MAX, Math.max(CASH_GAUGE_MIN, netCashFlow));
  return (clamped - CASH_GAUGE_MIN) / (CASH_GAUGE_MAX - CASH_GAUGE_MIN);
}

/** The book's composite health score is already a 0–100 scale — below this it reads as critical. */
const HEALTH_SCORE_RED_CEILING = 40;
/** Below this (and at/above the red ceiling) it reads as caution; at/above it, healthy. */
const HEALTH_SCORE_YELLOW_CEILING = 70;

/** Same three-zone read as the cash gauge, scaled to the health score's own 0–100 range. */
export function healthScoreZone(score: number): GaugeZone {
  if (score < HEALTH_SCORE_RED_CEILING) return "red";
  if (score < HEALTH_SCORE_YELLOW_CEILING) return "yellow";
  return "green";
}

/** A 0–100 score maps directly onto the 0–1 fill fraction — no separate domain to clamp against
 * like the cash gauge, since the backend already bounds `score` to 0–100. */
export function healthScoreFillFraction(score: number): number {
  return Math.min(100, Math.max(0, score)) / 100;
}

export type InsightTone = "ok" | "warn" | "bad";

/** One concrete number behind an insight — e.g. "Período anterior" → "R$ 1.000,00". Rendered as a
 * label/value line so clicking an insight always shows the real figures it was computed from,
 * instead of just restating the headline. */
export interface InsightFactor {
  label: string;
  value: string;
}

export interface FinancialInsight {
  id: string;
  tone: InsightTone;
  /** The headline — what happened. */
  text: string;
  /** The number behind it — a change, a share, a total — read alongside the headline, never buried
   * inside the sentence. Absent only for a rule with no single figure to point at. */
  detail?: string;
  /** The figures the headline was computed from — every rule produces at least one, so "what caused
   * this" always has a real answer, never a placeholder. */
  factors: InsightFactor[];
}

/** A period's cash fold, broken down by event type — the slice of `BookExposure` the insight rules
 * actually read. Optional fields mirror the backend's own optionality: absent means "not told". */
export interface CashFold {
  cashIn?: string;
  cashOut?: string;
  cashInByType?: Record<string, string>;
  cashOutByType?: Record<string, string>;
}

export interface HealthTrend {
  trend: string;
  trendDelta: number;
  /** The composite score itself and its two inputs — current-state facts, not period-scoped —
   * surfaced as factors so "o que causou a melhora/piora" has real numbers behind it. */
  score?: number;
  closureQuality?: number;
  openBookHealth?: number;
  windowDays?: number;
}

/** A category's share of an open-balance total, by object type — mirrors `OpenBalanceByObjectType`. */
export interface OpenBalanceShare {
  objectType: string;
  openBalance: string;
}

const toNumber = (value: string | undefined): number | undefined => {
  if (value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

/** Relative change from `previous` to `current`. Undefined when `previous` is absent or zero — a
 * percentage against zero (or against a fact we were never told) is not a real number. */
function percentChange(previous: number | undefined, current: number | undefined): number | undefined {
  if (previous === undefined || current === undefined || previous === 0) return undefined;
  return (current - previous) / previous;
}

/** "+45%" / "-18%" — always signed, so the direction reads without needing the headline's verb. */
function formatPercent(fraction: number): string {
  const pct = Math.round(fraction * 100);
  return `${pct >= 0 ? "+" : ""}${pct}%`;
}

/** "80%" — unsigned, for a quality/health fraction rather than a signed period-over-period delta. */
function formatUnsignedPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

/** "+5" / "-6" — a signed whole number, for the health score's own point scale (not a percentage). */
function formatSignedInt(value: number): string {
  const n = Math.round(value);
  return `${n >= 0 ? "+" : ""}${n}`;
}

/** Only worth mentioning past this — a 3% wobble is noise, not an event. */
const SIGNIFICANT_CHANGE = 0.15;
/** A category light enough not to matter, filtered out before ranking by percentage — otherwise a
 * category that moved from R$1 to R$100 would out-rank a real R$50.000 swing on percentage alone. */
const MIN_CATEGORY_AMOUNT = 500;

/** The category with the largest percentage increase, above `SIGNIFICANT_CHANGE`, ignoring
 * categories too small to matter. Null when nothing qualifies — including when either period's
 * breakdown is simply absent, which is "not told", not "nothing changed". */
function biggestCategoryIncrease(
  previous: Record<string, string> | undefined,
  current: Record<string, string> | undefined,
): { eventType: string; change: number; previous: number; current: number } | null {
  if (!previous || !current) return null;
  let best: { eventType: string; change: number; previous: number; current: number } | null = null;
  for (const [eventType, currentValue] of Object.entries(current)) {
    const cur = toNumber(currentValue);
    const prev = toNumber(previous[eventType]);
    if (cur === undefined || cur < MIN_CATEGORY_AMOUNT) continue;
    const change = percentChange(prev, cur);
    if (change === undefined || change < SIGNIFICANT_CHANGE) continue;
    if (!best || change > best.change) best = { eventType, change, previous: prev ?? 0, current: cur };
  }
  return best;
}

/** Event types whose growth reads as a specific, more informative sentence than the generic
 * "aumento na receita de {category}" — a loan or advance coming back is recovery, not new income. */
const RECOVERY_EVENT_TYPES = new Set(["loan_repayment", "advance_settlement"]);

/** Object types that represent a commission not yet in hand — accrued, split, or otherwise pending. */
const COMMISSION_OPEN_TYPES = new Set(["commission_receivable", "commission_entitlement", "commission_pool"]);
/** Commission exposure this concentrated among open receivables is worth flagging on its own. */
const COMMISSION_SHARE_THRESHOLD = 0.4;

export interface ComputeInsightsInput {
  currentPeriod: CashFold | null;
  previousPeriod: CashFold | null;
  healthTrend: HealthTrend | null;
  /** Current-state figures — the Ledger's `from`/`to` never scopes these, so there is only ever "now". */
  capitalAtRisk?: string;
  /** The book's total open exposure — paired with `capitalAtRisk` as a factor, so the risk figure
   * reads as a share of something, not just an isolated number. */
  openExposure?: string;
  overduePayable?: string;
  /** The rest of the payable pipeline — what backs the overdue figure with where the money that
   * *hasn't* gone bad yet stands. */
  upcomingPayable?: string;
  undatedPayable?: string;
  openReceivablesByType?: OpenBalanceShare[];
  /** Localizes an event/object type key — usually `t.eventType[key] ?? key`. */
  labelFor: (key: string) => string;
  copy: {
    generalSpendingUp: string;
    generalSpendingDown: string;
    generalRevenueUp: string;
    generalRevenueDown: string;
    categorySpendingUp: (category: string) => string;
    categoryRevenueUp: (category: string) => string;
    loanRecoveryHigh: string;
    advanceRecoveryHigh: string;
    commissionOpenExcess: string;
    capitalAtRisk: string;
    overduePayables: string;
    healthTrendUp: string;
    healthTrendDown: string;
    /** "{pct} em relação ao período anterior" — the detail line under every period-comparison insight. */
    vsLastPeriod: (pct: string) => string;
    /** "{pct} dos recebíveis em aberto" — the detail line under the commission-concentration insight. */
    shareOfReceivables: (pct: string) => string;
    /** "{delta} pontos" — the detail line under the health-trend insight. */
    pointsDelta: (delta: string) => string;
  };
  /** Labels for the factor lines shown when an insight is clicked open. */
  factorLabels: {
    previousPeriod: string;
    currentPeriod: string;
    variation: string;
    category: string;
    commissionOpen: string;
    totalOpenReceivables: string;
    share: string;
    capitalAtRisk: string;
    openExposure: string;
    riskShare: string;
    overduePayable: string;
    upcomingPayable: string;
    undatedPayable: string;
    healthScore: string;
    closureQuality: string;
    openBookHealth: string;
    windowDays: string;
  };
  /** Formats a decimal-string amount for the currency-bearing details/factors. */
  formatAmount: (amount: string) => string;
}

/**
 * Every insight sentence worth surfacing this period, most severe first. Each rule reads a different
 * slice of the same numbers already on the dashboard; none needs new backend surface. A rule that
 * cannot see its inputs (missing period data, no breakdown) contributes nothing — silence over a
 * guess, matching how the rest of this app treats data it was not told.
 */
export function computeInsights(input: ComputeInsightsInput): FinancialInsight[] {
  const {
    currentPeriod,
    previousPeriod,
    healthTrend,
    capitalAtRisk,
    openExposure,
    overduePayable,
    upcomingPayable,
    undatedPayable,
    openReceivablesByType,
    labelFor,
    copy,
    factorLabels: fl,
    formatAmount,
  } = input;
  const insights: FinancialInsight[] = [];

  const curOut = toNumber(currentPeriod?.cashOut);
  const prevOut = toNumber(previousPeriod?.cashOut);
  const outChange = percentChange(prevOut, curOut);
  if (outChange !== undefined && outChange >= SIGNIFICANT_CHANGE) {
    insights.push({
      id: "spending-up",
      tone: "bad",
      text: copy.generalSpendingUp,
      detail: copy.vsLastPeriod(formatPercent(outChange)),
      factors: [
        { label: fl.previousPeriod, value: formatAmount(String(prevOut)) },
        { label: fl.currentPeriod, value: formatAmount(String(curOut)) },
        { label: fl.variation, value: formatPercent(outChange) },
      ],
    });
  } else if (outChange !== undefined && outChange <= -SIGNIFICANT_CHANGE) {
    insights.push({
      id: "spending-down",
      tone: "ok",
      text: copy.generalSpendingDown,
      detail: copy.vsLastPeriod(formatPercent(outChange)),
      factors: [
        { label: fl.previousPeriod, value: formatAmount(String(prevOut)) },
        { label: fl.currentPeriod, value: formatAmount(String(curOut)) },
        { label: fl.variation, value: formatPercent(outChange) },
      ],
    });
  }

  const curIn = toNumber(currentPeriod?.cashIn);
  const prevIn = toNumber(previousPeriod?.cashIn);
  const inChange = percentChange(prevIn, curIn);
  if (inChange !== undefined && inChange >= SIGNIFICANT_CHANGE) {
    insights.push({
      id: "revenue-up",
      tone: "ok",
      text: copy.generalRevenueUp,
      detail: copy.vsLastPeriod(formatPercent(inChange)),
      factors: [
        { label: fl.previousPeriod, value: formatAmount(String(prevIn)) },
        { label: fl.currentPeriod, value: formatAmount(String(curIn)) },
        { label: fl.variation, value: formatPercent(inChange) },
      ],
    });
  } else if (inChange !== undefined && inChange <= -SIGNIFICANT_CHANGE) {
    insights.push({
      id: "revenue-down",
      tone: "bad",
      text: copy.generalRevenueDown,
      detail: copy.vsLastPeriod(formatPercent(inChange)),
      factors: [
        { label: fl.previousPeriod, value: formatAmount(String(prevIn)) },
        { label: fl.currentPeriod, value: formatAmount(String(curIn)) },
        { label: fl.variation, value: formatPercent(inChange) },
      ],
    });
  }

  const topExpense = biggestCategoryIncrease(previousPeriod?.cashOutByType, currentPeriod?.cashOutByType);
  if (topExpense) {
    insights.push({
      id: `expense-category-${topExpense.eventType}`,
      tone: "warn",
      text: copy.categorySpendingUp(labelFor(topExpense.eventType)),
      detail: copy.vsLastPeriod(formatPercent(topExpense.change)),
      factors: [
        { label: fl.category, value: labelFor(topExpense.eventType) },
        { label: fl.previousPeriod, value: formatAmount(String(topExpense.previous)) },
        { label: fl.currentPeriod, value: formatAmount(String(topExpense.current)) },
      ],
    });
  }

  const topRevenue = biggestCategoryIncrease(previousPeriod?.cashInByType, currentPeriod?.cashInByType);
  if (topRevenue) {
    const detail = copy.vsLastPeriod(formatPercent(topRevenue.change));
    const factors: InsightFactor[] = [
      { label: fl.category, value: labelFor(topRevenue.eventType) },
      { label: fl.previousPeriod, value: formatAmount(String(topRevenue.previous)) },
      { label: fl.currentPeriod, value: formatAmount(String(topRevenue.current)) },
    ];
    if (topRevenue.eventType === "loan_repayment") {
      insights.push({ id: "loan-recovery", tone: "ok", text: copy.loanRecoveryHigh, detail, factors });
    } else if (topRevenue.eventType === "advance_settlement") {
      insights.push({ id: "advance-recovery", tone: "ok", text: copy.advanceRecoveryHigh, detail, factors });
    } else if (!RECOVERY_EVENT_TYPES.has(topRevenue.eventType)) {
      insights.push({
        id: `revenue-category-${topRevenue.eventType}`,
        tone: "ok",
        text: copy.categoryRevenueUp(labelFor(topRevenue.eventType)),
        detail,
        factors,
      });
    }
  }

  if (openReceivablesByType && openReceivablesByType.length > 0) {
    const total = openReceivablesByType.reduce((sum, line) => sum + (toNumber(line.openBalance) ?? 0), 0);
    const commissionTotal = openReceivablesByType
      .filter((line) => COMMISSION_OPEN_TYPES.has(line.objectType))
      .reduce((sum, line) => sum + (toNumber(line.openBalance) ?? 0), 0);
    if (total > 0 && commissionTotal / total >= COMMISSION_SHARE_THRESHOLD) {
      insights.push({
        id: "commission-open-excess",
        tone: "warn",
        text: copy.commissionOpenExcess,
        detail: copy.shareOfReceivables(formatPercent(commissionTotal / total)),
        factors: [
          { label: fl.commissionOpen, value: formatAmount(String(commissionTotal)) },
          { label: fl.totalOpenReceivables, value: formatAmount(String(total)) },
          { label: fl.share, value: formatPercent(commissionTotal / total) },
        ],
      });
    }
  }

  const risk = toNumber(capitalAtRisk);
  if (risk !== undefined && risk > 0) {
    const factors: InsightFactor[] = [{ label: fl.capitalAtRisk, value: formatAmount(capitalAtRisk!) }];
    const openExposureNum = toNumber(openExposure);
    if (openExposureNum !== undefined && openExposureNum > 0) {
      factors.push({ label: fl.openExposure, value: formatAmount(openExposure!) });
      factors.push({ label: fl.riskShare, value: formatPercent(risk / openExposureNum) });
    }
    insights.push({ id: "capital-at-risk", tone: "warn", text: copy.capitalAtRisk, detail: formatAmount(capitalAtRisk!), factors });
  }

  const overdue = toNumber(overduePayable);
  if (overdue !== undefined && overdue > 0) {
    const factors: InsightFactor[] = [{ label: fl.overduePayable, value: formatAmount(overduePayable!) }];
    if (upcomingPayable !== undefined) factors.push({ label: fl.upcomingPayable, value: formatAmount(upcomingPayable) });
    if (undatedPayable !== undefined) factors.push({ label: fl.undatedPayable, value: formatAmount(undatedPayable) });
    insights.push({ id: "overdue-payables", tone: "bad", text: copy.overduePayables, detail: formatAmount(overduePayable!), factors });
  }

  if (healthTrend && Math.abs(healthTrend.trendDelta) >= 1) {
    const delta = copy.pointsDelta(formatSignedInt(healthTrend.trendDelta));
    const factors: InsightFactor[] = [{ label: fl.variation, value: formatSignedInt(healthTrend.trendDelta) }];
    if (healthTrend.score !== undefined) factors.push({ label: fl.healthScore, value: String(Math.round(healthTrend.score)) });
    if (healthTrend.closureQuality !== undefined) factors.push({ label: fl.closureQuality, value: formatUnsignedPercent(healthTrend.closureQuality) });
    if (healthTrend.openBookHealth !== undefined) factors.push({ label: fl.openBookHealth, value: formatUnsignedPercent(healthTrend.openBookHealth) });
    if (healthTrend.windowDays !== undefined) factors.push({ label: fl.windowDays, value: String(healthTrend.windowDays) });
    if (healthTrend.trend === "up") insights.push({ id: "health-trend-up", tone: "ok", text: copy.healthTrendUp, detail: delta, factors });
    else if (healthTrend.trend === "down") insights.push({ id: "health-trend-down", tone: "bad", text: copy.healthTrendDown, detail: delta, factors });
  }

  const severity: Record<InsightTone, number> = { bad: 0, warn: 1, ok: 2 };
  return insights.sort((a, b) => severity[a.tone] - severity[b.tone]);
}
