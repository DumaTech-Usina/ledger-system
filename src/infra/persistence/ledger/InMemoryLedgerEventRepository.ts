import { LedgerEventRepository } from "../../../core/application/repositories/LedgerEventRepository";
import { LedgerEvent } from "../../../core/domain/entities/LedgerEvent";
import { EventHash } from "../../../core/domain/value-objects/EventHash";
import { Page, PageOptions, paginate } from "../../../core/application/dtos/Pagination";

export class InMemoryLedgerEventRepository implements LedgerEventRepository {
  private readonly store: LedgerEvent[] = [];

  async save(event: LedgerEvent): Promise<void> {
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

  async findPaginated(options: PageOptions): Promise<Page<LedgerEvent>> {
    return paginate([...this.store], options);
  }
}
