import { StagingRecord } from "../dtos/StagingRecord";

export interface StagingMessageHandler {
  handle(record: StagingRecord): Promise<void>;
}
