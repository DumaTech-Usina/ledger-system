import { useMemo, useState } from "react";
import { niceTicks, verticalBarPath } from "@/features/dashboard/chart-utils";
import { useMeasuredWidth } from "@/hooks/useMeasuredWidth";
import { useLanguage } from "@/i18n/i18n";
import { formatDate, formatMoney } from "@/utils/format";
import type { CashMovement } from "@/types/dashboard";

const PAD_TOP = 14;
const PAD_BOTTOM = 30;
const PAD_LEFT = 62;
const PAD_RIGHT = 14;
const PLOT_H = 236;
const SVG_H = PLOT_H + PAD_TOP + PAD_BOTTOM;
/** Below this the columns stop being readable, so the plot scrolls horizontally instead of shrinking. */
const MIN_SLOT = 24;
const MAX_BAR = 24;
const BAR_RADIUS = 4;
/** The 2px surface gap that keeps the up-bar and the down-bar from touching at the baseline. */
const BASELINE_GAP = 1;
const DOT_R = 4;
/** Wider than one calendar year of empty days: past that, only days that actually moved are plotted. */
const MAX_FILLED_DAYS = 400;

export interface DailyFlow {
  date: string;
  inflow: number;
  outflow: number;
  /** Running closing balance: every net day before this one, plus this one. */
  balance: number;
  hasMovement: boolean;
}

function addDays(day: string, count: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + count);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

