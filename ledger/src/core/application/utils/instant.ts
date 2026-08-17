/**
 * Reading an external date/time string as the instant its author meant.
 *
 * The book stores instants in UTC and always will — an instant is a point in time, and UTC is the
 * only way to write one down without an argument about where it was written. This is the other
 * half of that: turning what a caller WROTE into the instant they meant, which is a question about
 * a timezone, and the answer defaults to the usina's own (America/Sao_Paulo, see `config/env.ts`).
 *
 * Three shapes arrive, and JavaScript treats them differently:
 *
 *   "2026-09-14T10:00:00-03:00"  — carries its own offset. Unambiguous; nothing to decide.
 *   "2026-09-14T10:00:00"        — no offset. `new Date` reads it in the process timezone, which is
 *                                  what we want, and is why the timezone is set rather than left to
 *                                  the host.
 *   "2026-09-14"                 — date only. ECMAScript mandates UTC for this form, IGNORING the
 *                                  process timezone. In São Paulo that lands at 21:00 on the 13th —
 *                                  the day BEFORE the one written. A due date entered as the 14th
 *                                  would age as if it fell on the 13th, and an invoice would read
 *                                  as overdue a day early.
 *
 * The last case is the whole reason this function exists. Naming the midnight explicitly moves the
 * string into the second form, where the process timezone applies.
 */

/** `YYYY-MM-DD` and nothing else — the form ECMAScript resolves against UTC. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parses an external instant, reading a bare date as midnight LOCAL to the configured timezone.
 *
 * Returns an Invalid Date for unparseable input exactly as `new Date` does: this decides which
 * instant a string denotes, never whether the caller was allowed to send it. Validation stays with
 * the validators, which already reject an invalid date and say so.
 */
export function parseInstant(value: string): Date {
  return new Date(DATE_ONLY.test(value.trim()) ? `${value.trim()}T00:00:00` : value);
}

/** The nullable form, for the optional instants (`sourceAt`, `dueAt`). */
export function parseOptionalInstant(value: string | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  return parseInstant(value);
}
