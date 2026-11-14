import { PartyIdentityState } from "../../domain/enums/PartyIdentityState";
import { IntentStatus } from "../../domain/enums/IntentStatus";
import type { PartyEvent, PositionLifecycle, PositionsPage } from "../dtos/LedgerReadModels";
import type { Clock } from "../ports/Clock";
import type { PartyDirectoryPort } from "../ports/PartyDirectoryPort";
import type { PositionsQuery } from "../ports/LedgerReadPort";
import type { ExternalSignalRepository } from "../repositories/ExternalSignalRepository";
import type { IntentRepository } from "../repositories/IntentRepository";
import { toCents } from "../utils/cents";

/**
 * Which side of the page a position sits on (REQ-632), by kind. The Ledger publishes who took part in
 * a position, not which side is the usina's, so the side is Treasury's reading of the kind.
 *
 * `USINA_OWES` mirrors `USINA_PAYABLE_OBJECT_TYPES` in the Ledger (`CashPositionPolicy.ts`).
 * `PARTY_OWES` is `USINA_RECEIVABLE_OBJECT_TYPES` plus the commission expected from an insurer: the
 * Ledger leaves that one out of its exposure figure, but on the insurer's page it is plainly something
 * the insurer owes the usina. A kind in neither set is listed apart (`unclassified`), never dropped.
 */
export const USINA_OWES = new Set(["payable", "commission_payable", "payroll", "service_fee", "infrastructure_cost", "tax"]);
export const PARTY_OWES = new Set(["loan", "advance", "receivable", "commission_receivable"]);

/** The Ledger's contextual kinds (DEC-036): they say what a fact was about and hold no balance. */
const CONTEXTUAL = new Set(["contract", "proposal", "installment", "settlement_batch", "campaign", "cash_account"]);

/** The expectations a "depende de" block may show: what an insurer is expected to pay the usina. */
const EXPECTATIONS = new Set(["commission_receivable"]);

/** The payouts the "pago sem obrigação" alert looks at, for now (REQ-634, DEC-032). */
const ALERT_PAID_WITHOUT_OBLIGATION = new Set(["commission_payable"]);

/**
 * What a side lists: positions with a known baseline still outstanding. `unknown_origin` stays out:
 * its balance is unknown, so it cannot be a line with an amount; it shows in the history.
 */
const SIDE_STATUSES = ["open", "partially_settled"];
/** How many positions one alert scan reads. Hitting it is reported (`alertsPartial`), never hidden. */
const ALERT_SCAN_LIMIT = 200;
export const DEFAULT_SIDE_LIMIT = 20;
export const MAX_SIDE_LIMIT = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Which answers of a proposed intent name a party: every PARTY slot of the scenarios is one of these. */
const PARTY_SLOTS = ["payee", "payer"];

export interface DependsOn {
  objectId: string;
  objectType: string;
  /** Who is expected to pay it, as the origination recorded. Null when it named no payer. */
  payerId: string | null;
  payerName: string | null;
  /** The Ledger's figures, never recomputed. Null balance = origination unknown, never zero. */
  openBalance: string | null;
  totalSettled: string;
  context: string;
}

export interface PageLine {
  objectId: string;
  objectType: string;
  status: string;
  openBalance: string | null;
  totalOriginated: string;
  originatedAt: string | null;
  dueAt: string | null;
  /** Whole days since the origination. Null when the origination date is unknown, never zero. */
  ageDays: number | null;
  /** The contexts named beside this position by the standing facts of this party. */
  contexts: string[];
  dependsOn: DependsOn[];
}

export type PageAlert =
  | { code: "paid_without_obligation"; objectId: string }
  | { code: "provisional_identity" }
  | { code: "obligation_overdue"; objectId: string; dueAt: string };

/** Who recorded something: a user of Treasury or an external system. `name` null when not known. */
export interface Author {
  type: string;
  id: string;
  name: string | null;
}

/** One fact of the party's history, with who recorded it and, when withdrawn, who withdrew it. */
export type HistoryFact = Omit<PartyEvent, "reporter" | "retractedBy"> & {
  kind: "fact";
  /** The parts this party plays in the event, and the identifier each was recorded under. */
  roles: { role: string; direction: string; recordedAs: string }[];
  /** Null when the Ledger did not say who recorded it. */
  reporter: Author | null;
  /** Null when the event stands. */
  retractedBy: { eventId: string; occurredAt: string; recordedAt: string; reporter: Author | null } | null;
};

