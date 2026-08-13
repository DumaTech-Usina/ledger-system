import type { LedgerReadPort } from "../ports/LedgerReadPort";
import type { PartyDirectoryPort } from "../ports/PartyDirectoryPort";
import type { CashPosition, CashMovement, PositionItem } from "../dtos/LedgerReadModels";
import { computeClassificationHealth, type ClassificationHealth } from "../services/classificationHealth";

/** Positions fetched to compute the classification-health signal; the table shows a small slice. */
const HEALTH_SCAN_LIMIT = 500;
const DISPLAY_POSITIONS = 8;

export interface TreasuryDashboardInput {
  /**
   * ISO period. Scopes the two LISTS on the overview — the movements by occurrence, the positions
   * by when they entered the book. It does NOT scope `cashPosition`, which is the book's standing
   * cash and has no window; asking about last week does not make today's balance smaller.
   */
  from?: string;
  to?: string;
  /**
   * `cash_in` or `cash_out`, scoping the movements block to one direction. Absent shows both —
   * which is what the block always showed, and is not the same as "no direction chosen yet".
   */
  effect?: string;
  /** Rows per block, for both lists. Absent keeps the summary-sized slice of 8. */
  perPage?: number;
  /** Page of the positions block. */
  page?: number;
  /**
   * Page of the movements block, when the caller wants numbered pages there. Absent keeps the
   * cheaper keyset walk, which is what a summary block needs — the count a numbered page implies is
   * work nobody asked for while the block is showing its first rows.
   */
  movementsPage?: number;
  status?: string | string[];
  objectType?: string | string[];
}

/** Where the positions on screen came from and how much of the book they are a page of. */
export interface DashboardPositionsPage {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TreasuryDashboard {
  /** False when the Ledger could not be reached — the UI shows an unavailable notice. */
  available: boolean;
  cashPosition: CashPosition | null;
  movements: CashMovement[] | null;
  positions: PositionItem[] | null;
  /**
   * The paging the positions block above is a page of. Null when the Ledger is unreachable — never
   * a zeroed page, which would state that the book is empty rather than unread.
   */
  positionsPage: DashboardPositionsPage | null;
  /**
   * The Ledger's cursor for the next page of movements, and whether one exists. Null in numbered
   * mode: a numbered page names no keyset position, and offering one would invite a caller to
   * continue from somewhere it is not.
   */
  movementsCursor: string | null;
  movementsHasMore: boolean;
  /**
   * Where the movements block sits among the matching movements — published only when a numbered
   * page was asked for. Null otherwise, because nobody counted: never zero, which would say the
   * book holds no movements.
   */
  movementsPaging: DashboardPositionsPage | null;
  /** Generic/uncategorized-payment governance signal; null when the Ledger is unreachable. */
  classificationHealth: ClassificationHealth | null;
  /**
   * partyId → display name, for the counterparties appearing in `movements`. Kept BESIDE the
   * movements rather than inside them — the same separation `PreviewIntentResult.partyNames` makes,
   * and for the same reason: a CashMovement mirrors what the Ledger published, and the Ledger
   * publishes ids. A name is treasury's own knowledge and does not belong in that mirror.
   *
   * A party the Directory does not know is simply absent here, so the id stays on screen. An
   * invented label would be a claim treasury cannot support.
   */
  partyNames: Record<string, string>;
}

/** Rows per block, defaulting to the summary-sized slice. Clamped to the Ledger's own cap. */
export function clampSlice(perPage: number | undefined): number {
  if (perPage === undefined || !Number.isFinite(perPage)) return DISPLAY_POSITIONS;
  return Math.min(Math.max(1, Math.floor(perPage)), 200);
}

/**
 * Whether the requested positions slice is exactly the head of the scan the health signal already
 * fetched: first page, no filter, no period, and small enough to fit inside it.
 *
 * Pure so it can be tested on its own — the convention this codebase already follows, and the one
 * an inline predicate broke once before. Getting it wrong is not a display bug: a `true` for a
 * filtered request would show the unfiltered book under a filter the user chose.
 */
export function servedByScan(
  input: TreasuryDashboardInput,
  perPage: number,
  page: number,
): boolean {
  const selected = (v: string | string[] | undefined) =>
    v !== undefined && (Array.isArray(v) ? v.length > 0 : v !== "");
  return (
    page === 1 &&
    perPage <= HEALTH_SCAN_LIMIT &&
    !input.from &&
    !input.to &&
    !selected(input.status) &&
    !selected(input.objectType)
  );
}

/**
 * Composes the treasury dashboard from Ledger reads. If the Ledger is unreachable, degrades to an
 * `available: false` payload instead of failing — the User App must tolerate the Ledger being down.
 */
export class GetTreasuryDashboardUseCase {
  constructor(
    private readonly ledger: LedgerReadPort,
    private readonly usinaPartyId: string,
    private readonly directory: PartyDirectoryPort,
  ) {}

