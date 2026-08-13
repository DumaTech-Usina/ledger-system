import type { LedgerReadPort } from "../ports/LedgerReadPort";
import type { CashMovementsPage } from "../dtos/LedgerReadModels";

/** Default rows per request. The Ledger caps at 200; this stays well inside it. */
const PAGE_SIZE = 50;
/** The Ledger's own cap, repeated so an absurd limit is clamped rather than round-tripped. */
const MAX_PAGE_SIZE = 200;

export interface ListCashMovementsInput {
  /**
   * Scopes the listing to one party's statement. Absent lists the whole book's movements — the
   * question "what moved", which is not the same as "what moved for us" and must not be silently
   * turned into it by defaulting to the usina.
   */
  partyId?: string;
  /** `cash_in` or `cash_out`. Absent lists both; the Ledger refuses anything else. */
  effect?: string;
  /** ISO period over occurrence, applied by the Ledger. */
  from?: string;
  to?: string;
  limit?: number;
  /** The Ledger's own cursor from a previous page. Carried opaque, never constructed here. */
  cursor?: string;
  /**
   * A numbered page. Costs the Ledger a count over the filtered set, which is why it is the caller's
   * choice: a screen that only walks forward should stay on the cursor and pay nothing for it.
   */
  page?: number;
  /** `occurredAt` (default, when the money moved) or `recordedAt` (when the book learned of it). */
  sortBy?: string;
  /** `ASC` or `DESC`. Absent keeps the Ledger's default of newest first. */
  sortOrder?: string;
}

export interface ListCashMovementsResult {
  available: boolean;
  page: CashMovementsPage | null;
}

/**
 * A page of cash movements, straight from the Ledger's own listing.
 *
 * Deliberately not served from {@link GetTreasuryDashboardUseCase}, which reads a fixed slice of
 * eight to compose an overview — the same distinction {@link ListPositionsUseCase} makes, for the
 * same reason: a fixed slice is fine for a summary card and false for a list, because a truncated
 * list states that the book holds only what it shows.
 *
 * Filters are forwarded, never applied here. In particular the direction filter is the Ledger's:
 * receiving both directions and dropping half would produce a page whose `hasMore` and cursor
 * describe a different list than the one on screen.
 *
 * Paging is the Ledger's cursor, passed through opaque. Treasury publishes no page number over it,
 * because it has none — inventing one would claim a total the Ledger never stated.
 *
 * Degrades to `available: false` rather than throwing, like every other read here: an unreachable
 * Ledger means the movements are unknown, and unknown is never an empty list — that would state
 * that nothing moved.
 */
export class ListCashMovementsUseCase {
  constructor(private readonly ledger: LedgerReadPort) {}

  async execute(input: ListCashMovementsInput = {}): Promise<ListCashMovementsResult> {
    try {
      const page = await this.ledger.cashMovements({
        partyId: input.partyId,
        effect: input.effect,
        from: input.from,
        to: input.to,
        limit: clampLimit(input.limit),
        cursor: input.cursor,
        page: input.page && input.page > 0 ? Math.floor(input.page) : undefined,
        sortBy: input.sortBy,
        sortOrder: input.sortOrder,
      });
      return { available: true, page };
    } catch {
      return { available: false, page: null };
    }
  }
}

/** The requested size, or the default. Clamped so the reply describes the page actually returned. */
export function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return PAGE_SIZE;
  return Math.min(Math.max(1, Math.floor(limit)), MAX_PAGE_SIZE);
}