/** A signal about the party whose proposals are not registered yet (REQ-636). Never a fact. */
export interface PendingSignal {
  kind: "signal";
  signalId: string;
  receivedAt: string;
  signalKind: string;
  recordId: string;
  /** The facts the signal proposes about this party that are not registered yet. */
  proposals: { fact: string; intentId: string; intentStatus: string | null }[];
}

export type HistoryEntry = HistoryFact | PendingSignal;

/** What the screen may ask of the history. Ordered by the date of record, newest first by default. */
export interface HistoryQuery {
  page?: number;
  limit?: number;
  sortOrder?: string;
  /** ISO dates over the date of record. */
  from?: string;
  to?: string;
  eventType?: string[];
  /** Ids of who recorded the fact. */
  reporter?: string[];
  status?: "all" | "standing" | "retracted";
}

export interface HistoryPage {
  entries: HistoryFact[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  /** What the filters can offer, from the whole history of the party. */
  facets: { eventTypes: string[]; reporters: Author[] };
}

export type HistoryResult = ({ available: true } & HistoryPage) | { available: false };

export interface PartyHeader {
  partyId: string;
  displayName: string;
  provisional: boolean;
}

export type Side = "usinaOwes" | "partyOwes" | "unclassified";

/** What the screen may ask of one side's list. Every filter is one the Ledger itself applies. */
export interface SideQuery {
  page?: number;
  limit?: number;
  /** `createdAt` (default) or `dueAt`, as the Ledger sorts. */
  sortBy?: string;
  sortOrder?: string;
  /** Narrows the side to some of its kinds; a kind of the other side is ignored. */
  objectType?: string[];
  /** ISO dates over when the position entered the book (the Ledger's `createdAt` axis). */
  from?: string;
  to?: string;
}

/** One page of one side. `total` is the Ledger's count of the matching positions, never a sum. */
export interface SidePage {
  lines: PageLine[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type SideResult = { available: true; side: Side } & SidePage | { available: false };

export type PartyPageResult =
  | {
      available: true;
      party: PartyHeader;
      /** Every identifier read for this party: its own, and what was linked to it (REQ-332). */
      identifiers: string[];
      operation: {
        usinaOwes: PageLine[];
        partyOwes: PageLine[];
        /** Open positions of a kind this page does not know the side of. Shown apart, never dropped. */
        unclassified: PageLine[];
        /** Paging of each side, as the Ledger counted it (REQ-632, refinement of 2026-11-12). */
        pages: Record<Side, Omit<SidePage, "lines">>;
        /** The kinds each side lists, for the screen's kind filter. */
        kinds: Record<Side, string[]>;
      };
      alerts: PageAlert[];
      /** True when an alert scan hit its limit: there may be alerts this page did not read. */
      alertsPartial: boolean;
      receivesAlsoThrough: { partyId: string; displayName: string }[];
      /** The first page of the history: facts only, newest record first. */
      history: HistoryFact[];
      historyPage: Omit<HistoryPage, "entries">;
      /** Signals not registered yet, shown apart from the facts, on top of the history. */
      pendingSignals: PendingSignal[];
      /** partyId → name, for everyone the page cites. An id the Directory does not know stays an id. */
      partyNames: Record<string, string>;
    }
  | { available: false; party: PartyHeader };

export interface PartyPageLedger {
  eventsOfParty(identifier: string): Promise<PartyEvent[]>;
  event(eventId: string): Promise<{ parties: { partyId: string; role: string }[]; objects: { objectId: string; objectType: string; relation: string }[] } | null>;
  positions(params?: PositionsQuery): Promise<PositionsPage>;
  lifecycle(objectId: string): Promise<PositionLifecycle | null>;
}

export interface GetPartyPageDeps {
  directory: PartyDirectoryPort;
  ledger: PartyPageLedger;
  signals: ExternalSignalRepository;
  intents: IntentRepository;
  clock: Clock;
  /**
   * Every positional kind the Ledger declares (its algebra). The kinds in neither side are listed
   * apart; without this list that third list is not read, which is said by its empty page.
   */
  positionalTypes?: readonly string[];
  /** Treasury's users, to name who recorded a fact. Without it, the Ledger's name or the id is shown. */
  users?: { findById(id: string): Promise<{ displayName: string } | null> };
}

const newestFirst = (a: { at: string; tie: string }, b: { at: string; tie: string }) =>
  b.at.localeCompare(a.at) || b.tie.localeCompare(a.tie);

/**
 * The party page (§8.4, REQ-630–REQ-636): Operação and Histórico, read at query time from the Ledger
 * and from the signals Treasury holds. Resultados waits for step 6 (REQ-620) and is not here.
 *
 * It adds nothing up (REQ-627): the two sides stay apart with no net figure (REJ-632), the "recebe
 * também por" block carries no amount (REQ-633), and an alert exposes without concluding (REJ-634).
 *
 * `null` means the Directory does not know the party. An unreachable Ledger is `available: false`,
 * never an empty page (REQ-602).
 */
export class GetPartyPageUseCase {
  constructor(private readonly deps: GetPartyPageDeps) {}

  async execute(partyId: string, query: Partial<Record<Side, SideQuery>> = {}): Promise<PartyPageResult | null> {
    const who = await this.identify(partyId);
    if (!who) return null;
    const { party, identifiers, mine } = who;

    let events: PartyEvent[];
    let sides: Record<Side, SidePage>;
    let scan: { alerts: PageAlert[]; partial: boolean };
    try {
      events = await this.eventsOf(identifiers);
      const [usinaOwes, partyOwes, unclassified] = await Promise.all(
        (["usinaOwes", "partyOwes", "unclassified"] as const).map((side) =>
          this.sidePage(side, identifiers, events, query[side] ?? {}),
        ),
      );
      sides = { usinaOwes, partyOwes, unclassified };
      scan = await this.alertScan(identifiers);
    } catch {
      // All or nothing: part of a page would read as the whole of it.
      return { available: false, party };
    }

    const { entries: history, ...historyPage } = await this.historyPage(events, mine, {});
    const pendingSignals = (await this.signalsAbout(mine)).sort((a, b) =>
      newestFirst({ at: a.receivedAt, tie: a.signalId }, { at: b.receivedAt, tie: b.signalId }),
    );

    const receivesAlsoThrough = await this.receivesAlsoThrough(events, mine);
    const alerts: PageAlert[] = [...(party.provisional ? [{ code: "provisional_identity" as const }] : []), ...scan.alerts];
    const partyNames = await this.namesFor(events.flatMap((e) => e.parties.map((p) => p.partyId)));
    const pageInfo = ({ lines: _lines, ...info }: SidePage) => info;

    return {
      available: true,
      party,
      identifiers,
      operation: {
        usinaOwes: sides.usinaOwes.lines,
        partyOwes: sides.partyOwes.lines,
        unclassified: sides.unclassified.lines,
        pages: { usinaOwes: pageInfo(sides.usinaOwes), partyOwes: pageInfo(sides.partyOwes), unclassified: pageInfo(sides.unclassified) },
        kinds: { usinaOwes: this.kindsOf("usinaOwes"), partyOwes: this.kindsOf("partyOwes"), unclassified: this.kindsOf("unclassified") },
      },
      alerts,
      alertsPartial: scan.partial,
      receivesAlsoThrough,
      history,
      historyPage,
      pendingSignals,
      partyNames,
    };
  }

  /**
   * One page of the history, for the screen's own paging and filters. Until the Ledger pages a
   * party's events (§17, P1), the whole history is read and the page is cut here.
   */
  async history(partyId: string, query: HistoryQuery = {}): Promise<HistoryResult | null> {
    const who = await this.identify(partyId);
    if (!who) return null;
    let events: PartyEvent[];
    try {
      events = await this.eventsOf(who.identifiers);
    } catch {
      return { available: false };
    }
    return { available: true, ...(await this.historyPage(events, who.mine, query)) };
  }

  /** One page of one side, for the screen's own paging and filters. `null`: the party is unknown. */
  async side(partyId: string, side: Side, query: SideQuery = {}): Promise<SideResult | null> {
    const who = await this.identify(partyId);
    if (!who) return null;
    try {
      const events = await this.eventsOf(who.identifiers);
      return { available: true, side, ...(await this.sidePage(side, who.identifiers, events, query)) };
    } catch {
      return { available: false };
    }
  }

  private async identify(partyId: string) {
    const { directory } = this.deps;
    const asked = await directory.get(partyId);
    if (!asked) return null;
    const canonicalId =
      asked.identityState === PartyIdentityState.MERGED && asked.mergedInto ? asked.mergedInto : asked.partyId;
    const canonical = canonicalId === asked.partyId ? asked : ((await directory.get(canonicalId)) ?? asked);
    const party: PartyHeader = {
      partyId: canonicalId,
      displayName: canonical.displayName,
      provisional: canonical.identityState === PartyIdentityState.PROVISIONAL,
    };
    const identifiers = await directory.identifiersOf(canonicalId);
    return { party, identifiers, mine: new Set(identifiers) };
  }

  private async eventsOf(identifiers: string[]): Promise<PartyEvent[]> {
    const lists = await Promise.all(identifiers.map((id) => this.deps.ledger.eventsOfParty(id)));
    return [...new Map(lists.flat().map((e) => [e.eventId, e])).values()];
  }

  // ── Operação (REQ-632) ─────────────────────────────────────────────────────────────────────────

  /** The kinds a side lists. The third side is whatever positional kind belongs to neither. */
  private kindsOf(side: Side): string[] {
    if (side === "usinaOwes") return [...USINA_OWES];
    if (side === "partyOwes") return [...PARTY_OWES];
    return (this.deps.positionalTypes ?? []).filter((t) => !USINA_OWES.has(t) && !PARTY_OWES.has(t) && !CONTEXTUAL.has(t));
  }

  /**
   * One page of one side, paged, counted and sorted by the Ledger: Treasury never slices a page it
   * did not ask for. The "depende de" block is read only for the lines on the page.
   */
  private async sidePage(side: Side, identifiers: string[], events: PartyEvent[], query: SideQuery): Promise<SidePage> {
    const kinds = this.kindsOf(side);
    const asked = query.objectType?.length ? kinds.filter((k) => query.objectType!.includes(k)) : kinds;
    const limit = Math.min(Math.max(Math.trunc(query.limit ?? DEFAULT_SIDE_LIMIT) || DEFAULT_SIDE_LIMIT, 1), MAX_SIDE_LIMIT);
    const page = Math.max(Math.trunc(query.page ?? 1) || 1, 1);
    if (asked.length === 0) return { lines: [], total: 0, page, limit, totalPages: 0 };

    const result = await this.deps.ledger.positions({
      partyId: identifiers,
      status: SIDE_STATUSES,
      objectType: asked,
      page,
      limit,
      sortBy: query.sortBy ?? "createdAt",
      sortOrder: query.sortOrder ?? "DESC",
      ...(query.from ? { from: query.from } : {}),
      ...(query.to ? { to: query.to } : {}),
    });

    const today = this.deps.clock.now();
    const standing = events.filter((e) => !e.retracted);
    const allowed = new Set(asked);
    const lines: PageLine[] = [];
    for (const p of result.data) {
      // Defensive: what the Ledger was asked for is what is listed, whatever came back.
      if (!allowed.has(p.objectType)) continue;
      // A balance the Ledger cannot state, or one already at zero, is not a line with an amount.
      if (p.originatedAt === null || p.openBalance === null || toCents(p.openBalance) === 0n) continue;
      const contexts = contextsOf(p.objectId, standing);
      lines.push({
        objectId: p.objectId,
        objectType: p.objectType,
        status: p.status,
        openBalance: p.openBalance,
        totalOriginated: p.totalOriginated,
        originatedAt: p.originatedAt,
        dueAt: p.dueAt ?? null,
        ageDays: ageInDays(p.originatedAt, today),
        contexts,
        dependsOn: await this.dependsOn(p.objectId, contexts),
      });
    }
    return { lines, total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages };
  }

  /** The expectations citing the same context (REQ-632): read from the context's own lifecycle. */
  private async dependsOn(objectId: string, contexts: string[]): Promise<DependsOn[]> {
    const { ledger } = this.deps;
    const found = new Map<string, DependsOn>();

    for (const context of contexts) {
      const life = await ledger.lifecycle(context);
      for (const entry of life?.events ?? []) {
        if (entry.retracted) continue;
        const event = await ledger.event(entry.eventId);
        for (const o of event?.objects ?? []) {
          if (o.relation !== "originates" || !EXPECTATIONS.has(o.objectType) || o.objectId === objectId) continue;
          if (found.has(o.objectId)) continue;
          const expected = await ledger.lifecycle(o.objectId);
          if (!expected) continue;
          const payerId = event?.parties.find((p) => p.role === "payer")?.partyId ?? null;
          found.set(o.objectId, {
            objectId: o.objectId,
            objectType: o.objectType,
            payerId,
            payerName: null,
            openBalance: expected.openBalance,
            totalSettled: expected.totalSettled,
            context,
          });
        }
      }
    }

    const names = await this.namesFor([...found.values()].map((d) => d.payerId ?? ""));
    return [...found.values()].map((d) => ({ ...d, payerName: d.payerId ? (names[d.payerId] ?? null) : null }));
  }

  // ── Alertas (REQ-634) ──────────────────────────────────────────────────────────────────────────

  /**
   * The alerts read their own positions, apart from the sides' pages: an alert must not depend on
   * which page of a list is showing. Each scan reads up to ALERT_SCAN_LIMIT and says when it hit it.
   */
  private async alertScan(identifiers: string[]): Promise<{ alerts: PageAlert[]; partial: boolean }> {
    const { ledger, clock } = this.deps;
    const alerts: PageAlert[] = [];

    // Paid without obligation: a commission payout settled a position nothing originated. Any status:
    // such a position reads as settled, because nothing was ever owed on it.
    const payouts = await ledger.positions({
      partyId: identifiers,
      objectType: [...ALERT_PAID_WITHOUT_OBLIGATION],
      limit: ALERT_SCAN_LIMIT,
    });
    for (const p of payouts.data) {
      if (ALERT_PAID_WITHOUT_OBLIGATION.has(p.objectType) && p.originatedAt === null) {
        alerts.push({ code: "paid_without_obligation", objectId: p.objectId });
      }
    }

    // Overdue: only a due date the fact stated counts; no date is never "late" (REQ-227, §4.1).
    const today = clock.now().slice(0, 10);
    const owed = await ledger.positions({
      partyId: identifiers,
      status: SIDE_STATUSES,
      objectType: [...USINA_OWES],
      sortBy: "dueAt",
      sortOrder: "ASC",
      limit: ALERT_SCAN_LIMIT,
    });
    for (const p of owed.data) {
      if (!USINA_OWES.has(p.objectType) || !p.dueAt || p.openBalance === null || toCents(p.openBalance) <= 0n) continue;
      if (p.dueAt.slice(0, 10) < today) alerts.push({ code: "obligation_overdue", objectId: p.objectId, dueAt: p.dueAt });
    }

    return { alerts, partial: payouts.total > payouts.data.length || owed.total > owed.data.length };
  }

  // ── Recebe também por (REQ-633) ────────────────────────────────────────────────────────────────

  /** The receivers of standing facts in which this party was the final recipient. Names only. */
  private async receivesAlsoThrough(events: PartyEvent[], mine: Set<string>) {
    const through = new Set<string>();
    for (const e of events) {
      if (e.retracted) continue;
      if (!e.parties.some((p) => p.role === "beneficiary" && mine.has(p.partyId))) continue;
      for (const p of e.parties) if (p.role === "payee" && !mine.has(p.partyId)) through.add(p.partyId);
    }
    const names = await this.namesFor([...through]);
    return [...through].map((partyId) => ({ partyId, displayName: names[partyId] ?? partyId }));
  }

  // ── Histórico (REQ-636) ────────────────────────────────────────────────────────────────────────

  private async historyPage(events: PartyEvent[], mine: Set<string>, query: HistoryQuery): Promise<HistoryPage> {
    const all = await this.facts(events, mine);
    const limit = Math.min(Math.max(Math.trunc(query.limit ?? DEFAULT_SIDE_LIMIT) || DEFAULT_SIDE_LIMIT, 1), MAX_SIDE_LIMIT);
    const page = Math.max(Math.trunc(query.page ?? 1) || 1, 1);
    const day = (iso: string) => iso.slice(0, 10);
    const types = query.eventType?.length ? new Set(query.eventType) : null;
    const reporters = query.reporter?.length ? new Set(query.reporter) : null;

    const matching = all
      .filter((f) => !query.from || day(f.recordedAt) >= day(query.from))
      .filter((f) => !query.to || day(f.recordedAt) <= day(query.to))
      .filter((f) => !types || types.has(f.eventType))
      .filter((f) => !reporters || (f.reporter !== null && reporters.has(f.reporter.id)))
      .filter((f) => (query.status === "standing" ? !f.retracted : query.status === "retracted" ? f.retracted : true))
      .sort((a, b) => {
        const newest = b.recordedAt.localeCompare(a.recordedAt) || b.eventId.localeCompare(a.eventId);
        return query.sortOrder === "ASC" ? -newest : newest;
      });

    const facetReporters = new Map<string, Author>();
    for (const f of all) if (f.reporter && !facetReporters.has(f.reporter.id)) facetReporters.set(f.reporter.id, f.reporter);

    return {
      entries: matching.slice((page - 1) * limit, page * limit),
      total: matching.length,
      page,
      limit,
      totalPages: Math.ceil(matching.length / limit),
      facets: {
        eventTypes: [...new Set(all.map((f) => f.eventType))].sort(),
        reporters: [...facetReporters.values()].sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id)),
      },
    };
  }

