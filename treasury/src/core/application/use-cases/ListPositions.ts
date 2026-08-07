import type { LedgerReadPort } from "../ports/LedgerReadPort";
import type { PositionsPage } from "../dtos/LedgerReadModels";

/** Page size the positions list asks for. The Ledger caps at 200; this stays well inside it. */
const PAGE_SIZE = 20;

export interface ListPositionsInput {
  page?: number;
  status?: string;
  objectType?: string;
}

export interface ListPositionsResult {
  available: boolean;
  page: PositionsPage | null;
}

/**
 * A page of positions, straight from the Ledger's own paging.
 *
 * Deliberately not served from {@link GetTreasuryDashboardUseCase}, which reads a fixed slice of
 * eight to compose an overview. Eight is fine for a summary card and false for a list: a truncated
 * list states that the book holds only what it shows. Here the Ledger owns page, limit and total,
 * and treasury passes them through without slicing anything of its own.
 *
 * Filters are forwarded because the Ledger already validates them (unknown values are ignored
 * there); treasury adds no filtering rule of its own, so the list can never disagree with the
 * figures computed over the same filters.
 */
export class ListPositionsUseCase {
  constructor(
    private readonly ledger: LedgerReadPort,
    /**
     * Remembers what this page answered with, so opening one of these positions can paint before
     * the Ledger replies. Optional: the listing works identically without it, because the snapshot
     * is never the source of the answer — only a head start on it.
     */
    private readonly remember: (positions: PositionsPage["data"]) => void = () => {},
  ) {}

  async execute(input: ListPositionsInput = {}): Promise<ListPositionsResult> {
    try {
      const page = await this.ledger.positions({
        page: input.page && input.page > 0 ? input.page : 1,
        limit: PAGE_SIZE,
        status: input.status,
        objectType: input.objectType,
      });
      this.remember(page.data);
      return { available: true, page };
    } catch {
      return { available: false, page: null };
    }
  }
}
