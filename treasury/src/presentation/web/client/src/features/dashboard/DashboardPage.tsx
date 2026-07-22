import { useState } from "react";
import { Card } from "@/components/Card";
import { Modal } from "@/components/Modal";
import { ClassificationAgingCard } from "@/features/dashboard/ClassificationAgingCard";
import { ClassificationHealthCard } from "@/features/dashboard/ClassificationHealthCard";
import { MovementsTable } from "@/features/dashboard/MovementsTable";
import { PositionsTable } from "@/features/dashboard/PositionsTable";
import { TotalFlowWidget } from "@/features/dashboard/TotalFlowWidget";
import { useDashboard } from "@/features/dashboard/useDashboard";
import { formatTemplate, useLanguage } from "@/i18n/i18n";
import { formatDate, formatMoney } from "@/utils/format";

type DetailKind = "cashIn" | "cashOut" | "netFlow" | "receivables";

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
  const { data, loading } = useDashboard();
  const { t } = useLanguage();
  const [detail, setDetail] = useState<DetailKind | null>(null);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl font-semibold text-ink">{t.dashboard.heading}</h2>
        <p className="mt-1 text-sm text-muted">{t.dashboard.subheading}</p>
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
                onClick={() => setDetail("cashIn")}
              />
              <Stat
                label={t.dashboard.cashOut}
                value={formatMoney(data.cashPosition.totalCashOut, data.cashPosition.currency)}
                onClick={() => setDetail("cashOut")}
              />
              <Stat
                label={t.dashboard.netFlow}
                value={formatMoney(data.cashPosition.netCashFlow, data.cashPosition.currency)}
                tone={data.cashPosition.netCashFlow.startsWith("-") ? "bad" : "ok"}
                onClick={() => setDetail("netFlow")}
              />
              <Stat
                label={t.dashboard.openReceivables}
                value={formatMoney(data.cashPosition.openReceivables, data.cashPosition.currency)}
                onClick={() => setDetail("receivables")}
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
          >
            <MovementsTable
              movements={(data.movements ?? []).filter((m) => m.effect === "cash_in")}
              currency={data.cashPosition.currency}
            />
          </Modal>

          <Modal
            open={detail === "cashOut"}
            onClose={() => setDetail(null)}
            title={t.dashboard.cashOut}
            closeLabel={t.common.close}
          >
            <MovementsTable
              movements={(data.movements ?? []).filter((m) => m.effect === "cash_out")}
              currency={data.cashPosition.currency}
            />
          </Modal>

          <Modal
            open={detail === "netFlow"}
            onClose={() => setDetail(null)}
            title={t.dashboard.netFlow}
            closeLabel={t.common.close}
          >
            <div className="flex flex-wrap gap-6 border-b border-line px-5 py-4">
              <div>
                <p className="text-[12px] font-semibold text-muted">{t.dashboard.cashIn}</p>
                <p className="tabular mt-1 text-lg font-semibold text-ok">
                  {formatMoney(data.cashPosition.totalCashIn, data.cashPosition.currency)}
                </p>
              </div>
              <div>
                <p className="text-[12px] font-semibold text-muted">{t.dashboard.cashOut}</p>
                <p className="tabular mt-1 text-lg font-semibold text-bad">
                  {formatMoney(data.cashPosition.totalCashOut, data.cashPosition.currency)}
                </p>
              </div>
              <div>
                <p className="text-[12px] font-semibold text-muted">{t.dashboard.netFlow}</p>
                <p
                  className={`tabular mt-1 text-lg font-semibold ${data.cashPosition.netCashFlow.startsWith("-") ? "text-bad" : "text-ok"}`}
                >
                  {formatMoney(data.cashPosition.netCashFlow, data.cashPosition.currency)}
                </p>
              </div>
            </div>
            <MovementsTable movements={data.movements ?? []} currency={data.cashPosition.currency} />
          </Modal>

          <Modal
            open={detail === "receivables"}
            onClose={() => setDetail(null)}
            title={t.dashboard.openReceivables}
            closeLabel={t.common.close}
          >
            <PositionsTable
              positions={(data.positions ?? []).filter((p) => p.status === "open" || p.status === "partially_settled")}
              currency={data.cashPosition.currency}
            />
          </Modal>

          <section className="space-y-4">
            <h3 className="font-display text-[15px] font-semibold text-ink">{t.dashboard.recentMovements}</h3>
            <Card padding="none">
              <MovementsTable movements={data.movements ?? []} currency={data.cashPosition.currency} />
            </Card>
          </section>

          <section className="space-y-4">
            <h3 className="font-display text-[15px] font-semibold text-ink">{t.dashboard.openPositions}</h3>
            <Card padding="none">
              <PositionsTable positions={data.positions ?? []} currency={data.cashPosition.currency} />
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
