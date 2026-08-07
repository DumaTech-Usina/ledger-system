import type { LedgerReadPort } from "../ports/LedgerReadPort";
import type { PositionItem } from "../dtos/LedgerReadModels";

/**
 * Object types where Usina is the debtor — the positions whose open balance is money expected to
 * LEAVE the company.
 *
 * Mirrors `USINA_PAYABLE_OBJECT_TYPES` in the Ledger (`CashPositionPolicy.ts`), which is what the
 * Ledger's own `openPayableExposure` is folded over. The two must not drift: if they did, this
 * screen would list positions that the figure above them does not count, or vice versa.
 *
 * It lives twice because the Ledger's positions endpoint filters one object type at a time and does
 * not publish "is this a payable" as a queryable property. Duplicating the set is the smaller evil
 * against inventing a Ledger endpoint for a question the Ledger already answers in aggregate.
 */
const PAYABLE_OBJECT_TYPES = [
  "payable",
  "payroll",
  "service_fee",
  "infrastructure_cost",
  "tax",
] as const;

/** Statuses that can still hold an open balance. `unknown_origin` is excluded on purpose — see below. */
const OPEN_STATUSES = ["open", "partially_settled"] as const;

/** Per (type × status) request. The Ledger caps at 200; hitting it is reported, never hidden. */
const PER_QUERY_LIMIT = 200;

export interface PayablePositionsResult {
  available: boolean;
  /** Past its stated due date and still outstanding. */
  overdue: PositionItem[];
  /** Stated due date still ahead, still outstanding. */
  upcoming: PositionItem[];
  /**
   * Outstanding, but the fact that established it stated no due date. Neither late nor upcoming —
   * published separately so neither of the other two silently absorbs it.
   */
  undated: PositionItem[];
  /**
   * True when some query came back at the cap, so the lists are a prefix of the book rather than all
   * of it. The card totals come from the Ledger's own fold and stay correct either way; this only
   * says the LIST below them is incomplete, which the screen must state rather than imply.
   */
  truncated: boolean;
}

/**
 * The payable positions behind the "upcoming" and "overdue" figures, split by what the book knows
 * about their timing.
 *
 * Deliberately does NOT compute the totals. Those come from the Ledger's `openPayableExposure` and
 * its overdue/upcoming/undated split, folded over every aggregate — a total derived here from a
 * capped list would quietly disagree with the Ledger the moment the book outgrew the cap.
 *
 * `unknown_origin` positions are left out: they declare that an origination exists and is not known,
 * so their open balance is not computable. The Ledger already excludes them from the totals for the
 * same reason, and listing them under a figure that does not count them would be a mismatch on screen.
 */
export class ListPayablePositionsUseCase {
  constructor(private readonly ledger: LedgerReadPort) {}

  async execute(asOf: Date = new Date()): Promise<PayablePositionsResult> {
    try {
      const queries = PAYABLE_OBJECT_TYPES.flatMap((objectType) =>
        OPEN_STATUSES.map((status) =>
          this.ledger.positions({
            objectType,
            status,
            limit: PER_QUERY_LIMIT,
            sortBy: "dueAt",
            sortOrder: "ASC",
          }),
        ),
      );

      const pages = await Promise.all(queries);
      const truncated = pages.some((page) => page.data.length >= PER_QUERY_LIMIT);

      const outstanding = pages
        .flatMap((page) => page.data)
        // Balance, not status: a cash-basis position is reported `open` by the Ledger because
        // nothing was originated to close against, yet nothing is owed on it. A null balance is an
        // unknown origination — not zero, and not outstanding either.
        .filter((p) => p.openBalance !== null && Number(p.openBalance) > 0);

      const overdue: PositionItem[] = [];
      const upcoming: PositionItem[] = [];
      const undated: PositionItem[] = [];

      for (const position of outstanding) {
        if (position.dueAt === null) undated.push(position);
        else if (new Date(position.dueAt) < asOf) overdue.push(position);
        else upcoming.push(position);
      }

      // Nearest deadline first within each list. The Ledger already ordered each query, but the
      // lists are stitched from several of them, so the order has to be re-established across them.
      const byDueDate = (a: PositionItem, b: PositionItem) =>
        new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime();
      overdue.sort(byDueDate);
      upcoming.sort(byDueDate);

      return { available: true, overdue, upcoming, undated, truncated };
    } catch {
      // An unreachable Ledger means the lists are unknown, and unknown is reported as unavailable —
      // never as three empty lists, which would read as a book with nothing outstanding.
      return { available: false, overdue: [], upcoming: [], undated: [], truncated: false };
    }
  }
}
