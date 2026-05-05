import { RejectedEventRepository } from "../../../core/application/repositories/RejectedEventRepository";
import { RejectedEvent } from "../../../core/domain/entities/RejectedEvent";
import { Page, PageOptions, paginate } from "../../../core/application/dtos/Pagination";

export class InMemoryRejectedEventRepository implements RejectedEventRepository {
  private readonly store: RejectedEvent[] = [];

  async save(event: RejectedEvent): Promise<void> {
    this.store.push(event);
  }

  async findAll(): Promise<RejectedEvent[]> {
    return [...this.store];
  }

  async findPaginated(options: PageOptions): Promise<Page<RejectedEvent>> {
    return paginate([...this.store], options);
  }
}
