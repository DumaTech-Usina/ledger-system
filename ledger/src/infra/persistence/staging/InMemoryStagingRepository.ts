import { StagingRepository } from "../../../core/application/repositories/StagingRepository";
import { StagingRecord } from "../../../core/application/dtos/StagingRecord";
import { Page, PageOptions, paginate } from "../../../core/application/dtos/Pagination";

export class InMemoryStagingRepository implements StagingRepository {
  private readonly store: StagingRecord[];

  constructor(records: StagingRecord[]) {
    this.store = records.map((r) => ({ ...r }));
  }

  async save(record: StagingRecord): Promise<void> {
    this.store.push({ ...record });
  }

  async claimPending(targetStatus: 'processing' | 'queued', limit = 100, eventTypes?: string[]): Promise<StagingRecord[]> {
    const pending = this.store
      .filter((r) => r.status === 'pending' && (!eventTypes?.length || eventTypes.includes(r.eventType as string)))
      .slice(0, limit);
    for (const r of pending) r.status = targetStatus;
    return pending;
  }

  async markAsAccepted(id: string): Promise<void> {
    const record = this.store.find((r) => r.id === id);
    if (record) record.status = "accepted";
  }

  async markAsRejected(id: string): Promise<void> {
    const record = this.store.find((r) => r.id === id);
    if (record) record.status = "rejected";
  }

  async markAsPending(id: string): Promise<void> {
    const record = this.store.find((r) => r.id === id);
    if (record) record.status = "pending";
  }

  async findAll(): Promise<StagingRecord[]> {
    return [...this.store];
  }

  async findPaginated(options: PageOptions): Promise<Page<StagingRecord>> {
    return paginate([...this.store], options);
  }
}
