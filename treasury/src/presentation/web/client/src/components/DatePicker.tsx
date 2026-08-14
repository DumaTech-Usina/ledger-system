import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/i18n/i18n";
import { cn } from "@/utils/cn";
import {
  addDays,
  addMonths,
  formatDisplay,
  fromISO,
  maskTypedDigits,
  monthGrid,
  orderFor,
  parseTypedDigits,
  sameDay,
  startOfMonth,
  toISO,
} from "@/utils/dateRange";

function CalendarIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="size-4 shrink-0">
      <rect x="3" y="4" width="14" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 8h14M7 2.5v3M13 2.5v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ dir }: { dir: "left" | "right" | "down" }) {
  const d = dir === "left" ? "M11 4 6 9l5 5" : dir === "right" ? "M7 4l5 5-5 5" : "M4 7l5 5 5-5";
  return (
    <svg viewBox="0 0 18 18" fill="none" className="size-3.5">
      <path d={d} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-3.5">
      <path d="M3 8.5 6.2 12 13 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export interface DatePickerProps {
  /** ISO `yyyy-mm-dd`, or `""` for none. */
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  /**
   * When true, picking a day only stages it — nothing commits until "Selecionar" is pressed, and
   * the panel does not close on a bare click. Off by default: embedded inside a larger form (the
   * rectification amount/date pair) that already gates commitment with its own submit button, a
   * second confirm here would just be a second click for no new safety.
   *
   * On: for a date offered as an answer inside the Operations conversation, nothing else in that
   * flow holds the door open — picking a day used to submit the answer immediately, one click from
   * an accidental date. The explicit "Selecionar" is the door.
   */
  requireConfirm?: boolean;
  align?: "left" | "right";
  /** Which way the panel expands. `"up"` for a trigger sitting near the bottom of the viewport —
   * a chat composer, say — where opening downward would push the panel off-screen. */
  openDirection?: "down" | "up";
  /** Adds a one-click "Hoje"/"Today" shortcut beside the trigger — picking and confirming today in
   * a single click, for a context where that is the overwhelmingly common answer. */
  showTodayShortcut?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * A single date, picked from the same glass-popover calendar as `DateRangePicker` — one visual
 * language for every date/selection control in the app, whether it answers "when" with one day or
 * a range.
 */
export function DatePicker({
  value,
  onChange,
  label,
  placeholder,
  requireConfirm = false,
  align = "left",
  openDirection = "down",
  showTodayShortcut = false,
  disabled = false,
  className,
}: DatePickerProps) {
  const { t, language } = useLanguage();
  const order = orderFor(language);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date | null>(null);
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [typed, setTyped] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  function openPanel() {
    const current = fromISO(value);
    setDraft(current);
    setTyped(current ? formatDisplay(current, order) : "");
    setMonth(startOfMonth(current ?? new Date()));
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function pickDay(day: Date) {
    setDraft(day);
    setTyped(formatDisplay(day, order));
    if (!requireConfirm) {
      onChange(toISO(day));
      setOpen(false);
    }
  }

  function typeDigits(raw: string) {
    const masked = maskTypedDigits(raw);
    setTyped(masked);
    const parsed = parseTypedDigits(masked, order);
    if (parsed) {
      setDraft(parsed);
      setMonth(startOfMonth(parsed));
      if (!requireConfirm) {
        onChange(toISO(parsed));
        setOpen(false);
      }
    }
  }

  function confirm() {
    if (draft) onChange(toISO(draft));
    setOpen(false);
  }

  function pickToday() {
    const today = new Date();
    onChange(toISO(today));
    setOpen(false);
  }

  const currentDate = fromISO(value);
  const triggerLabel = currentDate ? formatDisplay(currentDate, order) : (placeholder ?? t.datePicker.placeholder);

  const grid = monthGrid(month);
  const weekdayBase = grid[0].date;
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(language, { weekday: "narrow" }).format(addDays(weekdayBase, i)),
  );
  const monthTitle = new Intl.DateTimeFormat(language, { month: "long", year: "numeric" }).format(month);

  return (
    <div ref={containerRef} className={cn("relative flex flex-col gap-1.5", className)}>
      {label && <span className="text-[13px] font-semibold text-muted">{label}</span>}
      <button
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openPanel())}
        aria-expanded={open}
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-full border border-line bg-panel-solid px-4 text-[13px] font-medium text-ink",
          "outline-none transition hover:bg-ink/6 focus:border-accent focus:ring-2 focus:ring-accent-soft dark:hover:bg-white/8",
          "disabled:pointer-events-none disabled:opacity-50",
        )}
      >
        <CalendarIcon />
        <span className={cn(!currentDate && "text-muted")}>{triggerLabel}</span>
        <span className={cn("text-muted transition-transform", open && "rotate-180")}>
          <ChevronIcon dir="down" />
        </span>
      </button>

      {open && (
        <div
          className={cn(
            "glass-popover motion-safe:animate-[glass-pop_320ms_cubic-bezier(0.34,1.56,0.64,1)_both]",
            "absolute z-50 w-[min(92vw,320px)] p-4",
            openDirection === "up" ? "bottom-full mb-2" : "top-full mt-2",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          <div className="flex items-center gap-2 border-b border-line pb-3">
            <CalendarIcon />
            <p className="text-[13.5px] font-semibold text-ink">{t.datePicker.title}</p>
            <input
              value={typed}
              onChange={(event) => typeDigits(event.target.value)}
              placeholder={order === "DMY" ? "dd/mm/aaaa" : "mm/dd/yyyy"}
              className="ml-auto w-28 rounded-lg border border-line bg-ink/[0.03] px-2 py-1 text-center text-[12.5px] font-medium text-ink outline-none focus:border-accent dark:bg-white/5"
            />
          </div>

          <div className="mt-3 flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => setMonth((m) => addMonths(m, -1))}
              aria-label={t.common.previousMonth}
              className="inline-flex size-7 items-center justify-center rounded-full text-muted transition hover:bg-ink/8 hover:text-ink dark:hover:bg-white/10"
            >
              <ChevronIcon dir="left" />
            </button>
            <p className="text-[13px] font-semibold capitalize text-ink">{monthTitle}</p>
            <button
              type="button"
              onClick={() => setMonth((m) => addMonths(m, 1))}
              aria-label={t.common.nextMonth}
              className="inline-flex size-7 items-center justify-center rounded-full text-muted transition hover:bg-ink/8 hover:text-ink dark:hover:bg-white/10"
            >
              <ChevronIcon dir="right" />
            </button>
          </div>
          <div className="mt-2 grid grid-cols-7">
            {weekdays.map((w, i) => (
              <div key={i} className="flex h-7 items-center justify-center text-[11px] font-semibold text-muted">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {grid.map(({ date, inMonth }, i) => {
              const isSelected = sameDay(date, draft);
              return (
                <div key={i} className="flex h-9 items-center justify-center">
                  <button
                    type="button"
                    onClick={() => pickDay(date)}
                    className={cn(
                      "flex size-9 items-center justify-center rounded-full text-[13px] transition",
                      !inMonth && "text-muted/40",
                      isSelected && "bg-accent font-semibold text-accent-ink",
                      !isSelected && inMonth && "text-ink hover:bg-ink/8 dark:hover:bg-white/10",
                      !isSelected && !inMonth && "hover:bg-ink/6 dark:hover:bg-white/8",
                    )}
                  >
                    {date.getDate()}
                  </button>
                </div>
              );
            })}
          </div>

          {requireConfirm && (
            <div className="mt-3 flex items-center justify-end gap-2 border-t border-line pt-3">
              {showTodayShortcut && (
                <button
                  type="button"
                  onClick={pickToday}
                  className="inline-flex h-9 items-center rounded-full px-4 text-[13px] font-medium text-ink transition hover:bg-ink/6 dark:hover:bg-white/8"
                >
                  {t.datePicker.today}
                </button>
              )}
              <button
                type="button"
                disabled={!draft}
                onClick={confirm}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[linear-gradient(to_bottom,color-mix(in_srgb,var(--color-accent)_100%,white_10%),var(--color-accent))] px-4 text-[13px] font-medium text-accent-ink shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_8px_20px_-8px_var(--color-accent)] transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-50"
              >
                <CheckIcon />
                {t.datePicker.select}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
