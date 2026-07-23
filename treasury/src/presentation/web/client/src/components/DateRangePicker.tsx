import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useLanguage } from "@/i18n/i18n";
import { formatDate } from "@/utils/format";
import { cn } from "@/utils/cn";

const POPOVER_WIDTH = 300;
const VIEWPORT_MARGIN = 16;

export interface DateRangePickerProps {
  from: string | null;
  to: string | null;
  onChange: (from: string | null, to: string | null) => void;
}

const isoDate = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
const firstWeekday = (y: number, m: number) => new Date(Date.UTC(y, m, 1)).getUTCDay();

function weekdayLabels(language: string): string[] {
  const fmt = new Intl.DateTimeFormat(language, { weekday: "narrow", timeZone: "UTC" });
  // 2026-01-04 through 2026-01-10 is a Sun-Sat week, safe anchor for narrow weekday labels.
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2026, 0, 4 + i))));
}

export function DateRangePicker({ from, to, onChange }: DateRangePickerProps) {
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [pendingFrom, setPendingFrom] = useState(from);
  const [pendingTo, setPendingTo] = useState(to);
  const [hoverDay, setHoverDay] = useState<string | null>(null);
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getUTCFullYear());
  const [viewMonth, setViewMonth] = useState(today.getUTCMonth());
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    setPendingFrom(from);
    setPendingTo(to);
  }, [open, from, to]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const measure = () => {
      const rect = triggerRef.current!.getBoundingClientRect();
      const maxLeft = window.innerWidth - POPOVER_WIDTH - VIEWPORT_MARGIN;
      const left = Math.max(VIEWPORT_MARGIN, Math.min(rect.left, maxLeft));
      setPos({ top: rect.bottom + 8, left });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-date-range-root]")) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [open]);

  const label =
    pendingFrom && pendingTo
      ? `${formatDate(pendingFrom)} – ${formatDate(pendingTo)}`
      : from && to
        ? `${formatDate(from)} – ${formatDate(to)}`
        : t.dashboard.filters.placeholder;

  function handlePick(day: string) {
    if (!pendingFrom || (pendingFrom && pendingTo)) {
      setPendingFrom(day);
      setPendingTo(null);
      return;
    }
    if (day < pendingFrom) {
      setPendingTo(pendingFrom);
      setPendingFrom(day);
    } else {
      setPendingTo(day);
    }
  }

  function apply() {
    onChange(pendingFrom, pendingTo);
    setOpen(false);
  }

  function clear() {
    setPendingFrom(null);
    setPendingTo(null);
    onChange(null, null);
    setOpen(false);
  }

  function goMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setViewMonth(m);
    setViewYear(y);
  }

  const monthLabel = new Intl.DateTimeFormat(language, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(viewYear, viewMonth, 1)),
  );

  const leading = firstWeekday(viewYear, viewMonth);
  const totalDays = daysInMonth(viewYear, viewMonth);
  const cells: (string | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: totalDays }, (_, i) => isoDate(viewYear, viewMonth, i + 1)),
  ];

  const rangeStart = pendingFrom && pendingTo ? pendingFrom : pendingFrom && hoverDay ? (hoverDay < pendingFrom ? hoverDay : pendingFrom) : null;
  const rangeEnd = pendingFrom && pendingTo ? pendingTo : pendingFrom && hoverDay ? (hoverDay < pendingFrom ? pendingFrom : hoverDay) : null;

  return (
    <div data-date-range-root className="inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 items-center gap-2 rounded-full bg-ink/5 px-4 text-sm font-medium text-ink transition hover:bg-ink/10 dark:bg-white/8 dark:hover:bg-white/12"
      >
        <svg viewBox="0 0 20 20" fill="none" className="size-4 text-muted">
          <rect x="3" y="4.5" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
          <path d="M3 8h14M6.5 2.5v3M13.5 2.5v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <span className="tabular">{label}</span>
      </button>

      {open &&
        pos &&
        createPortal(
        <Card
          padding="md"
          data-date-range-root
          className="fixed z-[200] w-[300px] bg-panel-solid shadow-xl"
          style={{ top: pos.top, left: pos.left }}
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => goMonth(-1)}
              aria-label="Previous month"
              className="inline-flex size-7 items-center justify-center rounded-full text-muted transition hover:bg-ink/6 hover:text-ink dark:hover:bg-white/8"
            >
              <svg viewBox="0 0 20 20" fill="none" className="size-4">
                <path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <p className="text-[13px] font-semibold capitalize text-ink">{monthLabel}</p>
            <button
              type="button"
              onClick={() => goMonth(1)}
              aria-label="Next month"
              className="inline-flex size-7 items-center justify-center rounded-full text-muted transition hover:bg-ink/6 hover:text-ink dark:hover:bg-white/8"
            >
              <svg viewBox="0 0 20 20" fill="none" className="size-4">
                <path d="M8 5l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-y-1 text-center">
            {weekdayLabels(language).map((w, i) => (
              <span key={i} className="text-[11px] font-semibold text-muted">
                {w}
              </span>
            ))}
            {cells.map((day, i) => {
              if (!day) return <span key={i} />;
              const isEdge = day === pendingFrom || day === pendingTo;
              const inRange = rangeStart && rangeEnd && day >= rangeStart && day <= rangeEnd;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handlePick(day)}
                  onMouseEnter={() => setHoverDay(day)}
                  className={cn(
                    "mx-auto flex size-8 items-center justify-center rounded-full text-[13px] tabular transition",
                    isEdge && "bg-accent text-accent-ink font-semibold",
                    !isEdge && inRange && "bg-accent/15 text-ink",
                    !isEdge && !inRange && "text-ink hover:bg-ink/6 dark:hover:bg-white/8",
                  )}
                >
                  {Number(day.slice(8, 10))}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={clear}>
              {t.dashboard.filters.clear}
            </Button>
            <Button variant="primary" size="sm" onClick={apply} disabled={!pendingFrom || !pendingTo}>
              {t.dashboard.filters.apply}
            </Button>
          </div>
        </Card>,
        document.body,
      )}
    </div>
  );
}
