import { USINA_PAYABLE_OBJECT_TYPES } from "../../domain/policies/CashPositionPolicy";
import { Money } from "../../domain/value-objects/Money";
import { LedgerEventRepository } from "../repositories/LedgerEventRepository";
import { PositionAggregate, PositionListItem } from "../dtos/PositionAggregate";
import { openBalanceUnitsOf } from "../dtos/positionUtils";
import { PositionProjectionService } from "./PositionProjectionService";

/**
 * The agenda of what the Usina owes (treasury/docs/requisitos_refinados.md §8.5, REQ-640–645).
 *
 * A READING of the chain at a day, never a stored state: the same obligation is "today" today and
 * "overdue" tomorrow with no event in between. It changes no fact and no rule — it only groups the
 * open payable positions by due window and publishes the total of each window, so that whoever shows
 * it never has to add money up on its own (REQ-601, REQ-642).
 *
 * The windows are calendar days in the Usina's zone, not instants: a due date at midnight in São Paulo
 * belongs to that day wherever the process runs. A position with no stated due date is "undated" —
 * never overdue and never today, because not knowing the terms is not being late.
 */

export const AGENDA_WINDOWS = ["overdue", "today", "next", "later", "undated"] as const;
export type AgendaWindow = (typeof AGENDA_WINDOWS)[number];

export const DEFAULT_NEXT_DAYS = 7;

export interface AgendaWindowSummary {
  count: number;
  /** Open amount per currency. The Ledger never adds two currencies together. */
  totals: Record<string, Money>;
}

export interface PayablesAgenda {
  asOf: string;
  windowDays: number;
  windows: Record<AgendaWindow, AgendaWindowSummary>;
  window: AgendaWindow;
  data: PositionListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PayablesAgendaQuery {
  /** The day the agenda is read at, `YYYY-MM-DD` in the Usina's zone. Defaults to today there. */
  asOf?: string;
  /** How many days after today count as "next". */
  windowDays?: number;
  /** Which window's lines to return. */
  window?: AgendaWindow;
  page?: number;
  limit?: number;
}

const MAX_LIMIT = 200;

/** The calendar day an instant falls on in `timeZone`, as `YYYY-MM-DD`. */
export function agendaDayOf(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

/** Calendar arithmetic on `YYYY-MM-DD`, free of any timezone. */
export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export const isAgendaDay = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && addDays(value, 0) === value;

export class PayablesAgendaService {
  constructor(
    private readonly repo: LedgerEventRepository,
    private readonly positions: PositionProjectionService,
    /** The Usina's zone (REQ-225). */
    private readonly timeZone: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async read(query: PayablesAgendaQuery = {}): Promise<PayablesAgenda> {
    const asOf = query.asOf ?? agendaDayOf(this.now(), this.timeZone);
    const windowDays = query.windowDays ?? DEFAULT_NEXT_DAYS;
    const window = query.window ?? "overdue";
    const limit = Math.min(Math.max(1, query.limit ?? 20), MAX_LIMIT);
    const page = Math.max(1, query.page ?? 1);
    const lastNextDay = addDays(asOf, windowDays);

    const byWindow: Record<AgendaWindow, PositionAggregate[]> = { overdue: [], today: [], next: [], later: [], undated: [] };
    for (const agg of await this.repo.findAllPositionAggregates()) {
      if (!this.isOwedAndOpen(agg)) continue;
      byWindow[this.windowOf(agg, asOf, lastNextDay)].push(agg);
    }

    const windows = Object.fromEntries(
      AGENDA_WINDOWS.map((w) => [w, this.summarize(byWindow[w])]),
    ) as Record<AgendaWindow, AgendaWindowSummary>;

    const ordered = [...byWindow[window]].sort(window === "undated" ? byAge : byDueDate);
    const slice = ordered.slice((page - 1) * limit, page * limit);
    const parties = await this.repo.findPartiesOfObjects(slice.map((a) => a.objectId));
    const data = slice.map((agg) => this.positions.aggregateToListItem({ ...agg, parties: parties.get(agg.objectId) ?? [] }));

    return {
      asOf,
      windowDays,
      windows,
      window,
      data,
      total: ordered.length,
      page,
      limit,
      totalPages: Math.ceil(ordered.length / limit),
    };
  }

  /**
   * REQ-640: of the kinds the Usina owes, with a known balance above zero. That one test is "still
   * open": settled leaves zero, a retracted origination leaves nothing, and an unknown origin (a payment
   * with no known obligation, which is not a debt) has no balance at all.
   */
  private isOwedAndOpen(agg: PositionAggregate): boolean {
    if (!USINA_PAYABLE_OBJECT_TYPES.has(agg.objectType) || agg.hasReversal) return false;
    const open = openBalanceUnitsOf(agg);
    return open !== null && open > 0n;
  }

  private windowOf(agg: PositionAggregate, asOf: string, lastNextDay: string): AgendaWindow {
    if (agg.dueAt === null) return "undated";
    const due = agendaDayOf(agg.dueAt, this.timeZone);
    if (due < asOf) return "overdue";
    if (due === asOf) return "today";
    if (due <= lastNextDay) return "next";
    return "later";
  }

  private summarize(aggs: PositionAggregate[]): AgendaWindowSummary {
    const units = new Map<string, bigint>();
    for (const agg of aggs) units.set(agg.currency, (units.get(agg.currency) ?? 0n) + (openBalanceUnitsOf(agg) ?? 0n));
    return {
      count: aggs.length,
      totals: Object.fromEntries([...units].map(([currency, u]) => [currency, Money.fromUnits(u, currency)])),
    };
  }
}

const openedAt = (a: PositionAggregate) => (a.originatedAt ?? a.createdAt).getTime();

/** Dated windows: the oldest due date first; then the one open the longest. */
function byDueDate(a: PositionAggregate, b: PositionAggregate): number {
  return a.dueAt!.getTime() - b.dueAt!.getTime() || openedAt(a) - openedAt(b) || a.objectId.localeCompare(b.objectId);
}

/** Undated: the one open the longest first (REQ-643). */
function byAge(a: PositionAggregate, b: PositionAggregate): number {
  return openedAt(a) - openedAt(b) || a.objectId.localeCompare(b.objectId);
}
