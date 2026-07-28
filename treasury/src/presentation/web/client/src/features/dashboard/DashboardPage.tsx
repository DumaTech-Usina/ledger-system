import { useState } from "react";
import { Card } from "@/components/Card";
import { Modal } from "@/components/Modal";
import { DateRangePicker } from "@/components/DateRangePicker";
import { CategoryTabs, type CategoryKey } from "@/features/dashboard/CategoryTabs";
import { CommissionBreakdown, type BreakdownEntry } from "@/features/dashboard/CommissionBreakdown";
import { ClassificationAgingCard } from "@/features/dashboard/ClassificationAgingCard";
import { ClassificationHealthCard } from "@/features/dashboard/ClassificationHealthCard";
import { MovementsTable } from "@/features/dashboard/MovementsTable";
import { PositionsTable } from "@/features/dashboard/PositionsTable";
import { TotalFlowWidget } from "@/features/dashboard/TotalFlowWidget";
import { useDashboard } from "@/features/dashboard/useDashboard";
import { formatTemplate, useLanguage } from "@/i18n/i18n";
import { formatDate, formatMoney } from "@/utils/format";
import type { CashMovement, PositionItem } from "@/types/dashboard";

type DetailKind = "cashIn" | "cashOut" | "netFlow" | "receivables";

function byCategory<T extends { category?: string }>(items: T[], category: CategoryKey): T[] {
  return category === "todos" ? items : items.filter((item) => item.category === category);
}

function Stat({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  tone?: "ok" | "bad";
  onClick?: () => void;
}) {
  return (
    <Card
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={onClick ? "transition hover:bg-ink/6 dark:hover:bg-white/8" : undefined}
    >
      <p className="text-[13px] font-semibold text-muted">{label}</p>
      <p className={`tabular mt-1.5 text-2xl font-semibold ${tone === "ok" ? "text-ok" : tone === "bad" ? "text-bad" : "text-ink"}`}>
        {value}
      </p>
    </Card>
  );
}

