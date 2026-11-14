import { ObjectType } from "../../domain/enums/ObjectType";
import { USINA_RECEIVABLE_OBJECT_TYPES } from "../../domain/policies/CashPositionPolicy";
import { LedgerEventRepository } from "../repositories/LedgerEventRepository";
import { PositionAggregate, PositionListItem } from "../dtos/PositionAggregate";
import { hasUnknownOrigination, openBalanceUnitsOf } from "../dtos/positionUtils";
import { PositionProjectionService } from "./PositionProjectionService";
import {
  AGENDA_MAX_LIMIT,
  AGENDA_WINDOWS,
  AgendaWindow,
  AgendaWindowSummary,
  DEFAULT_NEXT_DAYS,
  addDays,
  agendaDayOf,
  agendaWindowOf,
  byAge,
  byDueDate,
  summarizeUnits,
} from "./PayablesAgendaService";

/**
 * The agenda of what is owed to the Usina (treasury/docs/requisitos_refinados.md §8.7, REQ-660–665).
 *
 * The twin of the payables agenda, and like it a READING of the chain at a day: it changes no fact
 * and no rule. Three things are published, each with its totals, so whoever shows them never adds
 * money up on its own (REQ-601):
 *
 * - the open receivables, by expected date, in the same five windows as the payables;
 * - the same positions by payer — the position's parties other than the Usina, never guessed when
 *   there are none (REQ-662);
 * - the money that came in with no known origin. It has no open balance — it is nobody's debt — so it
 *   is not in any window; its total is what was received (REQ-664).
 */

/**
 * Everything someone owes the Usina. The expected commission is here although `openExposure` leaves
 * it out: that total measures the Usina's own credit, while the agenda answers "what should come in",
 * and the commission is exactly what the insurer is expected to pay (TODO-09).
 */
export const RECEIVABLES_AGENDA_OBJECT_TYPES = new Set<ObjectType>([...USINA_RECEIVABLE_OBJECT_TYPES, ObjectType.COMMISSION_RECEIVABLE]);

/** `window` also takes "unlinked": the receipts with no known origin. */
export type ReceivablesAgendaList = AgendaWindow | "unlinked";
export const RECEIVABLES_AGENDA_LISTS: readonly ReceivablesAgendaList[] = [...AGENDA_WINDOWS, "unlinked"];

export interface PayerSummary extends AgendaWindowSummary {
  /** The filter value for this payer: its party ids, sorted, joined by commas. "" for no payer named. */
  key: string;
  partyIds: string[];
}

