import { LedgerEvent } from "../../domain/entities/LedgerEvent";
import { EventHash } from "../../domain/value-objects/EventHash";
import { Page, PageOptions } from "../dtos/Pagination";
import { PositionAggregate, PositionAggregateOptions } from "../dtos/PositionAggregate";

export interface LedgerEventRepository {
  save(event: LedgerEvent): Promise<void>;

  getById(id: string): Promise<LedgerEvent | null>;

  getByHash(hash: string): Promise<LedgerEvent | null>;

  getByCommandId(commandId: string): Promise<LedgerEvent | null>;

  getLastEventHash(): Promise<EventHash | null>;

  existsBySourceReference(sourceReference: string): Promise<boolean>;

  /** All events that reference a given economic object — reconstructs the object's full lifecycle. */
  findByObjectId(objectId: string): Promise<LedgerEvent[]>;

  /** All events that were directly caused by a given event (via relatedEventId). */
  findByRelatedEventId(relatedEventId: string): Promise<LedgerEvent[]>;

  /** All events where a given party participated. */
  findByPartyId(partyId: string): Promise<LedgerEvent[]>;

  findAll(): Promise<LedgerEvent[]>;

  findPaginated(options: PageOptions): Promise<Page<LedgerEvent>>;

  /** Deduplicated set of all objectIds that appear across every event in the store. */
  findAllObjectIds(): Promise<string[]>;

  /** Aggregated position numbers per objectId, with optional filtering and pagination. */
  findPositionAggregates(options: PositionAggregateOptions): Promise<Page<PositionAggregate>>;
}
