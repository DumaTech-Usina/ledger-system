import { StagingRecord } from "../dtos/StagingRecord";
import { Page, PageOptions } from "../dtos/Pagination";

export interface StagingRepository {
  claimPending(targetStatus: 'processing' | 'queued', limit?: number): Promise<StagingRecord[]>;
  save(record: StagingRecord): Promise<void>;
  markAsAccepted(id: string): Promise<void>;
  markAsRejected(id: string): Promise<void>;
  markAsPending(id: string): Promise<void>;
  findAll(): Promise<StagingRecord[]>;
  findPaginated(options: PageOptions): Promise<Page<StagingRecord>>;
}
