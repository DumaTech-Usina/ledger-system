import type { LedgerReadPort } from "../../core/application/ports/LedgerReadPort";
import type { PositionLifecyclePort } from "../../core/application/ports/PositionLifecyclePort";
import type { LedgerEventLookupPort } from "../../core/application/ports/LedgerEventLookupPort";
import type { LedgerEventFeedPort, RecordedEvent } from "../../core/application/ports/LedgerEventFeedPort";
import type { PositionCandidate, PositionLookupPort } from "../../core/application/ports/PositionLookupPort";
import type {
  BookExposure,
  CashPosition,
  CashMovementsPage,
  PositionsPage,
  PositionItem,
  PositionLifecycle,
  PositionOriginRef,
  LedgerEventRef,
} from "../../core/application/dtos/LedgerReadModels";

/** The Ledger's position-detail payload, as `serializePositionSummary` emits it. */
interface LedgerPositionDetail {
  objectId: string;
  objectType: string;
  status: string;
  outcome: string;
  currency: string;
  totalOriginated: string;
  totalSettled: string;
  openBalance: string | null;
  eventCount: number;
  events: Array<{
    id: string;
    eventType: string;
    economicEffect: string;
    amount: string;
    currency: string;
    occurredAt: string;
    recordedAt: string;
    description: string | null;
    relatedEventId: string | null;
    retracted?: boolean;
    reason?: { type: string; requiresFollowup?: boolean } | null;
    parties?: Array<{ partyId: string; role: string; direction: string; amount?: string | null }>;
    objects: Array<{ objectId: string; objectType?: string; relation: string }>;
    source?: { system: string; reference: string };
  }>;
}

/** The parties of one Ledger event, trimmed to what treasury displays. Ids only, never names. */
function mapParties(parties: LedgerDetailEvent["parties"]) {
  return (parties ?? []).map((p) => ({
    partyId: p.partyId,
    role: p.role,
    direction: p.direction,
    // Per-party amounts exist only where the fact split one; absent is "this leg carried no
    // amount", which the Ledger states by omitting it rather than by writing a zero.
    amount: p.amount ?? null,
  }));
}

type LedgerDetailEvent = LedgerPositionDetail["events"][number];

/**
 * The origination that still STANDS for an object, out of a position detail's published events.
 *
 * One rule, one place: the settlement offer and the position detail both need it, and two copies of
 * a selection rule are two chances to disagree about which origination a position has. Retracted
 * events are excluded here rather than downstream — a rectification that took an origination back
 * out must not keep answering for the position anywhere.
 */
function standingOrigination(
  events: readonly LedgerDetailEvent[] | undefined,
  objectId: string,
): LedgerDetailEvent | undefined {
  return (events ?? []).find(
    (e) =>
      e.retracted !== true &&
      e.objects?.some((o) => o.objectId === objectId && o.relation === "originates"),
  );
}

/**
 * Reads the Ledger's published read API over HTTP. Uses Node's global fetch (no dependency) with a
 * timeout so a slow/hung Ledger can't hang a treasury request.
 */
