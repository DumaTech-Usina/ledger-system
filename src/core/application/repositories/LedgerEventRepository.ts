import { LedgerEvent } from "../../domain/entities/LedgerEvent";
import { EventHash } from "../../domain/value-objects/EventHash";
import { Page, PageOptions } from "../dtos/Pagination";

export interface LedgerEventRepository {
  save(event: LedgerEvent): Promise<void>;

  getById(id: string): Promise<LedgerEvent | null>;

  getByHash(hash: string): Promise<LedgerEvent | null>;

  getByCommandId(commandId: string): Promise<LedgerEvent | null>;

  getLastEventHash(): Promise<EventHash | null>;

  existsBySourceReference(sourceReference: string): Promise<boolean>;

  findAll(): Promise<LedgerEvent[]>;

  findPaginated(options: PageOptions): Promise<Page<LedgerEvent>>;
}
