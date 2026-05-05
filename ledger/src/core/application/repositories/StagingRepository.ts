import { StagingRecord } from "../dtos/StagingRecord";
import { Page, PageOptions } from "../dtos/Pagination";

export interface StagingRepository {
  /**
   * Atomically marks up to `limit` pending records as "processing" and returns them.
   * Records claimed by one worker are invisible to concurrent workers.
   * The backing store (Redis, queue, etc.) is responsible for atomicity — Postgres
   * only holds accepted LedgerEvents and is never involved in staging.
   */
  claimPendingRecords(limit?: number): Promise<StagingRecord[]>;
  markAsAccepted(id: string): Promise<void>;
  markAsRejected(id: string): Promise<void>;
  findAll(): Promise<StagingRecord[]>;
  findPaginated(options: PageOptions): Promise<Page<StagingRecord>>;
}