export class HttpLedgerReadAdapter
  implements LedgerReadPort, PositionLifecyclePort, LedgerEventLookupPort, PositionLookupPort, LedgerEventFeedPort
{
  constructor(
    private readonly baseUrl: string,
    private readonly serviceToken = "",
    private readonly timeoutMs = 4000,
    /** Needed only to tell the counterparty from ourselves on an originating event. */
    private readonly usinaPartyId = "",
  ) {}

  private async request<T>(path: string, nullOn404: boolean): Promise<T | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const headers: Record<string, string> = {};
      if (this.serviceToken) headers["authorization"] = `Bearer ${this.serviceToken}`;
      const res = await fetch(this.baseUrl + path, { headers, signal: controller.signal });
      if (nullOn404 && res.status === 404) return null;
      if (!res.ok) throw new Error(`Ledger read failed (${res.status}) for ${path}`);
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  private async get<T>(path: string): Promise<T> {
    return (await this.request<T>(path, false)) as T;
  }

  /** For resources the Ledger may legitimately not know: 404 comes back as `null`, never as a throw. */
  private getOrNull<T>(path: string): Promise<T | null> {
    return this.request<T>(path, true);
  }

  cashPosition(): Promise<CashPosition> {
    return this.get<CashPosition>("/api/cash-position");
  }

  cashMovements(params: { partyId: string; limit?: number }): Promise<CashMovementsPage> {
    const q = new URLSearchParams({ partyId: params.partyId, limit: String(params.limit ?? 50) });
    return this.get<CashMovementsPage>(`/api/cash-movements?${q.toString()}`);
  }

  async positions(params?: {
    limit?: number;
    page?: number;
    status?: string;
    objectType?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<PositionsPage> {
    const q = new URLSearchParams({ limit: String(params?.limit ?? 50) });
    if (params?.page) q.set("page", String(params.page));
    if (params?.status) q.set("status", params.status);
    if (params?.objectType) q.set("objectType", params.objectType);
    // The Ledger validates both against a closed set, so an unrecognised value falls back there
    // rather than travelling into its SQL.
    if (params?.sortBy) q.set("sortBy", params.sortBy);
    if (params?.sortOrder) q.set("sortOrder", params.sortOrder);
    const raw = await this.get<{
      data: PositionItem[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(`/api/positions?${q.toString()}`);
    // Keep only the fields treasury displays; the paging is the Ledger's own, passed through.
    return {
      total: raw.total,
      page: raw.page,
      limit: raw.limit,
      totalPages: raw.totalPages,
      data: (raw.data ?? []).map((p) => ({
        objectId: p.objectId,
        objectType: p.objectType,
        status: p.status,
        outcome: p.outcome,
        currency: p.currency,
        totalOriginated: p.totalOriginated,
        openBalance: p.openBalance,
        eventCount: p.eventCount,
        lastEventAt: p.lastEventAt,
        originatedAt: p.originatedAt ?? null,
        createdAt: p.createdAt ?? null,
        // Null against a Ledger that predates the due-date field, and null for any obligation whose
        // establishing fact stated no terms. Both are "not known", which is what the screen shows.
        dueAt: p.dueAt ?? null,
      })),
    };
  }

  /**
   * What the position math says about the whole book. No period is sent: the three figures read
   * here are current-state (`findAllPositionAggregates`), and `from`/`to` would only scope cash
   * figures treasury reads elsewhere.
   */
  async bookExposure(): Promise<BookExposure> {
    const raw = await this.get<{
      currency: string;
      openExposure: string;
      openPayableExposure?: string;
      overduePayable?: string;
      upcomingPayable?: string;
      undatedPayable?: string;
      capitalAtRisk: string;
      healthScore: BookExposure["healthScore"];
    }>("/api/dashboard");
    return {
      currency: raw.currency,
      openExposure: raw.openExposure,
      // Defaulted to "0.00" only for a Ledger that predates these figures — where a payable position
      // could not be originated at all, so zero is the true total rather than a stand-in for unknown.
      openPayableExposure: raw.openPayableExposure ?? "0.00",
      overduePayable: raw.overduePayable ?? "0.00",
      upcomingPayable: raw.upcomingPayable ?? "0.00",
      undatedPayable: raw.undatedPayable ?? "0.00",
      capitalAtRisk: raw.capitalAtRisk,
      healthScore: raw.healthScore,
    };
  }

  /**
   * Positions a settlement could still move, with the context a person needs to recognise one.
   *
   * Two filtered listings rather than one unfiltered sweep: the Ledger's status filter takes a
   * single value, and asking it for exactly what is wanted beats fetching everything and discarding
   * most of it. The counterparty then costs one detail read per candidate — it is published only
   * there — which is why the list is capped: an affordance must not turn into a scan.
   *
   * Everything here is read from the origination that still STANDS. The detail's `origin` field is
   * deliberately not used: it is extracted before the retraction fold, so it keeps naming an event a
   * rectification already declared never happened. Reading `events` instead — where the Ledger
   * publishes `retracted` per event — keeps this adapter answering with the same book every other
   * derivation answers with.
   */
  async openPositions(objectType: string, limit = 20): Promise<PositionCandidate[]> {
    const pages = await Promise.all(
      ["open", "partially_settled"].map((status) => this.positions({ objectType, status, limit })),
    );
    const items = pages.flatMap((p) => p.data).slice(0, limit);

    const details = await Promise.all(
      items.map((item) => this.getOrNull<LedgerPositionDetail>(`/api/positions/${encodeURIComponent(item.objectId)}`)),
    );

    return items.map((item, i) => {
      const originating = standingOrigination(details[i]?.events, item.objectId);
      return {
        objectId: item.objectId,
        objectType: item.objectType,
        originEventId: originating?.id ?? null,
        // The other side of the origination. Absent when no origination stands — unknown, which the
        // conversation shows as unknown rather than filling in.
        counterpartyId:
          originating?.parties?.find((p) => p.partyId !== this.usinaPartyId)?.partyId ?? null,
        totalOriginated: item.totalOriginated,
        openBalance: item.openBalance,
        currency: item.currency,
        // The aggregate already excludes retracted events, so null here means no origination stands.
        // It is never filled in from elsewhere: doing so would undo the rectification on screen.
        originatedAt: item.originatedAt,
      };
    });
  }

  /**
   * Positions already settled that nothing ever originated — a payment recorded on its own.
   *
   * The Ledger has no status for this shape: `open` covers both "originated, nothing claimed yet"
   * and "settled, nothing originated", which is the documented ambiguity in the status vocabulary.
   * The two are told apart by `totalOriginated`, the field the Ledger already publishes and the
   * same discriminator its own aggregates use. Filtering a published field is reading; no figure is
   * recomputed here.
   *
   * `unknown_origin` positions are deliberately not fetched: those declare that an origination
   * exists and is not known, which is a different state from none having been recorded.
   */
  async unoriginatedPositions(objectType: string, limit = 20): Promise<PositionCandidate[]> {
    const page = await this.positions({ objectType, status: "open", limit: limit * 2 });
    const items = page.data
      .filter((item) => Number(item.totalOriginated) === 0 && item.eventCount > 0)
      .slice(0, limit);

    return items.map((item) => ({
      objectId: item.objectId,
      objectType: item.objectType,
      // Nothing originated it, so there is no origination to name — and none is invented.
      originEventId: null,
      counterpartyId: null,
      totalOriginated: item.totalOriginated,
      openBalance: item.openBalance,
      currency: item.currency,
      originatedAt: null,
    }));
  }

  /**
   * The life of one economic object, from the Ledger's own position projection. The event order is
   * the Ledger's (recordedAt ascending) and is passed through untouched; each event is trimmed to
   * the fields treasury displays, plus the relation it declares for THIS object.
   *
   * Each event also carries the contextual references the Ledger publishes about it — every object
   * it names and where the fact came from — which is what makes "what document does this position
   * refer to" answerable without a second read. They are passed through, never interpreted.
   */
  async lifecycle(objectId: string): Promise<PositionLifecycle | null> {
    const raw = await this.getOrNull<LedgerPositionDetail>(`/api/positions/${encodeURIComponent(objectId)}`);
    if (!raw) return null;

    return {
      objectId: raw.objectId,
      objectType: raw.objectType,
      status: raw.status,
      outcome: raw.outcome,
      currency: raw.currency,
      totalOriginated: raw.totalOriginated,
      totalSettled: raw.totalSettled,
      openBalance: raw.openBalance,
      eventCount: raw.eventCount,
      events: (raw.events ?? []).map((e) => ({
        eventId: e.id,
        eventType: e.eventType,
        economicEffect: e.economicEffect,
        relation: e.objects?.find((o) => o.objectId === raw.objectId)?.relation ?? null,
        amount: e.amount,
        currency: e.currency,
        occurredAt: e.occurredAt,
        recordedAt: e.recordedAt,
        description: e.description,
        relatedEventId: e.relatedEventId ?? null,
        // Absent only against a Ledger that has no rectification at all — where nothing can be
        // retracted, so `false` states a fact rather than filling a gap with a default.
        retracted: e.retracted === true,
        requiresFollowup: e.reason?.requiresFollowup === true,
        objects: (e.objects ?? []).map((o) => ({
          objectId: o.objectId,
          // The Ledger publishes the type on every object of an event; "" only against one that
          // does not, and an empty type is shown as the absence it is — never guessed from the id.
          objectType: o.objectType ?? "",
          relation: o.relation,
        })),
        source: e.source ? { system: e.source.system, reference: e.source.reference } : null,
        parties: mapParties(e.parties),
      })),
      origin: this.originOf(raw, objectId),
    };
  }

  /**
   * What the position's standing origination refers to. Read from `events[]` — where the Ledger
   * publishes `retracted` per event — and NOT from the detail's own `origin` block, which is
   * extracted before the retraction fold and keeps naming an event a rectification already undid.
   *
   * Nothing is computed: the fields are the originating event's own, copied across. Null when no
   * origination stands, which the reader must be able to tell from one that stands with no context.
   */
  private originOf(raw: LedgerPositionDetail, objectId: string): PositionOriginRef | null {
    const originating = standingOrigination(raw.events, objectId);
    if (!originating) return null;

    return {
      eventId: originating.id,
      eventType: originating.eventType,
      occurredAt: originating.occurredAt,
      source: originating.source
        ? { system: originating.source.system, reference: originating.source.reference }
        : null,
      // The siblings only — the position itself is already the subject of the read.
      relatedObjects: (originating.objects ?? [])
        .filter((o) => o.objectId !== objectId)
        .map((o) => ({ objectId: o.objectId, objectType: o.objectType ?? "", relation: o.relation })),
      parties: mapParties(originating.parties),
    };
  }

  /**
   * What was written to the Ledger most recently — by RECORDING order, not by when it happened.
   *
   * `sortBy=recordedAt` is the whole point: a fact may be recorded long after it occurred, so an
   * occurrence-ordered read cannot answer "what is new since I last looked". The Ledger validates
   * both parameters against a whitelist, so an unrecognised value falls back rather than travelling.
   */
  async recentlyRecorded(limit: number, page = 1): Promise<RecordedEvent[]> {
    const q = new URLSearchParams({
      sortBy: "recordedAt",
      sortOrder: "DESC",
      limit: String(limit),
      page: String(page),
    });
    const raw = await this.get<{
      data: Array<{ id: string; objects?: Array<{ objectId: string }> }>;
    }>(`/api/events?${q.toString()}`);

    return (raw.data ?? []).map((event) => ({
      eventId: event.id,
      objectIds: [...new Set((event.objects ?? []).map((o) => o.objectId))],
    }));
  }

  /**
   * One event, as the Ledger stored it. Used to describe a rectification in the Ledger's own terms
   * — the amount and the object come from the record being corrected, never from a second typing.
   */
  async event(eventId: string): Promise<LedgerEventRef | null> {
    const raw = await this.getOrNull<{
      id: string;
      eventType: string;
      economicEffect: string;
      amount: string;
      currency: string;
      occurredAt: string;
      description: string | null;
      relatedEventId: string | null;
      objects: Array<{ objectId: string; objectType: string; relation: string }>;
      parties: Array<{ partyId: string; role: string; direction: string; amount: string | null }>;
      source: { system: string; reference: string };
    }>(`/api/events/${encodeURIComponent(eventId)}`);
    if (!raw) return null;

    return {
      eventId: raw.id,
      eventType: raw.eventType,
      economicEffect: raw.economicEffect,
      amount: raw.amount,
      currency: raw.currency,
      occurredAt: raw.occurredAt,
      description: raw.description ?? null,
      relatedEventId: raw.relatedEventId ?? null,
      objects: (raw.objects ?? []).map((o) => ({
        objectId: o.objectId,
        objectType: o.objectType,
        relation: o.relation,
      })),
      parties: (raw.parties ?? []).map((p) => ({
        partyId: p.partyId,
        role: p.role,
        direction: p.direction,
        amount: p.amount ?? null,
      })),
      source: { system: raw.source?.system ?? "", reference: raw.source?.reference ?? "" },
    };
  }
}
