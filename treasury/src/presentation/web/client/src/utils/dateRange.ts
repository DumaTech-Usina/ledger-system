/**
 * Calendar math for `DateRangePicker`. Works in local calendar days throughout (a "day" is a
 * `Date` at local midnight); the ISO boundary — the `yyyy-mm-dd` strings the API and the rest of
 * the app trade in — only happens at `toISO`/`fromISO`, mirroring how `DashboardPage.defaultPeriod`
 * already serializes a period.
 */

export type DateOrder = "DMY" | "MDY";

/** `pt-BR` types day-first, `en` types month-first — the same split the app already keys `language` on. */
export function orderFor(language: "pt-BR" | "en"): DateOrder {
  return language === "pt-BR" ? "DMY" : "MDY";
}

export function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** `null` for an empty/unparsable string — never today, never a guess. */
export function fromISO(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/** Monday-start week, matching the pt-BR calendar convention this app's audience uses. */
export function startOfWeek(date: Date): Date {
  const day = date.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(startOfDay(date), diff);
}

export function sameDay(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function isBefore(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() < startOfDay(b).getTime();
}

export function isWithin(day: Date, from: Date | null, to: Date | null): boolean {
  if (!from || !to) return false;
  const t = startOfDay(day).getTime();
  return t > startOfDay(from).getTime() && t < startOfDay(to).getTime();
}

/**
 * A 6-row day grid for the given month, padded with the trailing days of the previous month and
 * the leading days of the next — a fixed 42-cell grid so the panel's height never jumps as the
 * user pages between months.
 */
export function monthGrid(month: Date): { date: Date; inMonth: boolean }[] {
  const first = startOfMonth(month);
  const gridStart = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => {
    const date = addDays(gridStart, i);
    return { date, inMonth: date.getMonth() === month.getMonth() };
  });
}

export interface PresetRange {
  key: string;
  from: Date;
  to: Date;
}

/** The ten quick ranges the picker offers, computed from "now" at call time. */
export function presetRanges(now: Date = new Date()): PresetRange[] {
  const today = startOfDay(now);
  const yesterday = addDays(today, -1);
  const tomorrow = addDays(today, 1);
  const weekStart = startOfWeek(today);
  const lastWeekStart = addDays(weekStart, -7);
  const monthStart = startOfMonth(today);
  const lastMonthStart = addMonths(monthStart, -1);
  const lastMonthEnd = addDays(monthStart, -1);
  const year = today.getFullYear();

  return [
    { key: "today", from: today, to: today },
    { key: "yesterday", from: yesterday, to: yesterday },
    { key: "tomorrow", from: tomorrow, to: tomorrow },
    { key: "thisWeek", from: weekStart, to: addDays(weekStart, 6) },
    { key: "lastWeek", from: lastWeekStart, to: addDays(lastWeekStart, 6) },
    { key: "thisMonth", from: monthStart, to: endOfMonth(today) },
    { key: "lastMonth", from: lastMonthStart, to: lastMonthEnd },
    { key: "firstHalf", from: new Date(year, 0, 1), to: new Date(year, 5, 30) },
    { key: "secondHalf", from: new Date(year, 6, 1), to: new Date(year, 11, 31) },
    { key: "fullYear", from: new Date(year, 0, 1), to: new Date(year, 11, 31) },
  ];
}

/** `08022026` → `08/02/2026` as it's typed, regardless of what day/month/year it will mean. */
export function maskTypedDigits(raw: string): string {
  const digits = raw.replace(/\D+/g, "").slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter((p) => p !== "");
  return parts.join("/");
}

/**
 * A full 8-digit typed date, read in the given order. `null` while incomplete, and `null` again if
 * the digits don't name a real day (`31/02` rolls over in a plain `Date` and must not silently
 * resolve to March 3rd).
 */
export function parseTypedDigits(raw: string, order: DateOrder): Date | null {
  const digits = raw.replace(/\D+/g, "");
  if (digits.length !== 8) return null;
  const first = Number(digits.slice(0, 2));
  const second = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));
  const day = order === "DMY" ? first : second;
  const month = order === "DMY" ? second : first;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

/** The compact trigger's display, in the order the current language types dates. */
export function formatDisplay(date: Date, order: DateOrder): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return order === "DMY" ? `${d}/${m}/${y}` : `${m}/${d}/${y}`;
}
