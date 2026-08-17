import type { LedgerReadPort } from "../ports/LedgerReadPort";
import type { PartyDirectoryPort } from "../ports/PartyDirectoryPort";
import type { PositionsPage } from "../dtos/LedgerReadModels";

/** Default page size. The caller may ask for another; the Ledger caps at 200 either way. */
const PAGE_SIZE = 20;
/** The Ledger's own cap, repeated here so an absurd `per_page` is clamped rather than round-tripped. */
const MAX_PAGE_SIZE = 200;

export interface ListPositionsInput {
  page?: number;
  /** Rows per page. Clamped to [1, 200]; absent keeps the default of 20. */
  perPage?: number;
  /** One status or several — several are read as OR by the Ledger. */
  status?: string | string[];
  /** One object type or several, same rule. */
  objectType?: string | string[];
  /** Parties the position must involve — one or several, read as OR by the Ledger. */
  partyId?: string | string[];
  outcome?: string;
  /** ISO period over when the position entered the book. Validated and applied by the Ledger. */
  from?: string;
  to?: string;
  /** `createdAt` (default) or `dueAt`, and the direction. Both closed sets, checked by the Ledger. */
  sortBy?: string;
  sortOrder?: string;
}

export interface ListPositionsResult {
  available: boolean;
  page: PositionsPage | null;
  /**
   * The parties this listing was filtered by, echoed back.
   *
   * Not a derived figure — it is the request, returned so the screen can mark WHICH of a position's
   * parties matched without re-deriving the intersection per row, and without the caller having to
   * remember what it asked. A position is shown whole, with everyone involved visible; the
   * selection is highlighted among them rather than substituted for them.
   */
  selectedParties: string[];
  /**
   * Which party id is us.
   *
   * The Ledger publishes every party it recorded and deliberately says nothing about which side is
   * ours — it was never told. Treasury was: it holds `usinaPartyId` in configuration, and this is
   * where that knowledge is applied. Published rather than filtered out, so the screen can hide or
   * mark it without a second copy of the configuration living in the client.
   */
  selfPartyId: string;
  /**
   * Display names for the parties this page names, keyed by id.
   *
   * Sits BESIDE the page rather than inside its rows — the same separation `ObjectLifecycleView` and
   * `TreasuryDashboard` make, and for the same reason: the page mirrors what the Ledger published,
   * and the Ledger publishes ids. A name is treasury's own knowledge, not a figure it may add to the
   * Ledger's answer.
   *
   * A party the Directory does not know is simply absent from the map, so its id stays on screen.
   */
  partyNames: Record<string, string>;
}

/** One value or several, as the list of values. Empty means no selection was made. */
export function asValues(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return (Array.isArray(value) ? value : [value]).filter((v) => v !== "");
}

/**
 * The requested page size, or the default when none was asked for.
 *
 * Clamped rather than forwarded raw: the Ledger caps at 200 and would answer a request for 5000
 * with 200 without saying so, which makes the reply's `limit` disagree with the request. Clamping
 * here keeps the page the caller is told about the page it actually gets.
 */
export function clampPageSize(perPage: number | undefined): number {
  if (perPage === undefined || !Number.isFinite(perPage)) return PAGE_SIZE;
  return Math.min(Math.max(1, Math.floor(perPage)), MAX_PAGE_SIZE);
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
    /** Which party is us. Applied to the DISPLAY of parties, never to the filter sent to the Ledger. */
    private readonly usinaPartyId: string = "",
    /**
     * Remembers what this page answered with, so opening one of these positions can paint before
     * the Ledger replies. Optional: the listing works identically without it, because the snapshot
     * is never the source of the answer — only a head start on it.
     */
    private readonly remember: (positions: PositionsPage["data"]) => void = () => {},
    /**
     * Optional: without it the listing answers with ids alone, which is exactly what it does for a
     * party the Directory does not know. Names are legibility, not truth, so their absence never
     * changes what the screen asserts.
     */
    private readonly directory?: PartyDirectoryPort,
  ) {}

  async execute(input: ListPositionsInput = {}): Promise<ListPositionsResult> {
    try {
      const page = await this.ledger.positions({
        page: input.page && input.page > 0 ? input.page : 1,
        limit: clampPageSize(input.perPage),
        status: input.status,
        objectType: input.objectType,
        partyId: input.partyId,
        outcome: input.outcome,
        from: input.from,
        to: input.to,
        sortBy: input.sortBy,
        sortOrder: input.sortOrder,
      });
      this.remember(page.data);
      return {
        available: true,
        page,
        selectedParties: asValues(input.partyId),
        selfPartyId: this.usinaPartyId,
        partyNames: await this.nameParties(page.data),
      };
    } catch {
      // Unknown, not empty: the selection is still what was asked for, and the identity of our own
      // side did not stop being true because the Ledger could not be reached.
      return {
        available: false,
        page: null,
        selectedParties: asValues(input.partyId),
        selfPartyId: this.usinaPartyId,
        partyNames: {},
      };
    }
  }

  /**
   * Looks up a display name for every party this page names, once per distinct id.
   *
   * Deliberately outside the failure path above: a Directory that is down costs labels, never rows,
   * so it degrades to ids rather than taking the whole listing with it.
   */
  private async nameParties(positions: PositionsPage["data"]): Promise<Record<string, string>> {
    if (!this.directory) return {};

    // Deduplicated on purpose: a page of 200 rows sharing a handful of counterparties costs a
    // handful of lookups, not one per row.
    const ids = [...new Set(positions.flatMap((position) => position.parties ?? []))];
    if (ids.length === 0) return {};

    try {
      const parties = await Promise.all(ids.map((id) => this.directory!.get(id)));
      const names: Record<string, string> = {};
      for (const party of parties) {
        if (party) names[party.partyId] = party.displayName;
      }
      return names;
    } catch {
      return {};
    }
  }
}
