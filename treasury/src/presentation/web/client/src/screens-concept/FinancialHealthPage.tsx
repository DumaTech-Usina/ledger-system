import { useState } from "react";
import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/Badge";
import { Card } from "@/components/Card";
import { Modal } from "@/components/Modal";
import { Table } from "@/components/Table";
import { RowDetailModal } from "@/features/dashboard/RowDetailModal";
import { statusTone } from "@/features/dashboard/lifecycleEngine";
import { CashGauge } from "@/screens-concept/CashGauge";
import { HealthScoreGauge } from "@/screens-concept/HealthScoreGauge";
import { computeInsights, type CashFold, type FinancialInsight, type InsightTone } from "@/screens-concept/financialHealthEngine";
import { useFinancialHealth } from "@/screens-concept/useFinancialHealth";
import { formatTemplate, useLanguage } from "@/i18n/i18n";
import { cn } from "@/utils/cn";
import { formatMoney } from "@/utils/format";
import type { PositionItem } from "@/types/dashboard";

const TOP_ROWS = 8;

/** One icon-in-a-chip per tone — the color carries identity here, never the headline text (see the
 * dataviz guidance this project follows: "text wears text tokens, a colored mark beside it carries
 * identity"). Only the detail number underneath is colored, which is where this screen's own request
 * for "colored text" actually reads best — a signed delta, the way a ticker colors it. */
const toneIcon: Record<InsightTone, typeof TrendingUp> = {
  ok: TrendingUp,
  warn: AlertTriangle,
  bad: TrendingDown,
};
const toneChipBg: Record<InsightTone, string> = {
  ok: "bg-ok-soft",
  warn: "bg-warn-soft",
  bad: "bg-bad-soft",
};
const toneIconColor: Record<InsightTone, string> = {
  ok: "text-ok",
  warn: "text-warn",
  bad: "text-bad",
};
const toneDetailColor: Record<InsightTone, string> = {
  ok: "text-ok",
  warn: "text-warn",
  bad: "text-bad",
};

function toFold(exposure: { cashIn?: string; cashOut?: string; cashInByType?: Record<string, string>; cashOutByType?: Record<string, string> } | null): CashFold | null {
  if (!exposure) return null;
  return {
    cashIn: exposure.cashIn,
    cashOut: exposure.cashOut,
    cashInByType: exposure.cashInByType,
    cashOutByType: exposure.cashOutByType,
  };
}

/**
 * A gauge for the current cash position, a rule-based summary of what changed against the prior
 * window, and two ranked tables that back up whatever the summary claims. Every figure on this
 * screen already exists on `dashboardApi` — see `useFinancialHealth.ts` — this is a second read of
 * it, not a new source of truth.
 */