  async execute(input: TreasuryDashboardInput = {}): Promise<TreasuryDashboard> {
    const perPage = clampSlice(input.perPage);
    const page = input.page && input.page > 0 ? Math.floor(input.page) : 1;

    try {
      const [cashPosition, movements, scan] = await Promise.all([
        this.ledger.cashPosition(),
        this.ledger.cashMovements({
          partyId: this.usinaPartyId,
          effect: input.effect,
          from: input.from,
          to: input.to,
          limit: perPage,
          page: input.movementsPage && input.movementsPage > 0 ? Math.floor(input.movementsPage) : undefined,
        }),
        // Always the WHOLE book, never the filtered slice: the classification signal is governance
        // over everything recorded, and computing it from a filtered page would make it say
        // something about the filter instead of about the book.
        this.ledger.positions({ limit: HEALTH_SCAN_LIMIT }),
      ]);
      const classificationHealth = computeClassificationHealth(scan.data, scan.total, new Date());

      // The default slice IS the head of the scan already in hand — same order, same filters — so
      // it is taken from it rather than read again. Anything else is a different question and gets
      // its own read, with the Ledger owning the paging.
      const slice = servedByScan(input, perPage, page)
        ? {
            data: scan.data.slice(0, perPage),
            total: scan.total,
            page: 1,
            limit: perPage,
            // Arithmetic over the Ledger's own total — paging metadata, not a financial figure.
            totalPages: Math.max(1, Math.ceil(scan.total / perPage)),
          }
        : await this.ledger.positions({
            page,
            limit: perPage,
            status: input.status,
            objectType: input.objectType,
            from: input.from,
            to: input.to,
          });

      return {
        available: true,
        cashPosition,
        movements: movements.items,
        positions: slice.data,
        positionsPage: {
          total: slice.total,
          page: slice.page,
          limit: slice.limit,
          totalPages: slice.totalPages,
        },
        movementsCursor: movements.nextCursor ?? null,
        movementsHasMore: movements.hasMore === true,
        // Passed through as the Ledger published it. Absent there means the same as null here.
        movementsPaging:
          movements.total !== undefined && movements.total !== null
            ? {
                total: movements.total,
                page: movements.page ?? 1,
                limit: perPage,
                totalPages: movements.totalPages ?? 1,
              }
            : null,
        classificationHealth,
        partyNames: await this.nameCounterparties(movements.items),
      };
    } catch {
      return {
        available: false,
        cashPosition: null,
        movements: null,
        positions: null,
        positionsPage: null,
        movementsCursor: null,
        movementsHasMore: false,
        movementsPaging: null,
        classificationHealth: null,
        partyNames: {},
      };
    }
  }

  /**
   * Looks up a display name for each counterparty on screen. Deliberately outside the failure path
   * above: a Directory that is down does not make the Ledger's figures unavailable, so it degrades
   * to ids rather than taking the whole dashboard with it. Names are legibility, not truth.
   */
  private async nameCounterparties(movements: CashMovement[]): Promise<Record<string, string>> {
    const ids = [
      ...new Set(
        movements
          // Every party the movements now carry, not only the counterparty: the same map serves
          // both, and a party the Directory does not know stays absent from it either way.
          .flatMap((m) => [m.counterparty, ...(m.parties ?? []).map((p) => p.partyId)])
          .filter((id): id is string => id !== null && id !== undefined),
      ),
    ];
    if (ids.length === 0) return {};

    try {
      const parties = await Promise.all(ids.map((id) => this.directory.get(id)));
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
