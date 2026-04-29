import { LedgerEventRepository } from "../../../core/application/repositories/LedgerEventRepository";
import { LedgerEvent } from "../../../core/domain/entities/LedgerEvent";
import { EconomicEffect } from "../../../core/domain/enums/EconomicEffect";
import { Relation } from "../../../core/domain/enums/Relation";
import { EventHash } from "../../../core/domain/value-objects/EventHash";
import { Page, PageOptions, paginate } from "../../../core/application/dtos/Pagination";
import { PositionAggregate, PositionAggregateOptions } from "../../../core/application/dtos/PositionAggregate";
import { EconomicOutcome, PositionStatus } from "../../../core/application/dtos/PositionSummary";

function deriveStatusFromAggregate(agg: PositionAggregate): PositionStatus {
  if (agg.hasReversal) return "reversed";
  const totalClosed = agg.totalSettledUnits + agg.totalAdjustedUnits;
  if (agg.totalOriginatedUnits === 0n) return "open";
  if (totalClosed >= agg.totalOriginatedUnits) return "fully_settled";
  if (totalClosed > 0n) return "partially_settled";
  return "open";
}

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
    // Build per-objectId aggregate from the event store
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

    // Apply filters
    let results = [...aggMap.values()];

    if (options.objectType) {
      results = results.filter((a) => a.objectType === options.objectType);
    }
    if (options.status) {
      const target = options.status;
      results = results.filter((a) => deriveStatusFromAggregate(a) === target);
    }
    if (options.outcome) {
      const target = options.outcome;
      results = results.filter((a) => deriveOutcomeFromAggregate(deriveStatusFromAggregate(a), a) === target);
    }

    // Paginate
    const page  = Math.max(1, options.page  ?? 1);
    const limit = Math.min(Math.max(1, options.limit ?? 50), 200);
    const total = results.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const data = results.slice((page - 1) * limit, page * limit);

    return { data, total, page, limit, totalPages };
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
}