export function DashboardPage({ onNavigateToOperations }: { onNavigateToOperations?: () => void }) {
  const [range, setRange] = useState<{ from: string | null; to: string | null }>({ from: null, to: null });
  const { data, loading } = useDashboard(range);
  const { t } = useLanguage();
  const [detail, setDetail] = useState<DetailKind | null>(null);
  const [category, setCategory] = useState<CategoryKey>("todos");

  function openDetail(kind: DetailKind) {
    setCategory("todos");
    setDetail(kind);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">{t.dashboard.heading}</h2>
          <p className="mt-1 text-sm text-muted">{t.dashboard.subheading}</p>
        </div>
        <DateRangePicker from={range.from} to={range.to} onChange={(from, to) => setRange({ from, to })} />
      </div>

      {loading ? (
        <Card>
          <p className="text-sm text-muted">{t.common.loading}</p>
        </Card>
      ) : !data?.available || !data.cashPosition ? (
        <Card>
          <p className="text-sm text-muted">{t.dashboard.unavailable}</p>
        </Card>
      ) : (
        (() => {
          const cashPosition = data.cashPosition;
          const movements = data.movements ?? [];
          const positions = data.positions ?? [];
          const cashInMovements = byCategory(movements.filter((m: CashMovement) => m.effect === "cash_in"), category);
          const cashOutMovements = byCategory(movements.filter((m: CashMovement) => m.effect === "cash_out"), category);
          const netFlowMovements = byCategory(movements, category);
          const receivablePositions = byCategory(
            positions.filter((p: PositionItem) => p.status === "open" || p.status === "partially_settled"),
            category,
          );
          const toEntries = (
            items: (CashMovement | PositionItem)[],
            amountOf: (i: CashMovement | PositionItem) => string,
            flowKindOf: (i: CashMovement | PositionItem) => BreakdownEntry["flowKind"],
            dateOf: (i: CashMovement | PositionItem) => string | undefined,
          ): BreakdownEntry[] =>
            items.map((i) => ({
              amount: amountOf(i),
              origin: i.origin,
              flowKind: flowKindOf(i),
              date: dateOf(i),
            }));
          const cashInEntries = toEntries(
            cashInMovements,
            (m) => (m as CashMovement).amount,
            () => "cash_in",
            (m) => (m as CashMovement).occurredAt,
          );
          const cashOutEntries = toEntries(
            cashOutMovements,
            (m) => (m as CashMovement).amount,
            () => "cash_out",
            (m) => (m as CashMovement).occurredAt,
          );
          const netFlowEntries = toEntries(
            netFlowMovements,
            (m) => (m as CashMovement).amount,
            (m) => ((m as CashMovement).effect === "cash_in" ? "cash_in" : "cash_out"),
            (m) => (m as CashMovement).occurredAt,
          );
          const receivablesEntries = toEntries(
            receivablePositions,
            (p) => (p as PositionItem).openBalance,
            (p) => ((p as PositionItem).objectType === "commission_payable" || (p as PositionItem).objectType === "penalty" ? "payable" : "receivable"),
            (p) => (p as PositionItem).lastEventAt ?? undefined,
          );

          const openReceivables = Number(cashPosition.openReceivables);
          const openPayables = Number(cashPosition.openPayables);
          const netOpenPositions = openReceivables - openPayables;
          const netOpenPositionsFormatted = `${netOpenPositions >= 0 ? "+" : "-"}${Math.abs(netOpenPositions).toFixed(2)}`;

          return (
        <>
          <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
            <div className="h-full lg:col-span-2">
              <TotalFlowWidget
                movements={data.movements ?? []}
                cashPosition={data.cashPosition}
                onNavigateToOperations={onNavigateToOperations}
              />
            </div>
            {data.classificationHealth && <ClassificationHealthCard health={data.classificationHealth} />}
          </div>

          <section>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label={t.dashboard.cashIn}
                value={formatMoney(data.cashPosition.totalCashIn, data.cashPosition.currency)}
                onClick={() => openDetail("cashIn")}
              />
              <Stat
                label={t.dashboard.cashOut}
                value={formatMoney(data.cashPosition.totalCashOut, data.cashPosition.currency)}
                tone="bad"
                onClick={() => openDetail("cashOut")}
              />
              <Stat
                label={t.dashboard.netFlow}
                value={formatMoney(data.cashPosition.netCashFlow, data.cashPosition.currency)}
                tone={data.cashPosition.netCashFlow.startsWith("-") ? "bad" : "ok"}
                onClick={() => openDetail("netFlow")}
              />
              <Stat
                label={t.dashboard.openPositions}
                value={formatMoney(netOpenPositionsFormatted, data.cashPosition.currency)}
                tone={netOpenPositions >= 0 ? "ok" : "bad"}
                onClick={() => openDetail("receivables")}
              />
            </div>
            <p className="mt-3 text-[13px] text-muted">
              {formatTemplate(t.dashboard.positionAsOf, { date: formatDate(data.cashPosition.asOf) })}
            </p>
            {data.classificationHealth && (
              <div className="mt-4">
                <ClassificationAgingCard health={data.classificationHealth} />
              </div>
            )}
          </section>

          <Modal
            open={detail === "cashIn"}
            onClose={() => setDetail(null)}
            title={t.dashboard.cashIn}
            closeLabel={t.common.close}
            tabs={<CategoryTabs active={category} onChange={setCategory} />}
            className="max-w-6xl"
          >
            <CommissionBreakdown entries={cashInEntries} currency={cashPosition.currency} />
          </Modal>

          <Modal
            open={detail === "cashOut"}
            onClose={() => setDetail(null)}
            title={t.dashboard.cashOut}
            closeLabel={t.common.close}
            tabs={<CategoryTabs active={category} onChange={setCategory} />}
            className="max-w-6xl"
          >
            <CommissionBreakdown entries={cashOutEntries} currency={cashPosition.currency} />
          </Modal>

          <Modal
            open={detail === "netFlow"}
            onClose={() => setDetail(null)}
            title={t.dashboard.netFlow}
            closeLabel={t.common.close}
            tabs={<CategoryTabs active={category} onChange={setCategory} />}
            className="max-w-6xl"
          >
            <div className="flex flex-wrap gap-6 border-b border-line px-5 py-4">
              <div>
                <p className="text-[12px] font-semibold text-muted">{t.dashboard.cashIn}</p>
                <p className="tabular mt-1 text-lg font-semibold text-ok">
                  {formatMoney(cashPosition.totalCashIn, cashPosition.currency)}
                </p>
              </div>
              <div>
                <p className="text-[12px] font-semibold text-muted">{t.dashboard.cashOut}</p>
                <p className="tabular mt-1 text-lg font-semibold text-bad">
                  {formatMoney(cashPosition.totalCashOut, cashPosition.currency)}
                </p>
              </div>
              <div>
                <p className="text-[12px] font-semibold text-muted">{t.dashboard.netFlow}</p>
                <p
                  className={`tabular mt-1 text-lg font-semibold ${cashPosition.netCashFlow.startsWith("-") ? "text-bad" : "text-ok"}`}
                >
                  {formatMoney(cashPosition.netCashFlow, cashPosition.currency)}
                </p>
              </div>
            </div>
            <CommissionBreakdown entries={netFlowEntries} currency={cashPosition.currency} />
          </Modal>

          <Modal
            open={detail === "receivables"}
            onClose={() => setDetail(null)}
            title={t.dashboard.openPositions}
            closeLabel={t.common.close}
            tabs={<CategoryTabs active={category} onChange={setCategory} />}
            className="max-w-6xl"
          >
            <CommissionBreakdown entries={receivablesEntries} currency={cashPosition.currency} />
          </Modal>

          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display text-[15px] font-semibold text-ink">{t.dashboard.recentMovements}</h3>
            </div>
            <Card padding="none">
              <MovementsTable movements={movements} currency={cashPosition.currency} openingBalance={data.period?.openingBalance ?? "0.00"} />
            </Card>
          </section>

          <section className="space-y-4">
            <h3 className="font-display text-[15px] font-semibold text-ink">{t.dashboard.openPositions}</h3>
            <Card padding="none">
              <PositionsTable positions={positions} currency={cashPosition.currency} />
            </Card>
          </section>
        </>
          );
        })()
      )}
    </div>
  );
}
