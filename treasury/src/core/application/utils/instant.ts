/**
 * Reading a date the user typed as the instant they meant.
 *
 * A CFO answering "quando vence?" writes a day — `2026-09-14` — and means that day, here. But
 * ECMAScript resolves a date-only string against UTC regardless of the process timezone, so
 * `new Date("2026-09-14").toISOString()` yields `2026-09-14T00:00:00.000Z`, which in São Paulo is
 * 21:00 on the 13th. That string then travels to the Ledger carrying an explicit `Z`, so the Ledger
 * honours it exactly as sent and records the obligation as falling due a day early.
 *
 * This is the boundary where that is decided: Treasury converts the answer to an instant, and the
 * Ledger's job is to record what it was sent, not to second-guess it. Naming the midnight moves the
 * string into the form the process timezone applies to — `America/Sao_Paulo` by default, see
 * `config/env.ts`. The Ledger applies the same rule to anything that reaches it unconverted.
 */

/** `YYYY-MM-DD` and nothing else — the form ECMAScript resolves against UTC. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Parses a user-supplied instant, reading a bare date as midnight in the configured timezone. */
export function parseInstant(value: string): Date {
  const trimmed = value.trim();
  return new Date(DATE_ONLY.test(trimmed) ? `${trimmed}T00:00:00` : trimmed);
}

/** The same, already in the form sent over the wire to the Ledger. */
export function toInstantISO(value: string): string {
  return parseInstant(value).toISOString();
}