  private async facts(events: PartyEvent[], mine: Set<string>): Promise<HistoryFact[]> {
    const names = new Map<string, string | null>();
    const author = async (r: { type: string; id: string; name: string | null } | null | undefined): Promise<Author | null> => {
      if (!r) return null;
      if (!names.has(r.id)) names.set(r.id, r.name ?? (await this.deps.users?.findById(r.id))?.displayName ?? null);
      return { type: r.type, id: r.id, name: names.get(r.id) ?? null };
    };

    const facts: HistoryFact[] = [];
    for (const e of events) {
      const { reporter, retractedBy: published, ...rest } = e;
      // The Ledger names the retraction (C1). Against one that does not, the party's own events are the
      // only place to look, and a retraction naming only the usina is not among them.
      const local =
        published === undefined && e.retracted
          ? events.find((r) => r.relatedEventId === e.eventId && r.objects.some((o) => o.relation === "retracts"))
          : undefined;
      const retractedBy = published
        ? { eventId: published.eventId, occurredAt: published.occurredAt, recordedAt: published.recordedAt, reporter: await author(published.reporter) }
        : local
          ? { eventId: local.eventId, occurredAt: local.occurredAt, recordedAt: local.recordedAt, reporter: await author(local.reporter) }
          : null;
      facts.push({
        ...rest,
        kind: "fact",
        roles: e.parties
          .filter((p) => mine.has(p.partyId))
          .map((p) => ({ role: p.role, direction: p.direction, recordedAs: p.partyId })),
        reporter: await author(reporter),
        retractedBy,
      });
    }
    return facts;
  }

