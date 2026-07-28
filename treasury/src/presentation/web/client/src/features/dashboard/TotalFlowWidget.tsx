import { useState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Modal } from "@/components/Modal";
import { verticalBarPath } from "@/features/dashboard/chart-utils";
import { MovementsTable } from "@/features/dashboard/MovementsTable";
import { formatTemplate, useLanguage } from "@/i18n/i18n";
import { formatDate, formatMoney } from "@/utils/format";
import type { CashPosition, CashMovement } from "@/types/dashboard";

const VIEW_W = 480;
const BAR_AREA_H = 64;
const VIEW_H = BAR_AREA_H;
const BAR_RADIUS = 3;

/** Cumulative closing balance per day (running cash_in − cash_out), relative to the start of `movements`. */
function buildDailyClosingBalance(movements: CashMovement[]): { date: string; total: number }[] {
  const byDay = new Map<string, number>();
  for (const m of movements) {
    if (m.effect !== "cash_in" && m.effect !== "cash_out") continue;
    const day = m.occurredAt.slice(0, 10);
    const amount = Number(m.amount);
    if (Number.isNaN(amount)) continue;
    const signed = m.effect === "cash_in" ? amount : -amount;
    byDay.set(day, (byDay.get(day) ?? 0) + signed);
  }
  const sortedDays = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  let running = 0;
  return sortedDays.map(([date, net]) => {
    running += net;
    return { date, total: running };
  });
}

function formatDayLabel(day: string, locale: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(d);
}

export function TotalFlowWidget({
  movements,
  cashPosition,
  onNavigateToOperations,
}: {
  movements: CashMovement[];
  cashPosition: CashPosition;
  onNavigateToOperations?: () => void;
}) {
  const { t, language } = useLanguage();
  const h = t.dashboard.hero;
  const locale = language === "pt-BR" ? "pt-BR" : "en-US";
  const [hovered, setHovered] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const totalCashIn = Number(cashPosition.totalCashIn);
  const netIsPositive = !cashPosition.netCashFlow.trim().startsWith("-");

  const daily = buildDailyClosingBalance(movements);
  const maxAbs = Math.max(1, ...daily.map((d) => Math.abs(d.total)));
  const slot = daily.length > 0 ? VIEW_W / daily.length : VIEW_W;
  const barWidth = Math.min(20, slot * 0.5);
  const baselineY = BAR_AREA_H / 2;
  const scale = baselineY / maxAbs;

  const bars = daily.map((d, i) => {
    const x = i * slot + (slot - barWidth) / 2;
    const tipY = baselineY - d.total * scale;
    return { ...d, x, centerX: x + barWidth / 2, tipY, isPositive: d.total >= 0 };
  });

  const active = hovered !== null ? bars[hovered] : null;
  const dayMovements = selectedDay ? movements.filter((m) => m.occurredAt.slice(0, 10) === selectedDay) : [];

  return (
    <Card className="relative flex h-full flex-col bg-gradient-to-br from-accent-soft via-white to-white dark:from-accent-soft dark:via-panel-solid dark:to-panel-solid">
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex items-center rounded-full bg-accent-soft px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-accent">
          {h.badge}
        </span>
        {onNavigateToOperations && (
          <Button variant="primary" size="sm" onClick={onNavigateToOperations}>
            <span aria-hidden>+</span> {h.cta}
          </Button>
        )}
      </div>

      <p className="mt-5 text-4xl font-semibold text-accent">{formatMoney(totalCashIn, cashPosition.currency)}</p>

      <p className={`mt-1.5 flex items-center gap-1.5 text-[13px] font-medium ${netIsPositive ? "text-ok" : "text-bad"}`}>
        <svg viewBox="0 0 12 12" fill="none" className={`size-3 ${netIsPositive ? "" : "rotate-180"}`} aria-hidden>
          <path d="M6 10V2M6 2 2.5 5.5M6 2l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-muted">{h.netLabel}:</span> {formatMoney(cashPosition.netCashFlow, cashPosition.currency)}
      </p>

      {bars.length > 0 && (
        <div className="mt-auto pt-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-muted transition hover:text-accent"
            >
              {h.viewAll}
              <svg viewBox="0 0 12 12" fill="none" className="size-3">
                <path d="M4 2.5 8 6l-4 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <div className="relative mt-2">
            <svg
              viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
              className="w-full"
              role="img"
              aria-label={`${h.balanceLabel}: ${formatMoney(totalCashIn, cashPosition.currency)}`}
            >
              <line x1={0} y1={baselineY} x2={VIEW_W} y2={baselineY} stroke="var(--color-line)" strokeWidth={1} />
              {bars.map((b, i) => (
                <g
                  key={b.date}
                  role="button"
                  tabIndex={0}
                  aria-label={`${formatDayLabel(b.date, locale)} · ${h.balanceLabel}: ${formatMoney(b.total, cashPosition.currency)}`}
                  className="cursor-pointer outline-none"
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(i)}
                  onBlur={() => setHovered(null)}
                  onClick={() => setSelectedDay(b.date)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedDay(b.date);
                    }
                  }}
                >
                  <rect x={b.x - 2} y={0} width={barWidth + 4} height={BAR_AREA_H} fill="transparent" />
                  <path
                    d={verticalBarPath(b.x, barWidth, baselineY, b.tipY, BAR_RADIUS)}
                    fill={b.isPositive ? "var(--color-ok)" : "var(--color-bad)"}
                    className="transition-opacity"
                    opacity={hovered === null || hovered === i ? 1 : 0.55}
                  />
                </g>
              ))}
            </svg>

            {active && (
              <div
                className="pointer-events-none absolute z-10 rounded-lg border border-line bg-panel-solid px-2.5 py-1.5 text-center shadow-glass"
                style={{
                  left: `${(active.centerX / VIEW_W) * 100}%`,
                  top: `calc(${(active.tipY / VIEW_H) * 100}% - 8px)`,
                  transform: "translate(-50%, -100%)",
                }}
              >
                <p className="whitespace-nowrap text-[10px] text-muted">{h.balanceLabel}</p>
                <p className={`tabular whitespace-nowrap text-[12px] font-semibold ${active.isPositive ? "text-ok" : "text-bad"}`}>
                  {formatMoney(active.total, cashPosition.currency)}
                </p>
                <p className="whitespace-nowrap text-[10px] text-muted">{formatDayLabel(active.date, locale)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <Modal
        open={selectedDay !== null}
        onClose={() => setSelectedDay(null)}
        title={selectedDay ? formatTemplate(h.dayDetailTitle, { date: formatDate(selectedDay) }) : ""}
        closeLabel={t.common.close}
      >
        <MovementsTable movements={dayMovements} currency={cashPosition.currency} />
      </Modal>

      <Modal open={showAll} onClose={() => setShowAll(false)} title={h.allMovementsTitle} closeLabel={t.common.close}>
        <MovementsTable movements={movements} currency={cashPosition.currency} />
      </Modal>
    </Card>
  );
}