export interface ReceivablesAgenda {
  asOf: string;
  windowDays: number;
  windows: Record<AgendaWindow, AgendaWindowSummary>;
  /** Receipts with no known origin: how many, and how much came in. */
  unlinked: AgendaWindowSummary;
  /** Every payer with something open, over all windows and regardless of the `payer` filter. */
  payers: PayerSummary[];
  /** The payer filter applied, or null for all. */
  payer: string | null;
  window: ReceivablesAgendaList;
  data: PositionListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ReceivablesAgendaQuery {
  asOf?: string;
  windowDays?: number;
  window?: ReceivablesAgendaList;
  /** A payer key (see `PayerSummary.key`); "" for the positions that name no payer. */
  payer?: string;
  page?: number;
  limit?: number;
}

/** Parties are looked up in slices, well under any bound on query parameters. */
const PARTY_LOOKUP_CHUNK = 500;

export class ReceivablesAgendaService {
  constructor(
    private readonly repo: LedgerEventRepository,
    private readonly positions: PositionProjectionService,
    /** The Usina's zone (REQ-225). */
    private readonly timeZone: string,
    /** The Usina's own party, which is never its own payer. */
    private readonly usinaPartyId: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async read(query: ReceivablesAgendaQuery = {}): Promise<ReceivablesAgenda> {
    const asOf = query.asOf ?? agendaDayOf(this.now(), this.timeZone);
    const windowDays = query.windowDays ?? DEFAULT_NEXT_DAYS;
    const window = query.window ?? "overdue";
    const limit = Math.min(Math.max(1, query.limit ?? 20), AGENDA_MAX_LIMIT);
    const page = Math.max(1, query.page ?? 1);
    const lastNextDay = addDays(asOf, windowDays);

    const open: PositionAggregate[] = [];
    const unlinked: PositionAggregate[] = [];
    for (const agg of await this.repo.findAllPositionAggregates()) {
      if (!RECEIVABLES_AGENDA_OBJECT_TYPES.has(agg.objectType) || agg.hasReversal) continue;
      if (isOpen(agg)) open.push(agg);
      else if (isUnlinkedReceipt(agg)) unlinked.push(agg);
    }

    const parties = await this.partiesOf([...open, ...unlinked].map((a) => a.objectId));
    const payerOf = (agg: PositionAggregate) => payerKey(parties.get(agg.objectId) ?? [], this.usinaPartyId);
    const payers = this.payerSummaries(open, payerOf);
    const mine = (agg: PositionAggregate) => query.payer === undefined || payerOf(agg) === query.payer;

    const byWindow: Record<AgendaWindow, PositionAggregate[]> = { overdue: [], today: [], next: [], later: [], undated: [] };
    for (const agg of open.filter(mine)) byWindow[agendaWindowOf(agg.dueAt, asOf, lastNextDay, this.timeZone)].push(agg);
    const theirUnlinked = unlinked.filter(mine);

    const listed = window === "unlinked" ? [...theirUnlinked].sort(byAge) : [...byWindow[window]].sort(window === "undated" ? byAge : byDueDate);
    const slice = listed.slice((page - 1) * limit, page * limit);
    const data = slice.map((agg) => this.positions.aggregateToListItem({ ...agg, parties: parties.get(agg.objectId) ?? [] }));

    return {
      asOf,
      windowDays,
      windows: Object.fromEntries(AGENDA_WINDOWS.map((w) => [w, summarizeUnits(byWindow[w], openUnits)])) as Record<AgendaWindow, AgendaWindowSummary>,
      unlinked: summarizeUnits(theirUnlinked, (agg) => agg.totalSettledUnits),
      payers,
      payer: query.payer ?? null,
      window,
      data,
      total: listed.length,
      page,
      limit,
      totalPages: Math.ceil(listed.length / limit),
    };
  }

  private payerSummaries(open: PositionAggregate[], payerOf: (agg: PositionAggregate) => string): PayerSummary[] {
    const groups = new Map<string, PositionAggregate[]>();
    for (const agg of open) {
      const key = payerOf(agg);
      const group = groups.get(key);
      if (group) group.push(agg);
      else groups.set(key, [agg]);
    }
    return [...groups]
      .map(([key, aggs]) => ({ key, partyIds: key === "" ? [] : key.split(","), ...summarizeUnits(aggs, openUnits) }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  }

  private async partiesOf(objectIds: string[]): Promise<Map<string, string[]>> {
    const all = new Map<string, string[]>();
    for (let i = 0; i < objectIds.length; i += PARTY_LOOKUP_CHUNK) {
      for (const [id, parties] of await this.repo.findPartiesOfObjects(objectIds.slice(i, i + PARTY_LOOKUP_CHUNK))) all.set(id, parties);
    }
    return all;
  }
}

const openUnits = (agg: PositionAggregate) => openBalanceUnitsOf(agg) ?? 0n;

/** Owed and still open: a known balance above zero. */
function isOpen(agg: PositionAggregate): boolean {
  const open = openBalanceUnitsOf(agg);
  return open !== null && open > 0n;
}

/** Money came in and no one knows yet what it was expected as (REQ-664). */
function isUnlinkedReceipt(agg: PositionAggregate): boolean {
  return hasUnknownOrigination(agg) && agg.totalSettledUnits > 0n;
}

/** The payer key: every party but the Usina, sorted and joined. "" when the position names nobody else. */
export function payerKey(parties: readonly string[], usinaPartyId: string): string {
  return [...new Set(parties.filter((p) => p !== usinaPartyId))].sort().join(",");
}