  /**
   * The signals about this party whose proposals are not registered yet. Once a proposal becomes a
   * fact only the fact shows (decided 2026-11-12): the same thing is never told twice. A signal whose
   * party the source left undefined names no one and shows on no party page.
   */
  private async signalsAbout(mine: Set<string>): Promise<PendingSignal[]> {
    const entries: PendingSignal[] = [];
    for (const signal of await this.deps.signals.list()) {
      const props = signal.toJSON();
      const proposals: { fact: string; intentId: string; intentStatus: string | null }[] = [];
      for (const p of props.proposals) {
        const intent = await this.deps.intents.findById(p.intentId);
        if (intent?.status === IntentStatus.ACCEPTED) continue;
        const named = new Set<string>();
        if (p.party && "partyId" in p.party) named.add(p.party.partyId);
        for (const slot of PARTY_SLOTS) {
          const value = intent?.answers[slot];
          if (typeof value === "string" && value.trim()) named.add(value.trim());
        }
        if ([...named].some((id) => mine.has(id))) {
          proposals.push({ fact: p.fact, intentId: p.intentId, intentStatus: intent?.status ?? null });
        }
      }
      if (proposals.length > 0) {
        entries.push({
          kind: "signal",
          signalId: props.id,
          receivedAt: props.receivedAt,
          signalKind: props.kind,
          recordId: props.recordId,
          proposals,
        });
      }
    }
    return entries;
  }

  private async namesFor(ids: string[]): Promise<Record<string, string>> {
    const unique = [...new Set(ids.filter((id) => id))];
    const parties = await Promise.all(unique.map(async (id) => [id, await this.deps.directory.get(id)] as const));
    return Object.fromEntries(parties.flatMap(([id, p]) => (p ? [[id, p.displayName]] : [])));
  }
}

/** The contexts the standing facts name beside this position (DEC-036: same context = linked). */
function contextsOf(objectId: string, standing: PartyEvent[]): string[] {
  const contexts = new Set<string>();
  for (const e of standing) {
    if (!e.objects.some((o) => o.objectId === objectId)) continue;
    for (const o of e.objects) if (CONTEXTUAL.has(o.objectType)) contexts.add(o.objectId);
  }
  return [...contexts];
}

function ageInDays(originatedAt: string, today: string): number | null {
  const from = Date.parse(originatedAt);
  const to = Date.parse(today);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.floor((to - from) / DAY_MS);
}
