import { StagingRecord } from "../dtos/StagingRecord";

export interface StagingRepository {
  fetchPendingRecords(): Promise<StagingRecord[]>;
  markAsProcessed(id: string): Promise<void>;
  findAll(): Promise<StagingRecord[]>;
}
