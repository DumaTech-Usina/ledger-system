import { StagingRecord } from "../dtos/StagingRecord";

export interface StagingRepository {
  fetchPendingRecords(): Promise<StagingRecord[]>;
  markAsAccepted(id: string): Promise<void>;
  markAsRejected(id: string): Promise<void>;
  findAll(): Promise<StagingRecord[]>;
}
