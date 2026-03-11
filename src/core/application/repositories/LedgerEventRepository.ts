import { LedgerEvent } from "../../domain/entities/LedgerEvent";
import { EventHash } from "../../domain/value-objects/EventHash";

export interface LedgerEventRepository {
  save(event: LedgerEvent): Promise<void>;

  getLastEventHash(): Promise<EventHash | null>;

  existsBySourceReference(sourceReference: string): Promise<boolean>;
}
