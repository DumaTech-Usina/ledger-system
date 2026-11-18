import type { Columns, Summary } from "@/features/morning/morningApi";

export type ColumnKey = "overdue" | string;

/** The panel's columns, in order: overdue, then today and each next day (REQ-682). */
export function columnKeys(c: Columns): ColumnKey[] {
  return ["overdue", ...c.days.map((d) => d.day)];
}

/** What a row holds in a column; a day the agenda did not publish is unknown, never empty. */
export function cell(c: Columns, key: ColumnKey): Summary | null {
  if (key === "overdue") return c.overdue;
  return c.days.find((d) => d.day === key) ?? null;
}

/** The BRL figure of a summary, or null when nothing is there. Other currencies are never added in. */
export function brlOf(s: Summary | null): string | null {
  if (!s || s.count === 0) return null;
  return s.totals.BRL ?? null;
}

/** A short day label in the reader's language, e.g. "qua 18/11". */
export function dayLabel(ymd: string, language: string): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  const weekday = new Intl.DateTimeFormat(language, { weekday: "short", timeZone: "UTC" }).format(d).replace(".", "");
  const date = new Intl.DateTimeFormat(language, { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(d);
  return `${weekday} ${date}`;
}
