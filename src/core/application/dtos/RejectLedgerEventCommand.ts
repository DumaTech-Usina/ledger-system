import { RejectionType } from "../../domain/value-objects/RejectionType";

export interface RejectLedgerEventCommand {
  stagingId: string;
  reasons: Array<{
    type: RejectionType;
    description: string;
  }>;
  rawPayload?: unknown;
  sourceSystem?: string;
}
