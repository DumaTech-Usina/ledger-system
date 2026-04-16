import { StagingRecord } from "../dtos/StagingRecord";
import { Page, PageOptions } from "../dtos/Pagination";

export interface StagingRepository {
  fetchPendingRecords(): Promise<StagingRecord[]>;
  markAsAccepted(id: string): Promise<void>;
  markAsRejected(id: string): Promise<void>;
  findAll(): Promise<StagingRecord[]>;
  findPaginated(options: PageOptions): Promise<Page<StagingRecord>>;
}
