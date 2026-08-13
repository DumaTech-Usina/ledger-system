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
/**
 * What a listing of cash movements can be asked for. Every field is forwarded to the Ledger, which
 * owns the filtering — treasury adds no rule of its own, so a list can never disagree with the
 * figures folded over the same events.
 */
export interface CashMovementsQuery {
  /** Scopes to one party's statement. Absent lists the whole book's movements. */
  partyId?: string;
  /** `cash_in` or `cash_out`. Absent lists both, which is what a statement is. */
  effect?: string;
  /** ISO dates, passed through as the caller wrote them. Treasury never reinterprets a period. */
  from?: string;
  to?: string;
  limit?: number;
  /** A keyset position from a previous page. Carried opaque, never constructed here. */
  cursor?: string;
  /**
   * A numbered page. Mutually exclusive with `cursor` at the Ledger, which resolves the conflict in
   * the cursor's favour — treasury forwards both rather than deciding for it.
   */
  page?: number;
  /** `occurredAt` (default) or `recordedAt`. Validated by the Ledger against a closed set. */
  sortBy?: string;
  /** `ASC` or `DESC`. The Ledger defaults to DESC — a statement is read newest-first. */
  sortOrder?: string;
}

/** What a listing of positions can be asked for. Same passthrough rule as above. */
export interface PositionsQuery {
  limit?: number;
  page?: number;
  /** One status or several — the Ledger reads several as OR. */
  status?: string | string[];
  /** One object type or several, same rule. */
  objectType?: string | string[];
  /**
   * Positions a party is involved in — named on some standing event of the position, in any role.
   * One or several, read as OR. The Ledger calls it `partyId` because it does not know which side
   * is ours; treasury does, and applies that knowledge on the way out, never on the way in.
   */
  partyId?: string | string[];
  /** The economic outcome the Ledger derived (`gain`, `partial_loss`, …). */
  outcome?: string;
  /** ISO dates over when the position entered the book — the Ledger's `createdAt` axis. */
  from?: string;
  to?: string;
  /** `createdAt` (default) or `dueAt`. Validated by the Ledger against a closed set. */
  sortBy?: string;
  sortOrder?: string;
}

export interface LedgerReadPort {
  cashPosition(): Promise<CashPosition>;
  cashMovements(params?: CashMovementsQuery): Promise<CashMovementsPage>;
  /**
   * A page of positions. `page`/`limit` and the filters are passed through to the Ledger, which
   * owns paging — treasury never slices a page it did not ask for, because a silently truncated
   * list states something about the book that is not true.
   */
  positions(params?: PositionsQuery): Promise<PositionsPage>;
  /**
   * What the position math says about the whole book: exposure, capital at risk, book health.
   *
   * The period scopes only the Ledger's own period figures (cash in/out for the window). The
   * exposure totals are current-state by construction and are unaffected by it — publishing them
   * side by side is the Ledger's choice, and treasury passes both through without mixing them.
   */
  bookExposure(params?: { from?: string; to?: string }): Promise<BookExposure>;
}
