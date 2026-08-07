/** One event as the cursor reads it: what it is, and which positions it touched. */
export interface RecordedEvent {
  eventId: string;
  objectIds: string[];
}

/**
 * Read-only boundary for "what was written to the Ledger since I last looked".
 *
 * Ordered by `recordedAt` — when the fact was WRITTEN — and never by `occurredAt`, which cannot
 * answer this: a payroll recognition dated March and recorded in April is new to a reader in April
 * and would never surface at the top of an occurrence-ordered feed.
 *
 * It exists so the snapshot can be kept honest against writers treasury knows nothing about: the
 * staging pipeline and the workers write to the same book, and their events appear in this same
 * cursor. Without it, drift from those producers is unbounded.
 */
export interface LedgerEventFeedPort {
  recentlyRecorded(limit: number, page?: number): Promise<RecordedEvent[]>;
}
