import type { LedgerEventRef } from "../dtos/LedgerReadModels";

/**
 * Read-only boundary for a single Ledger event. Kept apart from the other read ports for the same
 * reason they are kept apart from each other: they answer different questions and are consumed by
 * different use cases.
 *
 * It exists so a rectification can describe what it corrects using the Ledger's own record of it,
 * instead of asking an operator to retype an amount and an object id the Ledger already holds.
 * `null` means the Ledger knows no such event — a legitimate answer, not an error.
 */
export interface LedgerEventLookupPort {
  event(eventId: string): Promise<LedgerEventRef | null>;
}
