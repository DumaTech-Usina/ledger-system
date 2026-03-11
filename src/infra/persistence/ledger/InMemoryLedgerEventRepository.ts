import { LedgerEventRepository } from "../../../core/application/repositories/LedgerEventRepository";
import { LedgerEvent } from "../../../core/domain/entities/LedgerEvent";
import { EventHash } from "../../../core/domain/value-objects/EventHash";

export class InMemoryLedgerEventRepository implements LedgerEventRepository {
  private readonly store: LedgerEvent[] = [];

  async save(event: LedgerEvent): Promise<void> {
    this.store.push(event);
  }

  async getLastEventHash(): Promise<EventHash | null> {
    if (this.store.length === 0) return null;
    return this.store[this.store.length - 1].hash;
  }

  async existsBySourceReference(sourceReference: string): Promise<boolean> {
    return this.store.some((e) => e.source.reference === sourceReference);
  }

  getAll(): readonly LedgerEvent[] {
    return [...this.store];
  }
}
