import type { PositionLifecycle } from "../dtos/LedgerReadModels";

/**
 * Read-only boundary to the life of ONE economic object. Kept apart from {@link LedgerReadPort} —
 * which serves the dashboard's aggregates — because they answer different questions and are consumed
 * by different use cases; the same adapter may implement both. `null` means the Ledger knows no such
 * object: a legitimate answer, not an error.
 */
export interface PositionLifecyclePort {
  lifecycle(objectId: string): Promise<PositionLifecycle | null>;
}
