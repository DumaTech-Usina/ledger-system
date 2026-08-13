import { CashMovementsQueryResult, LedgerEventRepository } from "../../../core/application/repositories/LedgerEventRepository";
import { LedgerEvent } from "../../../core/domain/entities/LedgerEvent";
import { Direction } from "../../../core/domain/enums/Direction";
import { EconomicEffect } from "../../../core/domain/enums/EconomicEffect";
import { EventType } from "../../../core/domain/enums/EventType";
import { ObjectType } from "../../../core/domain/enums/ObjectType";
import { ReasonType } from "../../../core/domain/enums/ReasonType";
import { Relation } from "../../../core/domain/enums/Relation";
import { EventHash } from "../../../core/domain/value-objects/EventHash";
import { Page, PageOptions, paginate } from "../../../core/application/dtos/Pagination";
import { asList, PositionAggregate, PositionAggregateOptions } from "../../../core/application/dtos/PositionAggregate";
import { EconomicOutcome, PositionStatus } from "../../../core/application/dtos/PositionSummary";
import { CashMovementSortKey, CashMovementsPaginatedOptions } from "../../../core/application/dtos/CashStatement";
import { derivePositionStatus, openBalanceUnitsOf } from "../../../core/application/dtos/positionUtils";
import { retractedEventIds } from "../../../core/application/dtos/retractionUtils";

function deriveOutcomeFromAggregate(status: PositionStatus, agg: PositionAggregate): EconomicOutcome {
  if (status === "reversed") return "cancelled";
  if (status === "open" || status === "partially_settled") return "pending";
  if (agg.nonCashClosedUnits === 0n) return "gain";
  if (agg.cashRecoveredUnits === 0n) return "full_loss";
  return "partial_loss";
}

export class InMemoryLedgerEventRepository implements LedgerEventRepository {
  private readonly store: LedgerEvent[] = [];

  async save(event: LedgerEvent): Promise<void> {
    if (this.store.some((e) => e.id.value === event.id.value)) {
      throw new Error(`Immutability violation: event ${event.id.value} already exists in the ledger`);
    }
    this.store.push(event);
  }

  async getById(id: string): Promise<LedgerEvent | null> {
    return this.store.find((e) => e.id.value === id) ?? null;
  }

  async getByHash(hash: string): Promise<LedgerEvent | null> {
    return this.store.find((e) => e.hash.value === hash) ?? null;
  }

  async getByCommandId(commandId: string): Promise<LedgerEvent | null> {
    return this.store.find((e) => e.commandId === commandId) ?? null;
  }

  async getLastEventHash(): Promise<EventHash | null> {
    if (this.store.length === 0) return null;
    return this.store[this.store.length - 1].hash;
  }

  async existsBySourceReference(sourceReference: string): Promise<boolean> {
    return this.store.some((e) => e.source.reference === sourceReference);
  }

  async findByObjectId(objectId: string): Promise<LedgerEvent[]> {
    return this.store.filter((e) =>
      e.getObjects().some((o) => o.objectId.value === objectId),
    );
  }

  async findByRelatedEventId(relatedEventId: string): Promise<LedgerEvent[]> {
    return this.store.filter((e) => e.relatedEventId === relatedEventId);
  }

  /**
   * SQL twin: one sweep for the whole set, and the same reading — a settling relation on the id,
   * declared by an event that still STANDS. A retracted settlement closes nothing: the
   * rectification said it never happened, so the position is open again.
   */
  async findSettledObjectIds(objectIds: readonly string[]): Promise<Set<string>> {
    const wanted = new Set(objectIds);
    const settled = new Set<string>();
    if (wanted.size === 0) return settled;
    const retracted = retractedEventIds(this.store);
    for (const event of this.store) {
      if (retracted.has(event.id.value)) continue;
      for (const object of event.getObjects()) {
        if (object.relation === Relation.SETTLES && wanted.has(object.objectId.value)) {
          settled.add(object.objectId.value);
        }
      }
    }
    return settled;
  }

  async findByPartyId(partyId: string): Promise<LedgerEvent[]> {
    return this.store.filter((e) =>
      e.getParties().some((p) => p.partyId.value === partyId),
    );
  }

  async findAll(): Promise<LedgerEvent[]> {
    return [...this.store];
  }

  async findByPeriod(from: Date, to: Date): Promise<LedgerEvent[]> {
    return this.store.filter(
      (e) => e.occurredAt >= from && e.occurredAt <= to,
    );
  }

