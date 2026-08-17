import { ValueTransformer } from 'typeorm';

/**
 * Stores an instant as an ISO-8601 string in UTC (`2026-08-14T12:00:00.000Z`).
 *
 * SQLite has no date type, so the format is a decision rather than a detail, and this one is the
 * only one that keeps all three properties the book depends on:
 *
 *  - **Unambiguous.** The trailing `Z` is what makes `new Date(value)` mean the same instant
 *    everywhere. SQLite's own `YYYY-MM-DD HH:MM:SS` convention has no offset, so JavaScript reads
 *    it back as LOCAL time — a book written in São Paulo and read in a UTC container would move
 *    every timestamp by three hours, silently.
 *  - **Ordered.** ISO-8601 UTC sorts lexicographically exactly as it sorts chronologically, so
 *    `ORDER BY occurred_at` and the keyset comparisons on the cash statement stay correct with no
 *    conversion in SQL.
 *  - **Comparable as a parameter.** The raw queries bind instants as strings (better-sqlite3 binds
 *    no Date objects at all), and a bound ISO string compares against a stored one directly.
 *
 * The fixed millisecond precision matters for ordering: `toISOString()` always pads to three
 * digits, so no two strings compare wrongly because one is shorter than the other.
 */
export const isoDateTransformer: ValueTransformer = {
  to: (value: Date | null | undefined): string | null => {
    if (value === null || value === undefined) return null;
    return value.toISOString();
  },
  from: (value: string | null | undefined): Date | null => {
    if (value === null || value === undefined) return null;
    return new Date(value);
  },
};

/** The same instant format, for binding a Date into a raw query's parameters. */
export function toIso(value: Date): string {
  return value.toISOString();
}
