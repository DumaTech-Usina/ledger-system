import { RejectedEventRepository } from "../../../core/application/repositories/RejectedEventRepository";
import { RejectedEvent } from "../../../core/domain/entities/RejectedEvent";

export class InMemoryRejectedEventRepository implements RejectedEventRepository {
  private readonly store: RejectedEvent[] = [];

  async save(event: RejectedEvent): Promise<void> {
    this.store.push(event);
  }

  async findAll(): Promise<RejectedEvent[]> {
    return [...this.store];
  }
}