  async findAllObjectIds(): Promise<string[]> {
    const ids = new Set<string>();
    for (const event of this.store) {
      for (const obj of event.getObjects()) {
        ids.add(obj.objectId.value);
      }
    }
    return [...ids];
  }

  async findPositionAggregates(options: PositionAggregateOptions): Promise<Page<PositionAggregate>> {
    // Matches the SQL adapter's ORDER BY, including NULLS LAST on dueAt. Until this sort existed the
    // page came back in aggregate-map insertion order, so the two read paths answered the same
    // question with different orders — and paging over an unordered set is not paging.
    const ascending = options.sortOrder === "ASC";
    let results = [...this.buildAggregateMap().values()].sort((a, b) => {
      let primary: number;
      if (options.sortBy === "dueAt") {
        // A position with no stated due date sorts last in both directions — it is not the most
        // urgent thing in the book, and an unknown at the top of a list about time reads as an answer.
        if (a.dueAt === null || b.dueAt === null) {
          primary = a.dueAt === b.dueAt ? 0 : a.dueAt === null ? 1 : -1;
          return primary !== 0 ? primary : b.objectId.localeCompare(a.objectId);
        }
        primary = ascending ? a.dueAt.getTime() - b.dueAt.getTime() : b.dueAt.getTime() - a.dueAt.getTime();
      } else {
        primary = ascending
          ? a.createdAt.getTime() - b.createdAt.getTime()
          : b.createdAt.getTime() - a.createdAt.getTime();
      }
      return primary !== 0 ? primary : b.objectId.localeCompare(a.objectId);
    });

    // SQL twin: `object_type = ANY(...)` and an OR of the status predicates. Several values are read
    // as OR, and an empty selection is no filter — the same rule the SQL path applies, normalized by
    // the same helper so the two cannot drift.
    const objectTypes = asList(options.objectType);
    if (objectTypes.length > 0) {
      results = results.filter((a) => objectTypes.includes(a.objectType));
    }
    const statuses = asList(options.status);
    if (statuses.length > 0) {
      results = results.filter((a) => statuses.includes(derivePositionStatus(a)));
    }
    // SQL twin: `created_at BETWEEN`. The axis is when the position entered the book, which is
    // defined for every position — see PositionAggregateOptions for why not originatedAt or dueAt.
    if (options.from) {
      const from = options.from;
      results = results.filter((a) => a.createdAt >= from);
    }
    if (options.to) {
      const to = options.to;
      results = results.filter((a) => a.createdAt <= to);
    }
    // SQL twin: a semi-join on object identity. Involvement is any standing event naming the party,
    // in any role or direction — so this needs no second, exact pass the way the others do.
    const partyIds = asList(options.partyId);
    if (partyIds.length > 0) {
      results = results.filter((a) =>
        partyIds.some((partyId) => this.partiesOfObject(a.objectId).has(partyId)),
      );
    }
    if (options.outcome) {
      const target = options.outcome;
      results = results.filter((a) => deriveOutcomeFromAggregate(derivePositionStatus(a), a) === target);
    }

    const page  = Math.max(1, options.page  ?? 1);
    const limit = Math.min(Math.max(1, options.limit ?? 50), 200);
    const total = results.length;
    const totalPages = Math.ceil(total / limit) || 1;
    // Attached for the page only, exactly as the SQL path does it.
    const data = results
      .slice((page - 1) * limit, page * limit)
      .map((aggregate) => ({ ...aggregate, parties: [...this.partiesOfObject(aggregate.objectId)] }));

    return { data, total, page, limit, totalPages };
  }

  /**
   * Every party named by a standing event of this object. SQL twin of `partiesOfObjects`, including
   * the exclusion of retracted events: a party that appears only on a retracted event took part in
   * nothing that still stands.
   */
  private partiesOfObject(objectId: string): Set<string> {
    const retracted = retractedEventIds(this.store);
    const parties = new Set<string>();
    for (const event of this.store) {
      if (retracted.has(event.id.value)) continue;
      if (!event.getObjects().some((o) => o.objectId.value === objectId)) continue;
      for (const party of event.getParties()) parties.add(party.partyId.value);
    }
    return parties;
  }

  async findAllPositionAggregates(): Promise<PositionAggregate[]> {
    return [...this.buildAggregateMap().values()].sort(
      (a, b) => b.lastEventAt.getTime() - a.lastEventAt.getTime(),
    );
  }