export function FinancialHealthPage() {
  const { t } = useLanguage();
  const { data, loading } = useFinancialHealth();
  const [selectedPosition, setSelectedPosition] = useState<PositionItem | null>(null);
  const [selectedInsight, setSelectedInsight] = useState<FinancialInsight | null>(null);

  const cashPosition = data?.cashPosition ?? null;
  const currentExposure = data?.currentExposure ?? null;
  const currentPeriod = toFold(data?.currentPeriodExposure ?? null);
  const previousPeriod = toFold(data?.previousPeriodExposure ?? null);
  const currency = cashPosition?.currency ?? currentExposure?.currency ?? "BRL";

  const insights = computeInsights({
    currentPeriod,
    previousPeriod,
    healthTrend: currentExposure?.healthScore
      ? {
          trend: currentExposure.healthScore.trend,
          trendDelta: currentExposure.healthScore.trendDelta,
          score: currentExposure.healthScore.score,
          closureQuality: currentExposure.healthScore.closureQuality,
          openBookHealth: currentExposure.healthScore.openBookHealth,
          windowDays: currentExposure.healthScore.windowDays,
        }
      : null,
    capitalAtRisk: currentExposure?.capitalAtRisk,
    openExposure: currentExposure?.openExposure,
    overduePayable: currentExposure?.overduePayable,
    upcomingPayable: currentExposure?.upcomingPayable,
    undatedPayable: currentExposure?.undatedPayable,
    openReceivablesByType: cashPosition?.openReceivablesByType,
    labelFor: (key) => t.eventType[key] ?? key,
    copy: {
      generalSpendingUp: t.financialHealth.insights.generalSpendingUp,
      generalSpendingDown: t.financialHealth.insights.generalSpendingDown,
      generalRevenueUp: t.financialHealth.insights.generalRevenueUp,
      generalRevenueDown: t.financialHealth.insights.generalRevenueDown,
      categorySpendingUp: (category) => formatTemplate(t.financialHealth.insights.categorySpendingUp, { category }),
      categoryRevenueUp: (category) => formatTemplate(t.financialHealth.insights.categoryRevenueUp, { category }),
      loanRecoveryHigh: t.financialHealth.insights.loanRecoveryHigh,
      advanceRecoveryHigh: t.financialHealth.insights.advanceRecoveryHigh,
      commissionOpenExcess: t.financialHealth.insights.commissionOpenExcess,
      capitalAtRisk: t.financialHealth.insights.capitalAtRisk,
      overduePayables: t.financialHealth.insights.overduePayables,
      healthTrendUp: t.financialHealth.insights.healthTrendUp,
      healthTrendDown: t.financialHealth.insights.healthTrendDown,
      vsLastPeriod: (pct) => formatTemplate(t.financialHealth.insights.vsLastPeriod, { pct }),
      shareOfReceivables: (pct) => formatTemplate(t.financialHealth.insights.shareOfReceivables, { pct }),
      pointsDelta: (delta) => formatTemplate(t.financialHealth.insights.pointsDelta, { delta }),
    },
    factorLabels: t.financialHealth.insights.factors,
    formatAmount: (amount) => formatMoney(amount, currency),
  });

  const expenseRows = currentPeriod?.cashOutByType
    ? Object.entries(currentPeriod.cashOutByType)
        .map(([eventType, amount]) => ({ eventType, amount: Number(amount) }))
        .filter((row) => Number.isFinite(row.amount) && row.amount > 0)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, TOP_ROWS)
    : null;
  const expenseTotal = expenseRows?.reduce((sum, row) => sum + row.amount, 0) ?? 0;

  const openPositionRows = (data?.openPositions ?? [])
    .map((position) => ({ position, balance: Number(position.openBalance ?? "0") }))
    .filter((row) => Number.isFinite(row.balance) && row.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, TOP_ROWS);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl font-semibold text-ink">{t.financialHealth.heading}</h2>
        <p className="mt-1 text-sm text-muted">{t.financialHealth.subheading}</p>
      </div>

      {loading ? (
        <Card>
          <p className="text-sm text-muted">{t.common.loading}</p>
        </Card>
      ) : (
        <>
          {/* 13fr/7fr = a 65/35 split of the row (fr shares the space left after the gap, so this
              holds exactly at any width, unlike percentage columns). */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[13fr_7fr]">
            <Card padding="lg" className="flex flex-col justify-center">
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
                <div className="flex flex-col items-center">
                  {cashPosition ? (
                    <CashGauge
                      netCashFlow={Number(cashPosition.netCashFlow)}
                      currency={currency}
                      title={t.financialHealth.gauge.cashTitle}
                      maxWidth={340}
                    />
                  ) : (
                    <>
                      <p className="w-full text-center text-[13px] font-semibold text-muted">{t.financialHealth.gauge.cashTitle}</p>
                      <p className="mt-6 text-sm text-muted">{t.financialHealth.gauge.unavailable}</p>
                    </>
                  )}
                </div>
                <div className="flex flex-col items-center">
                  {currentExposure?.healthScore ? (
                    <HealthScoreGauge score={currentExposure.healthScore.score} title={t.financialHealth.gauge.scoreTitle} maxWidth={340} />
                  ) : (
                    <>
                      <p className="w-full text-center text-[13px] font-semibold text-muted">{t.financialHealth.gauge.scoreTitle}</p>
                      <p className="mt-6 text-sm text-muted">{t.financialHealth.gauge.scoreUnavailable}</p>
                    </>
                  )}
                </div>
              </div>
            </Card>

            <Card>
              <p className="font-display text-[17px] font-semibold text-ink">{t.financialHealth.insights.title}</p>
              <p className="text-[12.5px] text-muted">{t.financialHealth.insights.subtitle}</p>
              {!currentPeriod || !previousPeriod ? (
                <p className="mt-4 text-sm text-muted">{t.financialHealth.insights.unavailable}</p>
              ) : insights.length === 0 ? (
                <p className="mt-4 text-sm text-muted">{t.financialHealth.insights.empty}</p>
              ) : (
                <ul className="mt-5 flex flex-col gap-2">
                  {insights.map((insight) => {
                    const Icon = toneIcon[insight.tone];
                    return (
                      <li key={insight.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedInsight(insight)}
                          className="flex w-full items-center gap-3.5 rounded-2xl p-2 -m-2 text-left transition hover:bg-ink/4 dark:hover:bg-white/6"
                        >
                          <span
                            aria-hidden
                            className={cn(
                              "grid size-10 flex-shrink-0 place-items-center rounded-full",
                              toneChipBg[insight.tone],
                            )}
                          >
                            <Icon className={cn("size-[18px]", toneIconColor[insight.tone])} strokeWidth={2} />
                          </span>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[15px] font-semibold leading-snug text-ink">{insight.text}</span>
                            {insight.detail && (
                              <span className={cn("tabular text-[13px] font-semibold", toneDetailColor[insight.tone])}>
                                {insight.detail}
                              </span>
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card padding="none">
              <div className="border-b border-line px-5 py-4">
                <p className="text-[13px] font-semibold text-ink">{t.financialHealth.topExpenseCategories.title}</p>
                <p className="text-[12px] text-muted">{t.financialHealth.topExpenseCategories.subtitle}</p>
              </div>
              <Table.Root>
                <Table.Head>
                  <Table.Row>
                    <Table.HeaderCell>{t.financialHealth.topExpenseCategories.category}</Table.HeaderCell>
                    <Table.HeaderCell>{t.financialHealth.topExpenseCategories.amount}</Table.HeaderCell>
                    <Table.HeaderCell>{t.financialHealth.topExpenseCategories.share}</Table.HeaderCell>
                  </Table.Row>
                </Table.Head>
                <Table.Body>
                  {expenseRows === null ? (
                    <Table.Row>
                      <Table.Cell colSpan={3} className="text-center text-muted">
                        {t.financialHealth.topExpenseCategories.unavailable}
                      </Table.Cell>
                    </Table.Row>
                  ) : expenseRows.length === 0 ? (
                    <Table.Row>
                      <Table.Cell colSpan={3} className="text-center text-muted">
                        {t.financialHealth.topExpenseCategories.empty}
                      </Table.Cell>
                    </Table.Row>
                  ) : (
                    expenseRows.map((row) => {
                      const share = expenseTotal > 0 ? (row.amount / expenseTotal) * 100 : 0;
                      return (
                        <Table.Row key={row.eventType}>
                          <Table.Cell className="text-ink">{t.eventType[row.eventType] ?? row.eventType}</Table.Cell>
                          <Table.Cell mono>{formatMoney(String(row.amount), currency)}</Table.Cell>
                          <Table.Cell>
                            {expenseTotal > 0 ? (
                              <div className="flex items-center gap-2.5">
                                <span className="tabular w-8 shrink-0 text-muted">{share.toFixed(0)}%</span>
                                {/* Same fill-only-glow treatment as the gauge: a plain track, and the
                                    glow riding solely on the filled segment via `box-shadow`, so it
                                    grows with the share instead of haloing the whole row. */}
                                <div className="h-1.5 min-w-10 flex-1 rounded-full bg-line">
                                  <div
                                    className="h-full rounded-full transition-[width] duration-700 ease-out"
                                    style={{
                                      width: `${share}%`,
                                      backgroundColor: "var(--color-accent)",
                                      boxShadow: "0 0 8px var(--color-accent)",
                                    }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </Table.Cell>
                        </Table.Row>
                      );
                    })
                  )}
                </Table.Body>
              </Table.Root>
            </Card>

            <Card padding="none">
              <div className="border-b border-line px-5 py-4">
                <p className="text-[13px] font-semibold text-ink">{t.financialHealth.topOpenPositions.title}</p>
                <p className="text-[12px] text-muted">{t.financialHealth.topOpenPositions.subtitle}</p>
              </div>
              <Table.Root>
                <Table.Head>
                  <Table.Row>
                    <Table.HeaderCell>{t.dashboard.table.type}</Table.HeaderCell>
                    <Table.HeaderCell>{t.dashboard.table.status}</Table.HeaderCell>
                    <Table.HeaderCell>{t.dashboard.table.openBalance}</Table.HeaderCell>
                    <Table.HeaderCell aria-hidden />
                  </Table.Row>
                </Table.Head>
                <Table.Body>
                  {openPositionRows.length === 0 ? (
                    <Table.Row>
                      <Table.Cell colSpan={4} className="text-center text-muted">
                        {t.financialHealth.topOpenPositions.empty}
                      </Table.Cell>
                    </Table.Row>
                  ) : (
                    openPositionRows.map(({ position }) => (
                      <Table.Row key={position.objectId}>
                        <Table.Cell className="text-muted">{t.objectType[position.objectType] ?? position.objectType}</Table.Cell>
                        <Table.Cell>
                          <Badge variant={statusTone(position.status)} dot title={position.status}>
                            {t.positionStatus[position.status] ?? t.common.unrecognizedStatus}
                          </Badge>
                        </Table.Cell>
                        <Table.Cell mono>
                          {position.openBalance === null
                            ? t.common.unknown
                            : formatMoney(position.openBalance, position.currency || currency)}
                        </Table.Cell>
                        <Table.Cell>
                          <button
                            type="button"
                            aria-label={t.common.viewDetails}
                            title={t.common.viewDetails}
                            onClick={() => setSelectedPosition(position)}
                            className="text-[12.5px] font-semibold text-accent transition hover:underline"
                          >
                            {t.common.viewDetails}
                          </button>
                        </Table.Cell>
                      </Table.Row>
                    ))
                  )}
                </Table.Body>
              </Table.Root>
            </Card>
          </div>
        </>
      )}

      {selectedPosition && (
        <RowDetailModal
          position={selectedPosition}
          currency={selectedPosition.currency || currency}
          partyNames={data?.partyNames}
          onClose={() => setSelectedPosition(null)}
        />
      )}

      <Modal
        open={selectedInsight !== null}
        onClose={() => setSelectedInsight(null)}
        title={selectedInsight?.text ?? ""}
        closeLabel={t.common.close}
      >
        {selectedInsight && (
          <div className="flex flex-col gap-4 p-5">
            {selectedInsight.detail && (
              <span className={cn("tabular text-[15px] font-semibold", toneDetailColor[selectedInsight.tone])}>
                {selectedInsight.detail}
              </span>
            )}
            <div>
              <p className="text-[12.5px] font-semibold uppercase tracking-wide text-muted">
                {t.financialHealth.insights.causeTitle}
              </p>
              <dl className="mt-2.5 flex flex-col divide-y divide-line">
                {selectedInsight.factors.map((factor) => (
                  <div key={factor.label} className="flex items-center justify-between gap-4 py-2.5">
                    <dt className="text-[13.5px] text-muted">{factor.label}</dt>
                    <dd className="tabular text-[13.5px] font-semibold text-ink">{factor.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
