import { useState } from "react";
import { Card } from "@/components/Card";
import { DateRangePicker } from "@/components/DateRangePicker";
import { Modal } from "@/components/Modal";
import { MovementsSection } from "@/features/dashboard/MovementsSection";
import { MovementsTable } from "@/features/dashboard/MovementsTable";
import { TotalFlowWidget } from "@/features/dashboard/TotalFlowWidget";
import { useBookExposure } from "@/features/dashboard/useBookExposure";
import { useDashboard } from "@/features/dashboard/useDashboard";
import { formatTemplate, useLanguage } from "@/i18n/i18n";
import { formatDate, formatMoney, formatSignedMoney } from "@/utils/format";
import type { CashMovement } from "@/types/dashboard";

type DetailKind = "cashIn" | "cashOut" | "netFlow";

/** Last 30 days, anchored to now — the same window `/api/dashboard/exposure` defaults to on its
 * own, spelled out here so every block on this page asks for the identical window explicitly
 * rather than each endpoint falling back to its own implicit default. */
function defaultPeriod(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 30);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
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

/**
 * Cash: how much money moved, and when. Everything here comes from the Ledger's cash math —
 * `economicEffect` × `amount` — which never reads an object. What a position owes, and whether it
 * is still open, is a different question answered by a different fold; it lives in PositionsPage.
 *
 * One period drives the whole page — the cards, the daily chart and the movements list below all
 * read the same `from`/`to`, set once here. The cash figures on the cards come from the Ledger's
 * own fold over that period (`/api/dashboard/exposure`), never summed from the movements list on
 * screen: that list is capped, and a total derived from a capped list would silently disagree with
 * the Ledger the moment the period outgrew the cap.
 */
export function DashboardPage({ onNavigateToOperations }: { onNavigateToOperations?: () => void }) {
  const [period, setPeriod] = useState(defaultPeriod());
  const { data, loading } = useDashboard(period);
  const { exposure } = useBookExposure(period);
  const { t } = useLanguage();
  const [detail, setDetail] = useState<DetailKind | null>(null);

  const cashIn = exposure?.cashIn ?? null;
  const cashOut = exposure?.cashOut ?? null;
  const netCash = exposure?.netCash ?? null;
  const netCashNegative = exposure?.netCashNegative ?? false;

  return (
    <div className="space-y-8">
      {/* The picker sits bare — no card — so it reads as a control over the whole page rather than
          a filter scoped to one card beneath it. */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">{t.dashboard.heading}</h2>
          <p className="mt-1 text-sm text-muted">{t.dashboard.subheading}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <DateRangePicker from={period.from} to={period.to} onChange={setPeriod} align="right" />
          {/* The window the Ledger actually applied — its own default, shown rather than the one
              requested, in case the two ever disagree. */}
          {exposure?.period && (
            <p className="text-[12px] text-muted">
              {formatTemplate(t.dashboard.periodApplied, {
                from: formatDate(exposure.period.from),
                to: formatDate(exposure.period.to),
              })}
            </p>
          )}
        </div>
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
                currency={cashPosition.currency}
                netCash={netCash}
                netCashNegative={netCashNegative}
                movementsHasMore={data.movementsHasMore}
                partyNames={data.partyNames}
                onNavigateToOperations={onNavigateToOperations}
              />

              <section>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Stat
                    label={t.dashboard.cashIn}
                    value={cashIn !== null ? formatMoney(cashIn, cashPosition.currency) : t.common.unknown}
                    onClick={() => setDetail("cashIn")}
                  />
                  <Stat
                    label={t.dashboard.cashOut}
                    value={cashOut !== null ? formatMoney(cashOut, cashPosition.currency) : t.common.unknown}
                    tone="bad"
                    onClick={() => setDetail("cashOut")}
                  />
                  <Stat
                    label={t.dashboard.netFlow}
                    value={netCash !== null ? formatSignedMoney(netCash, netCashNegative, cashPosition.currency) : t.common.unknown}
                    tone={netCash === null ? undefined : netCashNegative ? "bad" : "ok"}
                    onClick={() => setDetail("netFlow")}
                  />
                </div>
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
                      {cashIn !== null ? formatMoney(cashIn, cashPosition.currency) : t.common.unknown}
                    </p>
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-muted">{t.dashboard.cashOut}</p>
                    <p className="tabular mt-1 text-lg font-semibold text-bad">
                      {cashOut !== null ? formatMoney(cashOut, cashPosition.currency) : t.common.unknown}
                    </p>
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-muted">{t.dashboard.netFlow}</p>
                    <p
                      className={`tabular mt-1 text-lg font-semibold ${
                        netCash === null ? "text-muted" : netCashNegative ? "text-bad" : "text-ok"
                      }`}
                    >
                      {netCash !== null ? formatSignedMoney(netCash, netCashNegative, cashPosition.currency) : t.common.unknown}
                    </p>
                  </div>
                </div>
                {/* Every movement the Ledger returned for the period, in one run — the only shape a
                    balance can be read down. Capped the same way the chart is; see `movementsHasMore`. */}
                <MovementsTable
                  movements={movements}
                  currency={cashPosition.currency}
                  partyNames={data.partyNames}
                  showBalance
                />
              </Modal>

              <MovementsSection currency={cashPosition.currency} period={period} />
            </>
          );
        })()
      )}
    </div>
  );
}