  async aggregatePeriodCashFlow(
    from: Date,
    to: Date,
  ): Promise<Array<{ eventType: EventType; economicEffect: EconomicEffect; totalUnits: bigint; currency: string }>> {
    const byKey = new Map<string, { totalUnits: bigint; currency: string }>();

    const retractedForPeriod = retractedEventIds(this.store);
    for (const event of this.store) {
      if (retractedForPeriod.has(event.id.value)) continue;
      if (event.occurredAt < from || event.occurredAt > to) continue;
      if (
        event.economicEffect !== EconomicEffect.CASH_IN &&
        event.economicEffect !== EconomicEffect.CASH_OUT
      ) continue;

      const key = `${event.eventType}|${event.economicEffect}`;
      const cur = byKey.get(key);
      if (cur) {
        cur.totalUnits += event.amount.toUnits();
      } else {
        byKey.set(key, { totalUnits: event.amount.toUnits(), currency: event.amount.currency });
      }
    }

    return [...byKey.entries()].map(([key, val]) => {
      const [eventType, economicEffect] = key.split("|");
      return {
        eventType:      eventType      as EventType,
        economicEffect: economicEffect as EconomicEffect,
        totalUnits:     val.totalUnits,
        currency:       val.currency,
      };
    });
  }

  async findRecentCashMovements(limit: number): Promise<LedgerEvent[]> {
    const retracted = retractedEventIds(this.store);
    return this.store
      .filter(
        (e) =>
          !retracted.has(e.id.value) &&
          (e.economicEffect === EconomicEffect.CASH_IN ||
            e.economicEffect === EconomicEffect.CASH_OUT),
      )
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .slice(0, limit);
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private buildAggregateMap(): Map<string, PositionAggregate> {
    const aggMap = new Map<string, PositionAggregate>();
    const eventIdsByObject = new Map<string, Set<string>>();
    // Same rule the projection applies, over the whole store: a retracted event contributes nothing.
    const retracted = retractedEventIds(this.store);

    for (const event of this.store) {
      if (retracted.has(event.id.value)) continue;
      const currency = event.amount.currency;
      const units = event.amount.toUnits();
      const occurredAt = event.occurredAt;

      for (const obj of event.getObjects()) {
        const oid = obj.objectId.value;

        if (!aggMap.has(oid)) {
          aggMap.set(oid, {
            objectId: oid,
            objectType: obj.objectType,
            currency,
            totalOriginatedUnits: 0n,
            totalSettledUnits:    0n,
            totalAdjustedUnits:   0n,
            cashRecoveredUnits:   0n,
            nonCashClosedUnits:   0n,
            refCashInUnits:       0n,
            refCashOutUnits:      0n,
            hasReversal: false,
            hasUnresolvedLineage: false,
            eventCount: 0,
            lastEventAt: new Date(0),
            originatedAt: null,
            createdAt: event.recordedAt,
            dueAt: null,
          });
          eventIdsByObject.set(oid, new Set());
        }

        const agg = aggMap.get(oid)!;
        eventIdsByObject.get(oid)!.add(event.id.value);

        // Mirrors MAX(o.object_type) in the SQL aggregate. An objectId named with more than one
        // objectType is legitimate — continuity is asserted, never validated — but the two read
        // paths must resolve it identically, and store order is not a rule.
        if (obj.objectType > agg.objectType) agg.objectType = obj.objectType;

        // Mirrors the SQL aggregate: carry the orphan's declared unresolved lineage into the
        // aggregate so both read paths can tell "unknown origination" from "no origination".
        const reason = event.getReason();
        if (reason?.type === ReasonType.UNKNOWN_ORIGIN && reason.requiresFollowup) {
          agg.hasUnresolvedLineage = true;
        }

        switch (obj.relation) {
          case Relation.ORIGINATES:
            agg.totalOriginatedUnits += units;
            if (agg.originatedAt === null || occurredAt < agg.originatedAt) {
              agg.originatedAt = occurredAt;
            }
            // Mirrors MIN(due_at) FILTER (relation = 'originates') in the SQL aggregate. Read only
            // here: a settlement carries no due date, and the invariant refuses one on it.
            if (event.dueAt !== null && (agg.dueAt === null || event.dueAt < agg.dueAt)) {
              agg.dueAt = event.dueAt;
            }
            break;
          case Relation.SETTLES:
            agg.totalSettledUnits += units;
            if (event.economicEffect === EconomicEffect.CASH_IN)  agg.cashRecoveredUnits += units;
            if (event.economicEffect === EconomicEffect.NON_CASH) agg.nonCashClosedUnits += units;
            break;
          case Relation.ADJUSTS:
            agg.totalAdjustedUnits += units;
            break;
          case Relation.REVERSES:
            agg.hasReversal = true;
            break;
          case Relation.REFERENCES:
            if (event.economicEffect === EconomicEffect.CASH_IN)  agg.refCashInUnits  += units;
            if (event.economicEffect === EconomicEffect.CASH_OUT) agg.refCashOutUnits += units;
            break;
        }

        if (occurredAt > agg.lastEventAt) agg.lastEventAt = occurredAt;
        // Mirrors MIN(e.recorded_at) in the SQL aggregate: store order is not a rule, so the
        // earliest recording wins regardless of the order events were appended in.
        if (event.recordedAt < agg.createdAt) agg.createdAt = event.recordedAt;
      }
    }

    for (const [oid, eventIds] of eventIdsByObject) {
      aggMap.get(oid)!.eventCount = eventIds.size;
    }

    return aggMap;
  }

  async aggregateOpenBalancesByObjectType(): Promise<Array<{ objectType: ObjectType; openBalanceUnits: bigint; currency: string }>> {
    const byType = new Map<ObjectType, { openBalance: bigint; currency: string }>();
    for (const agg of this.buildAggregateMap().values()) {
      if (agg.hasReversal || agg.totalOriginatedUnits === 0n) continue;
      const openBalance = openBalanceUnitsOf(agg);
      // Null (unknown origination) is already excluded by the totalOriginated check above; the guard
      // keeps an unknown amount from ever being folded into a total.
      if (openBalance === null || openBalance === 0n) continue;
      const existing = byType.get(agg.objectType);
      if (existing) existing.openBalance += openBalance;
      else byType.set(agg.objectType, { openBalance, currency: agg.currency });
    }
    return [...byType.entries()].map(([objectType, { openBalance, currency }]) => ({
      objectType, openBalanceUnits: openBalance, currency,
    }));
  }

  async aggregateCashFlows(): Promise<{ cashInUnits: bigint; cashOutUnits: bigint; currency: string }> {
    let cashInUnits = 0n;
    let cashOutUnits = 0n;
    let currency = "BRL";
    let found = false;
    const retracted = retractedEventIds(this.store);

    for (const event of this.store) {
      if (retracted.has(event.id.value)) continue;
      if (event.economicEffect === EconomicEffect.CASH_IN) {
        if (!found) { currency = event.amount.currency; found = true; }
        cashInUnits += event.amount.toUnits();
      } else if (event.economicEffect === EconomicEffect.CASH_OUT) {
        if (!found) { currency = event.amount.currency; found = true; }
        cashOutUnits += event.amount.toUnits();
      }
    }

    return { cashInUnits, cashOutUnits, currency };
  }

  async findPaginated(options: PageOptions): Promise<Page<LedgerEvent>> {
    let items = [...this.store];
    if (options.sortBy) {
      const key = options.sortBy;
      const order = options.sortOrder === 'DESC' ? -1 : 1;
      items.sort((a, b) => order * (a[key].getTime() - b[key].getTime()));
    }
    return paginate(items, options);
  }

  async aggregateCashFlowsBefore(date: Date): Promise<{ cashInUnits: bigint; cashOutUnits: bigint; currency: string }> {
    let cashInUnits = 0n;
    let cashOutUnits = 0n;
    let currency = "BRL";
    let found = false;
    const retracted = retractedEventIds(this.store);

    for (const event of this.store) {
      if (retracted.has(event.id.value)) continue;
      if (event.occurredAt >= date) continue;
      if (event.economicEffect === EconomicEffect.CASH_IN) {
        if (!found) { currency = event.amount.currency; found = true; }
        cashInUnits += event.amount.toUnits();
      } else if (event.economicEffect === EconomicEffect.CASH_OUT) {
        if (!found) { currency = event.amount.currency; found = true; }
        cashOutUnits += event.amount.toUnits();
      }
    }

    return { cashInUnits, cashOutUnits, currency };
  }

  async aggregateClosureStats(
    from: Date,
    to: Date,
    currency: string,
  ): Promise<{ cashInSettledUnits: bigint; totalSettledUnits: bigint }> {
    let cashInSettledUnits = 0n;
    let totalSettledUnits  = 0n;
    const retracted = retractedEventIds(this.store);
    for (const ev of this.store) {
      if (retracted.has(ev.id.value)) continue;
      if (ev.occurredAt < from || ev.occurredAt > to) continue;
      if (ev.amount.currency !== currency) continue;
      if (!ev.getObjects().some((o) => o.relation === Relation.SETTLES)) continue;
      totalSettledUnits += ev.amount.toUnits();
      if (ev.economicEffect === EconomicEffect.CASH_IN) cashInSettledUnits += ev.amount.toUnits();
    }
    return { cashInSettledUnits, totalSettledUnits };
  }

  async findCashMovementsPaginated(options: CashMovementsPaginatedOptions): Promise<CashMovementsQueryResult> {
    const retractedMovements = retractedEventIds(this.store);
    let filtered = this.store.filter((event) => {
      // A movement that never happened does not belong on a cash statement. The event itself is
      // still readable through the object's lifecycle — history lives there, not here.
      if (retractedMovements.has(event.id.value)) return false;
      // SQL twin: the effect narrows the listing to one direction, and the party scopes it to a
      // statement. Both are optional, and both must be read the same way here as in the query
      // builder — a filter that means two things in two read paths is two filters.
      if (options.effect && event.economicEffect !== options.effect) return false;
      if (event.economicEffect === EconomicEffect.CASH_IN) {
        if (options.partyId) {
          const match = event.getParties().some(
            (p) => p.partyId.value === options.partyId && p.direction === Direction.IN,
          );
          if (!match) return false;
        }
      } else if (event.economicEffect === EconomicEffect.CASH_OUT) {
        if (options.partyId) {
          const match = event.getParties().some(
            (p) => p.partyId.value === options.partyId && p.direction === Direction.OUT,
          );
          if (!match) return false;
        }
      } else {
        return false;
      }

      if (options.from && event.occurredAt < options.from) return false;
      if (options.to && event.occurredAt > options.to) return false;

      return true;
    });

    // SQL twin: the chosen axis, the chosen direction, and the id breaking ties the SAME way.
    const sortKey = options.sortBy === "recordedAt" ? "recordedAt" : "occurredAt";
    const ascending = options.sortOrder === "ASC";
    const axisOf = (event: LedgerEvent) =>
      sortKey === "recordedAt" ? event.recordedAt.getTime() : event.occurredAt.getTime();

    filtered.sort((a, b) => {
      const timeDiff = ascending ? axisOf(a) - axisOf(b) : axisOf(b) - axisOf(a);
      if (timeDiff !== 0) return timeDiff;
      if (a.id.value === b.id.value) return 0;
      const idDiff = a.id.value < b.id.value ? -1 : 1;
      return ascending ? idDiff : -idDiff;
    });

    // ── Numbered page ───────────────────────────────────────────────────────────────────────────
    if (options.page !== undefined) {
      const page = Math.max(1, options.page);
      const total = filtered.length;
      const items = filtered.slice((page - 1) * options.limit, page * options.limit);
      return {
        items,
        hasMore: page * options.limit < total,
        nextCursor: null,
        total,
        page,
        totalPages: Math.ceil(total / options.limit) || 1,
      };
    }

    // ── Keyset ──────────────────────────────────────────────────────────────────────────────────
    if (options.cursor) {
      const cursorAt = options.cursor.value.getTime();
      const cursorId = options.cursor.id;
      filtered = filtered.filter((event) => {
        const at = axisOf(event);
        // Descending continues below the cursor, ascending above it.
        if (ascending) {
          if (at > cursorAt) return true;
          return at === cursorAt && event.id.value > cursorId;
        }
        if (at < cursorAt) return true;
        return at === cursorAt && event.id.value < cursorId;
      });
    }

    const taken = filtered.slice(0, options.limit + 1);
    const hasMore = taken.length > options.limit;
    const items = hasMore ? taken.slice(0, options.limit) : taken;
    const last = items.length > 0 ? items[items.length - 1] : null;
    const nextCursor = hasMore && last
      ? {
          key: sortKey as CashMovementSortKey,
          order: (ascending ? "ASC" : "DESC") as "ASC" | "DESC",
          value: sortKey === "recordedAt" ? last.recordedAt : last.occurredAt,
          id: last.id.value,
        }
      : null;

    // Null, not zero: walking a keyset never counted the set. Same statement the SQL path makes.
    return { items, hasMore, nextCursor, total: null, page: null, totalPages: null };
  }
}
