import { StagingRepository } from "../../../core/application/repositories/StagingRepository";
import { StagingRecord } from "../../../core/application/dtos/StagingRecord";
import { Page, PageOptions, paginate } from "../../../core/application/dtos/Pagination";

export class InMemoryStagingRepository implements StagingRepository {
  private readonly store: StagingRecord[];

  constructor(records: StagingRecord[]) {
    this.store = records.map((r) => ({ ...r }));
  }

  async fetchPendingRecords(): Promise<StagingRecord[]> {
    return this.store.filter((r) => r.status === "pending");
  }

  async markAsAccepted(id: string): Promise<void> {
    const record = this.store.find((r) => r.id === id);
    if (record) record.status = "accepted";
  }

  async markAsRejected(id: string): Promise<void> {
    const record = this.store.find((r) => r.id === id);
    if (record) record.status = "rejected";
  }

  async findAll(): Promise<StagingRecord[]> {
    return [...this.store];
  }

  async findPaginated(options: PageOptions): Promise<Page<StagingRecord>> {
    return paginate([...this.store], options);
  }
}
