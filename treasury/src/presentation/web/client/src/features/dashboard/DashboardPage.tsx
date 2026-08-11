import { useState } from "react";
import { Card } from "@/components/Card";
import { Modal } from "@/components/Modal";
import { MovementsTable } from "@/features/dashboard/MovementsTable";
import { TotalFlowWidget } from "@/features/dashboard/TotalFlowWidget";
import { useDashboard } from "@/features/dashboard/useDashboard";
import { formatTemplate, useLanguage } from "@/i18n/i18n";
import { formatDate, formatMoney } from "@/utils/format";
import type { CashMovement } from "@/types/dashboard";

type DetailKind = "cashIn" | "cashOut" | "netFlow";

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

/**
 * Cash: how much money moved, and when. Everything here comes from the Ledger's cash math —
 * `economicEffect` × `amount` — which never reads an object. What a position owes, and whether it
 * is still open, is a different question answered by a different fold; it lives in PositionsPage.
 */
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
        (() => {
          const cashPosition = data.cashPosition;
          const movements = data.movements ?? [];
          const cashInMovements = movements.filter((m: CashMovement) => m.effect === "cash_in");
          const cashOutMovements = movements.filter((m: CashMovement) => m.effect === "cash_out");

          return (
            <>
              <TotalFlowWidget
                movements={movements}
                cashPosition={cashPosition}
                partyNames={data.partyNames}
                onNavigateToOperations={onNavigateToOperations}
              />

              <section>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Stat
                    label={t.dashboard.cashIn}
                    value={formatMoney(cashPosition.totalCashIn, cashPosition.currency)}
                    onClick={() => setDetail("cashIn")}
                  />
                  <Stat
                    label={t.dashboard.cashOut}
                    value={formatMoney(cashPosition.totalCashOut, cashPosition.currency)}
                    tone="bad"
                    onClick={() => setDetail("cashOut")}
                  />
                  <Stat
                    label={t.dashboard.netFlow}
                    value={formatMoney(cashPosition.netCashFlow, cashPosition.currency)}
                    tone={cashPosition.netCashFlow.startsWith("-") ? "bad" : "ok"}
                    onClick={() => setDetail("netFlow")}
                  />
                </div>
                <p className="mt-3 text-[13px] text-muted">
                  {formatTemplate(t.dashboard.positionAsOf, { date: formatDate(cashPosition.asOf) })}
                </p>
              </section>

              <Modal
                open={detail === "cashIn"}
                onClose={() => setDetail(null)}
                title={t.dashboard.cashIn}
                closeLabel={t.common.close}
                className="max-w-6xl"
              >
                <MovementsTable movements={cashInMovements} currency={cashPosition.currency} partyNames={data.partyNames} />
              </Modal>

              <Modal
                open={detail === "cashOut"}
                onClose={() => setDetail(null)}
                title={t.dashboard.cashOut}
                closeLabel={t.common.close}
                className="max-w-6xl"
              >
                <MovementsTable movements={cashOutMovements} currency={cashPosition.currency} partyNames={data.partyNames} />
              </Modal>

              <Modal
                open={detail === "netFlow"}
                onClose={() => setDetail(null)}
                title={t.dashboard.netFlow}
                closeLabel={t.common.close}
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
                {/* Every movement, in one run — the only shape a balance can be read down. */}
                <MovementsTable
                  movements={movements}
                  currency={cashPosition.currency}
                  partyNames={data.partyNames}
                  showBalance
                />
              </Modal>


              <section className="space-y-4">
                <h3 className="font-display text-[15px] font-semibold text-ink">{t.dashboard.recentMovements}</h3>
                <Card padding="none">
                  <MovementsTable
                    movements={movements}
                    currency={cashPosition.currency}
                    partyNames={data.partyNames}
                    showBalance
                  />
                </Card>
              </section>

            </>
          );
        })()
      )}
    </div>
  );
}