function firstDayOfMonth(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

/** Day 0 of the next month is the last day of this one — no month-length table needed. */
function lastDayOfMonth(day: string): string {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  if (Number.isNaN(year) || Number.isNaN(month)) return day;
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

/**
 * Cash in and cash out per calendar day, plus the balance those days accumulate to. The axis spans
 * whole months — every day of every month touched by the movements, not only the days that moved —
 * so a quiet week reads as a quiet week and the balance line reads as time passing. It stops at
 * `todayIso`: an empty future says nothing about the cash. A movement already dated ahead of today
 * still extends the axis, because no figure the Ledger published is ever dropped from the plot.
 */
export function buildDailyFlow(
  movements: CashMovement[],
  todayIso: string = new Date().toISOString().slice(0, 10),
): DailyFlow[] {
  const byDay = new Map<string, { inflow: number; outflow: number }>();
  for (const m of movements) {
    if (m.effect !== "cash_in" && m.effect !== "cash_out") continue;
    const amount = Number(m.amount);
    if (Number.isNaN(amount)) continue;
    const day = m.occurredAt.slice(0, 10);
    const entry = byDay.get(day) ?? { inflow: 0, outflow: 0 };
    if (m.effect === "cash_in") entry.inflow += Math.abs(amount);
    else entry.outflow += Math.abs(amount);
    byDay.set(day, entry);
  }

  const moved = [...byDay.keys()].sort((a, b) => a.localeCompare(b));
  if (moved.length === 0) return [];

  const lastMoved = moved[moved.length - 1];
  const monthEnd = lastDayOfMonth(lastMoved);
  const first = firstDayOfMonth(moved[0]);
  const last = monthEnd <= todayIso ? monthEnd : lastMoved > todayIso ? lastMoved : todayIso;
  const span = daysBetween(first, last);
  const axis =
    span >= 0 && span < MAX_FILLED_DAYS ? Array.from({ length: span + 1 }, (_, i) => addDays(first, i)) : moved;

  let running = 0;
  return axis.map((date) => {
    const entry = byDay.get(date);
    const inflow = entry?.inflow ?? 0;
    const outflow = entry?.outflow ?? 0;
    running += inflow - outflow;
    return { date, inflow, outflow, balance: running, hasMovement: entry !== undefined };
  });
}

function formatDayTick(day: string, locale: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  const parts = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", timeZone: "UTC" }).formatToParts(d);
  const dayPart = parts.find((p) => p.type === "day")?.value ?? "";
  const monthPart = (parts.find((p) => p.type === "month")?.value ?? "").replace(".", "");
  return `${dayPart} ${monthPart}`;
}

function formatCompact(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

/** The legend's line key for the balance series — a stroke, because the series is a line. */
function LineKey() {
  return (
    <svg viewBox="0 0 18 8" className="h-2 w-4.5 shrink-0" aria-hidden>
      <path d="M1 4h16" stroke="var(--color-accent)" strokeWidth={2} strokeLinecap="round" />
      <circle cx="9" cy="4" r="3" fill="var(--color-accent)" />
    </svg>
  );
}

/**
 * The day-by-day shape of the cash flow: cash in above the zero line, cash out below it, and the
 * balance those days accumulate to as a line across the top. One axis for all three — the balance
 * is money, the bars are money, and a second scale would let them lie about each other.
 */
export function CashFlowChart({
  movements,
  currency,
  onSelectDay,
}: {
  movements: CashMovement[];
  currency: string;
  onSelectDay?: (day: string) => void;
}) {
  const { t, language } = useLanguage();
  const c = t.dashboard.hero;
  const locale = language === "pt-BR" ? "pt-BR" : "en-US";
  const [wrapperRef, wrapperWidth] = useMeasuredWidth<HTMLDivElement>();
  const [hovered, setHovered] = useState<number | null>(null);
  /** Where the crosshair last sat. It slides between days and fades out in place — never snaps home. */
  const [anchor, setAnchor] = useState(0);

  const daily = useMemo(() => buildDailyFlow(movements), [movements]);

  const svgWidth = Math.max(wrapperWidth || 640, PAD_LEFT + PAD_RIGHT + daily.length * MIN_SLOT);
  const plotW = svgWidth - PAD_LEFT - PAD_RIGHT;
  const slot = daily.length > 0 ? plotW / daily.length : plotW;
  const barWidth = Math.max(2, Math.min(MAX_BAR, slot * 0.55));

  const { ticks, lo, hi } = niceTicks(
    Math.min(0, ...daily.map((d) => Math.min(-d.outflow, d.balance))),
    Math.max(0, ...daily.map((d) => Math.max(d.inflow, d.balance))),
  );
  const toY = (value: number) => PAD_TOP + PLOT_H - ((value - lo) / (hi - lo || 1)) * PLOT_H;
  const baselineY = toY(0);

  const points = daily.map((d, i) => ({
    ...d,
    index: i,
    x: PAD_LEFT + i * slot,
    centerX: PAD_LEFT + i * slot + slot / 2,
    balanceY: toY(d.balance),
  }));

  /** Every label would collide on a long range, so thin them to whatever the width actually fits. */
  const labelEvery = Math.max(1, Math.ceil(daily.length / Math.max(1, Math.floor(plotW / 38))));
  const balancePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.centerX} ${p.balanceY}`).join(" ");
  const active = hovered !== null ? points[hovered] ?? null : null;
  const anchored = points[anchor] ?? points[0];

  const hover = (index: number) => {
    setHovered(index);
    setAnchor(index);
  };

  if (daily.length === 0) return null;

  return (
    <figure className="m-0">
      <div ref={wrapperRef} className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="relative" style={{ width: svgWidth }}>
          <svg
            width={svgWidth}
            height={SVG_H}
            viewBox={`0 0 ${svgWidth} ${SVG_H}`}
            className="block select-none"
            role="group"
            aria-label={c.chartLabel}
            onMouseLeave={() => setHovered(null)}
          >
            {ticks.map((value) => (
              <g key={value}>
                <line
                  x1={PAD_LEFT}
                  y1={toY(value)}
                  x2={svgWidth - PAD_RIGHT}
                  y2={toY(value)}
                  stroke="var(--color-line)"
                  strokeWidth={1}
                  opacity={value === 0 ? 1 : 0.55}
                />
                <text
                  x={PAD_LEFT - 10}
                  y={toY(value)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-muted text-[10px]"
                >
                  {formatCompact(value, locale)}
                </text>
              </g>
            ))}

            {/* The crosshair rides a translated group so it glides from day to day instead of
                popping — geometry attributes don't transition reliably, transforms do. */}
            <g
              className="pointer-events-none transition-[transform,opacity] duration-150 ease-out motion-reduce:transition-none"
              style={{ transform: `translateX(${anchored.centerX}px)` }}
              opacity={active ? 1 : 0}
            >
              <rect
                x={-slot / 2}
                y={PAD_TOP}
                width={slot}
                height={PLOT_H}
                rx={6}
                fill="var(--color-accent)"
                opacity={0.07}
              />
              <line x1={0} y1={PAD_TOP} x2={0} y2={PAD_TOP + PLOT_H} stroke="var(--color-accent)" strokeWidth={1} opacity={0.3} />
            </g>

            {points.map((p) => {
              const lifted = hovered === p.index;
              const barStyle = {
                transformBox: "fill-box" as const,
                transformOrigin: "center",
                transform: lifted ? "scaleX(1.14)" : "scaleX(1)",
              };
              const barClass =
                "transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none";
              return (
                <g key={`bars-${p.date}`} opacity={hovered === null || lifted ? 1 : 0.45} className={barClass}>
                  {p.inflow > 0 && (
                    <path
                      d={verticalBarPath(
                        p.centerX - barWidth / 2,
                        barWidth,
                        baselineY - BASELINE_GAP,
                        toY(p.inflow),
                        BAR_RADIUS,
                      )}
                      fill="var(--color-ok)"
                      className={barClass}
                      style={barStyle}
                    />
                  )}
                  {p.outflow > 0 && (
                    <path
                      d={verticalBarPath(
                        p.centerX - barWidth / 2,
                        barWidth,
                        baselineY + BASELINE_GAP,
                        toY(-p.outflow),
                        BAR_RADIUS,
                      )}
                      fill="var(--color-bad)"
                      className={barClass}
                      style={barStyle}
                    />
                  )}
                </g>
              );
            })}

            <path d={balancePath} fill="none" stroke="var(--color-accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {points.map((p) => {
              const lifted = hovered === p.index;
              return (
                <g key={`dot-${p.date}`} className="pointer-events-none">
                  <circle
                    cx={p.centerX}
                    cy={p.balanceY}
                    r={DOT_R + 5}
                    fill="var(--color-accent)"
                    opacity={lifted ? 0.18 : 0}
                    className="transition-opacity duration-200 ease-out motion-reduce:transition-none"
                  />
                  <circle
                    cx={p.centerX}
                    cy={p.balanceY}
                    r={DOT_R}
                    fill="var(--color-accent)"
                    stroke="var(--color-panel-solid)"
                    strokeWidth={2}
                    className="transition-transform duration-200 ease-out motion-reduce:transition-none"
                    style={{
                      transformBox: "fill-box",
                      transformOrigin: "center",
                      transform: lifted ? "scale(1.45)" : "scale(1)",
                    }}
                  />
                </g>
              );
            })}

            {points.map((p, i) =>
              i % labelEvery === 0 ? (
                <text
                  key={`tick-${p.date}`}
                  x={p.centerX}
                  y={SVG_H - 10}
                  textAnchor="middle"
                  className={`text-[10px] transition-colors duration-200 motion-reduce:transition-none ${
                    hovered === p.index ? "fill-ink font-semibold" : "fill-muted"
                  }`}
                >
                  {formatDayTick(p.date, locale)}
                </text>
              ) : null,
            )}

            {points.map((p) => (
              <rect
                key={`hit-${p.date}`}
                x={p.x}
                y={PAD_TOP}
                width={slot}
                height={PLOT_H}
                fill="transparent"
                role="button"
                tabIndex={0}
                aria-label={`${formatDate(p.date)} · ${c.chartInflow}: ${formatMoney(p.inflow, currency)} · ${c.chartOutflow}: ${formatMoney(p.outflow, currency)} · ${c.balanceLabel}: ${formatMoney(p.balance, currency)}`}
                className={onSelectDay ? "cursor-pointer outline-none" : "outline-none"}
                onMouseEnter={() => hover(p.index)}
                onFocus={() => hover(p.index)}
                onBlur={() => setHovered(null)}
                onClick={() => onSelectDay?.(p.date)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectDay?.(p.date);
                  }
                }}
              />
            ))}
          </svg>

          {active && (
            <div
              className="pointer-events-none absolute z-10 min-w-44 rounded-xl border border-line bg-panel-solid p-3 shadow-glass transition-[left] duration-150 ease-out motion-reduce:transition-none"
              style={{
                left: active.centerX,
                top: PAD_TOP + 4,
                transform: active.centerX > svgWidth * 0.6 ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
              }}
            >
              <p className="text-[11px] font-semibold text-muted">{formatDate(active.date)}</p>
              <dl className="mt-2 space-y-1.5">
                {[
                  { label: c.chartInflow, value: active.inflow, color: "var(--color-ok)" },
                  { label: c.chartOutflow, value: active.outflow, color: "var(--color-bad)" },
                  { label: c.balanceLabel, value: active.balance, color: "var(--color-accent)" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-4">
                    <dt className="flex items-center gap-2 text-[11px] text-muted">
                      <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: row.color }} />
                      {row.label}
                    </dt>
                    <dd className="tabular text-[12px] font-semibold text-ink">{formatMoney(row.value, currency)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </div>

      <figcaption className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-muted">
        <span className="flex items-center gap-2">
          <span className="size-2.5 shrink-0 rounded-[3px] bg-ok" aria-hidden />
          {c.chartInflow}
        </span>
        <span className="flex items-center gap-2">
          <span className="size-2.5 shrink-0 rounded-[3px] bg-bad" aria-hidden />
          {c.chartOutflow}
        </span>
        <span className="flex items-center gap-2">
          <LineKey />
          {c.chartBalance}
        </span>
      </figcaption>
    </figure>
  );
}
