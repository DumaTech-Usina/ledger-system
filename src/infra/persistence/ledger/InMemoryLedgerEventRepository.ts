import { LedgerEventRepository } from "../../../core/application/repositories/LedgerEventRepository";
import { LedgerEvent } from "../../../core/domain/entities/LedgerEvent";
import { EventHash } from "../../../core/domain/value-objects/EventHash";
import { Page, PageOptions, paginate } from "../../../core/application/dtos/Pagination";

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

  async findAllObjectIds(): Promise<string[]> {
    const ids = new Set<string>();
    for (const event of this.store) {
      for (const obj of event.getObjects()) {
        ids.add(obj.objectId.value);
      }
    }
    return [...ids];
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
