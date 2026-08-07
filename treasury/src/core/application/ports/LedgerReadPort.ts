import type {
  BookExposure,
  CashPosition,
  CashMovementsPage,
  PositionsPage,
} from "../dtos/LedgerReadModels";

/**
 * Read-only boundary to the Ledger's financial truth. The concrete adapter talks HTTP to the
 * Ledger's published read API. treasury never writes through this and never recomputes figures.
 */
export interface LedgerReadPort {
  cashPosition(): Promise<CashPosition>;
  cashMovements(params: { partyId: string; limit?: number }): Promise<CashMovementsPage>;
  /**
   * A page of positions. `page`/`limit` and the filters are passed through to the Ledger, which
   * owns paging — treasury never slices a page it did not ask for, because a silently truncated
   * list states something about the book that is not true.
   */
  positions(params?: {
    limit?: number;
    page?: number;
    status?: string;
    objectType?: string;
    /** `createdAt` (default) or `dueAt`. Validated by the Ledger against a closed set. */
    sortBy?: string;
    sortOrder?: string;
  }): Promise<PositionsPage>;
  /** What the position math says about the whole book: exposure, capital at risk, book health. */
  bookExposure(): Promise<BookExposure>;
}
