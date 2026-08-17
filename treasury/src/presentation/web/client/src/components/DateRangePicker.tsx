import { useEffect, useRef, useState } from "react";
import { Calendar, Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/i18n/i18n";
import { cn } from "@/utils/cn";
import {
  addDays,
  addMonths,
  formatDisplay,
  fromISO,
  isBefore,
  isWithin,
  maskTypedDigits,
  monthGrid,
  orderFor,
  parseTypedDigits,
  presetRanges,
  sameDay,
  startOfMonth,
  toISO,
  type PresetRange,
} from "@/utils/dateRange";

function CalendarIcon() {
  return <Calendar className="size-4 shrink-0" strokeWidth={1.4} />;
}

function ChevronIcon({ dir }: { dir: "left" | "right" | "down" }) {
  const Icon = dir === "left" ? ChevronLeft : dir === "right" ? ChevronRight : ChevronDown;
  return <Icon className="size-3.5" strokeWidth={1.6} />;
}

function CheckIcon() {
  return <Check className="size-3.5" strokeWidth={1.8} />;
}

/** One month, independently paged (see `DateRangePicker`'s doc comment for why). */
function MonthCalendar({
  month,
  onPrev,
  onNext,
  locale,
  draftFrom,
  draftTo,
  onPick,
}: {
  month: Date;
  onPrev: () => void;
  onNext: () => void;
  locale: string;
  draftFrom: Date | null;
  draftTo: Date | null;
  onPick: (day: Date) => void;
}) {
  const { t } = useLanguage();
  const grid = monthGrid(month);
  const weekdayBase = grid[0].date; // a Monday, per monthGrid's use of startOfWeek
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: "narrow" }).format(addDays(weekdayBase, i)),
  );
  const title = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(month);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={onPrev}
          aria-label={t.common.previousMonth}
          className="inline-flex size-7 items-center justify-center rounded-full text-muted transition hover:bg-ink/8 hover:text-ink dark:hover:bg-white/10"
        >
          <ChevronIcon dir="left" />
        </button>
        <p className="text-[13px] font-semibold capitalize text-ink">{title}</p>
        <button
          type="button"
          onClick={onNext}
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
          const isStart = sameDay(date, draftFrom);
          const isEnd = sameDay(date, draftTo);
          const inRange = isWithin(date, draftFrom, draftTo);
          return (
            <div
              key={i}
              className={cn(
                "flex h-9 items-center justify-center",
                (inRange || isStart || isEnd) && "bg-accent-soft",
                isStart && "rounded-l-full",
                isEnd && "rounded-r-full",
                isStart && isEnd && "rounded-full",
              )}
            >
              <button
                type="button"
                onClick={() => onPick(date)}
                className={cn(
                  "flex size-9 items-center justify-center rounded-full text-[13px] transition",
                  !inMonth && "text-muted/40",
                  (isStart || isEnd) && "bg-accent font-semibold text-accent-ink",
                  !isStart && !isEnd && inMonth && "text-ink hover:bg-ink/8 dark:hover:bg-white/10",
                  !isStart && !isEnd && !inMonth && "hover:bg-ink/6 dark:hover:bg-white/8",
                )}
              >
                {date.getDate()}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export interface DateRangePickerProps {
  /** ISO `yyyy-mm-dd`, or `""` for no bound. */
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
  /** Caption above the trigger. Omit for a bare, "floating" field. */
  label?: string;
  /** Which edge the expanded panel hangs from — `"right"` keeps it on-screen near a page's right edge. */
  align?: "left" | "right";
  className?: string;
}

/**
 * A single field for a date range: collapsed, it reads as one compact pill ("12/10/2023 -
 * 26/10/2023"); clicking it expands — with a liquid-glass bounce — into two independently-paged
 * calendars, ten quick presets, and typable start/end fields. Nothing commits until "Aplicar
 * filtro"; the panel closing any other way (Cancelar, outside click, Escape) discards the draft.
 *
 * Values are ISO date-only strings in and out, matching every `from`/`to` query param in this app;
 * all the calendar and typing math happens in local `Date`s and is converted at the edge.
 */
export function DateRangePicker({ from, to, onChange, label, align = "left", className }: DateRangePickerProps) {
  const { t, language } = useLanguage();
  const order = orderFor(language);
  const locale = language;

  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState<Date | null>(null);
  const [draftTo, setDraftTo] = useState<Date | null>(null);
  const [leftMonth, setLeftMonth] = useState(startOfMonth(new Date()));
  const [rightMonth, setRightMonth] = useState(startOfMonth(addMonths(new Date(), 1)));
  const [typedFrom, setTypedFrom] = useState("");
  const [typedTo, setTypedTo] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);

  function openPanel() {
    const f = fromISO(from);
    const tt = fromISO(to);
    setDraftFrom(f);
    setDraftTo(tt);
    setTypedFrom(f ? formatDisplay(f, order) : "");
    setTypedTo(tt ? formatDisplay(tt, order) : "");
    const anchorLeft = f ? startOfMonth(f) : startOfMonth(new Date());
    const anchorRight = tt ? startOfMonth(tt) : startOfMonth(addMonths(new Date(), 1));
    setLeftMonth(anchorLeft);
    setRightMonth(sameDay(anchorRight, anchorLeft) ? addMonths(anchorLeft, 1) : anchorRight);
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
    if (!draftFrom || (draftFrom && draftTo)) {
      setDraftFrom(day);
      setDraftTo(null);
      setTypedFrom(formatDisplay(day, order));
      setTypedTo("");
      return;
    }
    const [newFrom, newTo] = isBefore(day, draftFrom) ? [day, draftFrom] : [draftFrom, day];
    setDraftFrom(newFrom);
    setDraftTo(newTo);
    setTypedFrom(formatDisplay(newFrom, order));
    setTypedTo(formatDisplay(newTo, order));
  }

  function applyPreset(preset: PresetRange) {
    setDraftFrom(preset.from);
    setDraftTo(preset.to);
    setTypedFrom(formatDisplay(preset.from, order));
    setTypedTo(formatDisplay(preset.to, order));
    const anchorLeft = startOfMonth(preset.from);
    const anchorRight = startOfMonth(preset.to);
    setLeftMonth(anchorLeft);
    setRightMonth(sameDay(anchorRight, anchorLeft) ? addMonths(anchorLeft, 1) : anchorRight);
  }

  function typeStart(raw: string) {
    const masked = maskTypedDigits(raw);
    setTypedFrom(masked);
    const parsed = parseTypedDigits(masked, order);
    if (parsed) {
      setDraftFrom(parsed);
      setLeftMonth(startOfMonth(parsed));
    }
  }

  function typeEnd(raw: string) {
    const masked = maskTypedDigits(raw);
    setTypedTo(masked);
    const parsed = parseTypedDigits(masked, order);
    if (parsed) {
      setDraftTo(parsed);
      setRightMonth(startOfMonth(parsed));
    }
  }

  function apply() {
    if (!draftFrom) {
      setOpen(false);
      return;
    }
    onChange({ from: toISO(draftFrom), to: toISO(draftTo ?? draftFrom) });
    setOpen(false);
  }

  const fromDate = fromISO(from);
  const toDate = fromISO(to);
  const triggerLabel =
    fromDate && toDate
      ? `${formatDisplay(fromDate, order)} - ${formatDisplay(toDate, order)}`
      : t.dateRangePicker.placeholder;

  return (
    <div ref={containerRef} className={cn("relative flex flex-col gap-1.5", className)}>
      {label && <span className="text-[13px] font-semibold text-muted">{label}</span>}
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openPanel())}
        aria-expanded={open}
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-full border border-line bg-panel-solid px-4 text-[13px] font-medium text-ink",
          "outline-none transition hover:bg-ink/6 focus:border-accent focus:ring-2 focus:ring-accent-soft dark:hover:bg-white/8",
        )}
      >
        <CalendarIcon />
        <span className={cn(!fromDate && "text-muted")}>{triggerLabel}</span>
        <span className={cn("text-muted transition-transform", open && "rotate-180")}>
          <ChevronIcon dir="down" />
        </span>
      </button>

      {open && (
        <div
          className={cn(
            "glass-popover motion-safe:animate-[glass-pop_320ms_cubic-bezier(0.34,1.56,0.64,1)_both]",
            "absolute top-full z-50 mt-2 w-[min(95vw,680px)] p-5",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          <div className="flex items-center gap-2 border-b border-line pb-4">
            <CalendarIcon />
            <p className="text-[14px] font-semibold text-ink">{t.dateRangePicker.title}</p>
            <div className="ml-auto flex items-center gap-2 text-[12.5px]">
              <span className="text-muted">{t.dateRangePicker.selectStart}</span>
              <input
                value={typedFrom}
                onChange={(event) => typeStart(event.target.value)}
                placeholder={order === "DMY" ? "dd/mm/aaaa" : "mm/dd/yyyy"}
                className="w-24 rounded-lg border border-line bg-ink/[0.03] px-2 py-1 text-center font-medium text-ink outline-none focus:border-accent dark:bg-white/5"
              />
              <ChevronIcon dir="right" />
              <span className="text-muted">{t.dateRangePicker.selectEnd}</span>
              <input
                value={typedTo}
                onChange={(event) => typeEnd(event.target.value)}
                placeholder={order === "DMY" ? "dd/mm/aaaa" : "mm/dd/yyyy"}
                className="w-24 rounded-lg border border-line bg-ink/[0.03] px-2 py-1 text-center font-medium text-ink outline-none focus:border-accent dark:bg-white/5"
              />
            </div>
          </div>

          {/* Presets: a vertical rail alongside the calendars from `sm` up; a horizontal, scrollable
              strip above them below `sm` — the sidebar would otherwise squeeze two calendars past
              the point of being usable on a phone. */}
          <div className="-mx-1 mt-4 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:hidden">
            {presetRanges().map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => applyPreset(preset)}
                className="shrink-0 rounded-full border border-line bg-ink/[0.03] px-3 py-1.5 text-[12px] font-medium text-ink transition hover:bg-ink/6 dark:bg-white/5 dark:hover:bg-white/8"
              >
                {presetLabel(t, preset.key)}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-4 sm:flex-row">
            <div className="hidden shrink-0 flex-col gap-1 sm:flex sm:w-40">
              {presetRanges().map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="rounded-xl px-3 py-1.5 text-left text-[12.5px] font-medium text-ink transition hover:bg-ink/6 dark:hover:bg-white/8"
                >
                  {presetLabel(t, preset.key)}
                </button>
              ))}
            </div>

            <div className="grid flex-1 grid-cols-1 gap-6 sm:grid-cols-2">
              <MonthCalendar
                month={leftMonth}
                onPrev={() => setLeftMonth((m) => addMonths(m, -1))}
                onNext={() => setLeftMonth((m) => addMonths(m, 1))}
                locale={locale}
                draftFrom={draftFrom}
                draftTo={draftTo}
                onPick={pickDay}
              />
              <MonthCalendar
                month={rightMonth}
                onPrev={() => setRightMonth((m) => addMonths(m, -1))}
                onNext={() => setRightMonth((m) => addMonths(m, 1))}
                locale={locale}
                draftFrom={draftFrom}
                draftTo={draftTo}
                onPick={pickDay}
              />
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-9 items-center rounded-full px-4 text-[13px] font-medium text-ink transition hover:bg-ink/6 dark:hover:bg-white/8"
            >
              {t.dateRangePicker.cancel}
            </button>
            <button
              type="button"
              onClick={apply}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[linear-gradient(to_bottom,color-mix(in_srgb,var(--color-accent)_100%,white_10%),var(--color-accent))] px-4 text-[13px] font-medium text-accent-ink shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_8px_20px_-8px_var(--color-accent)] transition hover:brightness-110"
            >
              <CheckIcon />
              {t.dateRangePicker.apply}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function presetLabel(t: ReturnType<typeof useLanguage>["t"], key: string): string {
  const map: Record<string, string> = {
    today: t.dateRangePicker.presetToday,
    yesterday: t.dateRangePicker.presetYesterday,
    tomorrow: t.dateRangePicker.presetTomorrow,
    thisWeek: t.dateRangePicker.presetThisWeek,
    lastWeek: t.dateRangePicker.presetLastWeek,
    thisMonth: t.dateRangePicker.presetThisMonth,
    lastMonth: t.dateRangePicker.presetLastMonth,
    firstHalf: t.dateRangePicker.presetFirstHalf,
    secondHalf: t.dateRangePicker.presetSecondHalf,
    fullYear: t.dateRangePicker.presetFullYear,
  };
  return map[key] ?? key;
}
