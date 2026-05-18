import { LedgerEventRepository } from "../../../core/application/repositories/LedgerEventRepository";
import { LedgerEvent } from "../../../core/domain/entities/LedgerEvent";
import { Direction } from "../../../core/domain/enums/Direction";
import { EconomicEffect } from "../../../core/domain/enums/EconomicEffect";
import { EventType } from "../../../core/domain/enums/EventType";
import { ObjectType } from "../../../core/domain/enums/ObjectType";
import { Relation } from "../../../core/domain/enums/Relation";
import { EventHash } from "../../../core/domain/value-objects/EventHash";
import { Page, PageOptions, paginate } from "../../../core/application/dtos/Pagination";
import { PositionAggregate, PositionAggregateOptions } from "../../../core/application/dtos/PositionAggregate";
import { EconomicOutcome, PositionStatus } from "../../../core/application/dtos/PositionSummary";
import { CashMovementsPaginatedOptions } from "../../../core/application/dtos/CashStatement";
import { derivePositionStatus, openBalanceUnitsOf } from "../../../core/application/dtos/positionUtils";

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
    let results = [...this.buildAggregateMap().values()];

    if (options.objectType) {
      results = results.filter((a) => a.objectType === options.objectType);
    }
    if (options.status) {
      const target = options.status;
      results = results.filter((a) => derivePositionStatus(a) === target);
    }
    if (options.outcome) {
      const target = options.outcome;
      results = results.filter((a) => deriveOutcomeFromAggregate(derivePositionStatus(a), a) === target);
    }

    const page  = Math.max(1, options.page  ?? 1);
    const limit = Math.min(Math.max(1, options.limit ?? 50), 200);
    const total = results.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const data = results.slice((page - 1) * limit, page * limit);

    return { data, total, page, limit, totalPages };
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

    for (const event of this.store) {
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
    return this.store
      .filter(
        (e) =>
          e.economicEffect === EconomicEffect.CASH_IN ||
          e.economicEffect === EconomicEffect.CASH_OUT,
      )
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .slice(0, limit);
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private buildAggregateMap(): Map<string, PositionAggregate> {
    const aggMap = new Map<string, PositionAggregate>();
    const eventIdsByObject = new Map<string, Set<string>>();

    for (const event of this.store) {
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
            eventCount: 0,
            lastEventAt: new Date(0),
            originatedAt: null,
          });
          eventIdsByObject.set(oid, new Set());
        }

        const agg = aggMap.get(oid)!;
        eventIdsByObject.get(oid)!.add(event.id.value);

        switch (obj.relation) {
          case Relation.ORIGINATES:
            agg.totalOriginatedUnits += units;
            if (agg.originatedAt === null || occurredAt < agg.originatedAt) {
              agg.originatedAt = occurredAt;
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
      if (openBalance === 0n) continue;
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

    for (const event of this.store) {
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

    for (const event of this.store) {
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
    for (const ev of this.store) {
      if (ev.occurredAt < from || ev.occurredAt > to) continue;
      if (ev.amount.currency !== currency) continue;
      if (!ev.getObjects().some((o) => o.relation === Relation.SETTLES)) continue;
      totalSettledUnits += ev.amount.toUnits();
      if (ev.economicEffect === EconomicEffect.CASH_IN) cashInSettledUnits += ev.amount.toUnits();
    }
    return { cashInSettledUnits, totalSettledUnits };
  }

  async findCashMovementsPaginated(options: CashMovementsPaginatedOptions): Promise<{ items: LedgerEvent[]; hasMore: boolean; nextCursor: { occurredAt: Date; id: string } | null }> {
    let filtered = this.store.filter((event) => {
      if (event.economicEffect === EconomicEffect.CASH_IN) {
        const match = event.getParties().some(
          (p) => p.partyId.value === options.partyId && p.direction === Direction.IN,
        );
        if (!match) return false;
      } else if (event.economicEffect === EconomicEffect.CASH_OUT) {
        const match = event.getParties().some(
          (p) => p.partyId.value === options.partyId && p.direction === Direction.OUT,
        );
        if (!match) return false;
      } else {
        return false;
      }

      if (options.from && event.occurredAt < options.from) return false;
      if (options.to && event.occurredAt > options.to) return false;

      return true;
    });

    filtered.sort((a, b) => {
      const timeDiff = a.occurredAt.getTime() - b.occurredAt.getTime();
      if (timeDiff !== 0) return timeDiff;
      return a.id.value < b.id.value ? -1 : a.id.value > b.id.value ? 1 : 0;
    });

    if (options.cursor) {
      const { occurredAt: cursorAt, id: cursorId } = options.cursor;
      filtered = filtered.filter((event) => {
        const tEvent = event.occurredAt.getTime();
        const tCursor = cursorAt.getTime();
        if (tEvent > tCursor) return true;
        if (tEvent === tCursor && event.id.value > cursorId) return true;
        return false;
      });
    }

    const taken = filtered.slice(0, options.limit + 1);
    const hasMore = taken.length > options.limit;
    const items = hasMore ? taken.slice(0, options.limit) : taken;
    const last = items.length > 0 ? items[items.length - 1] : null;
    const nextCursor = hasMore && last ? { occurredAt: last.occurredAt, id: last.id.value } : null;

    return { items, hasMore, nextCursor };
  }
}
