import { LedgerEvent } from "../../domain/entities/LedgerEvent";
import { EconomicEffect } from "../../domain/enums/EconomicEffect";
import { EventType } from "../../domain/enums/EventType";
import { ObjectType } from "../../domain/enums/ObjectType";
import { EventHash } from "../../domain/value-objects/EventHash";
import { Page, PageOptions } from "../dtos/Pagination";
import {
  PositionAggregate,
  PositionAggregateOptions,
} from "../dtos/PositionAggregate";
import { CashMovementCursor, CashMovementsPaginatedOptions } from "../dtos/CashStatement";

/**
 * One page of cash movements, in whichever mode was asked for.
 *
 * `nextCursor` is null on a numbered page and `total`/`page`/`totalPages` are null on a keyset one.
 * Each null says "this mode does not answer that", which is not the same as zero or as the end of
 * the list — a caller must be able to tell "no more pages" from "nobody counted".
 */
export interface CashMovementsQueryResult {
  items: LedgerEvent[];
  hasMore: boolean;
  nextCursor: CashMovementCursor | null;
  total: number | null;
  page: number | null;
  totalPages: number | null;
}

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

  /**
   * Which of the given objects are settled — one lookup for the whole set.
   *
   * Exists because the alternative is reading every event of every object just to ask a yes/no
   * question about each, which is one query per object on a page.
   *
   * An object counts as settled when an event that STANDS declares SETTLES on it. A retracted
   * settlement does not count: the rectification declared that it never corresponded to the world,
   * so the position it appeared to close is open again — the same reading every projection applies.
   */
  findSettledObjectIds(objectIds: readonly string[]): Promise<Set<string>>;

  /** All events where a given party participated. */
  findByPartyId(partyId: string): Promise<LedgerEvent[]>;

  findAll(): Promise<LedgerEvent[]>;

  findPaginated(options: PageOptions): Promise<Page<LedgerEvent>>;

  /** Deduplicated set of all objectIds that appear across every event in the store. */
  findAllObjectIds(): Promise<string[]>;

  /** All events whose occurredAt falls within [from, to] inclusive. */
  findByPeriod(from: Date, to: Date): Promise<LedgerEvent[]>;

  /** Aggregated position numbers per objectId, with optional filtering and pagination. */
  findPositionAggregates(
    options: PositionAggregateOptions,
  ): Promise<Page<PositionAggregate>>;

  /**
   * Sums all CASH_IN and CASH_OUT event amounts in a single pass.
   * Callers never receive individual events — O(1) memory regardless of ledger size.
   * Returns units (bigint) to stay consistent with the aggregate DTO pattern.
   * Currency defaults to "BRL" when the ledger has no cash-flow events.
   */
  aggregateCashFlows(): Promise<{
    cashInUnits: bigint;
    cashOutUnits: bigint;
    currency: string;
  }>;

  /**
   * Returns the sum of open balances grouped by ObjectType — at most 24 rows regardless of ledger size.
   * "Open" means: not reversed, originated > 0, and totalSettled + totalAdjusted < totalOriginated.
   * Used by CashPositionService to bucket positions into receivables vs contingent exposure
   * without loading individual events or running N+1 queries.
   */
  aggregateOpenBalancesByObjectType(): Promise<
    Array<{
      objectType: ObjectType;
      openBalanceUnits: bigint;
      currency: string;
    }>
  >;

  /**
   * Same as aggregateCashFlows() but only counts events where occurredAt < date.
   * Used by CashStatementService to compute opening balance.
   */
  aggregateCashFlowsBefore(
    date: Date,
  ): Promise<{ cashInUnits: bigint; cashOutUnits: bigint; currency: string }>;

  /**
   * Returns the sum of amounts for events that settle something in [from, to].
   * Much lighter than findByPeriod — no entity hydration, single aggregation query.
   */
  aggregateClosureStats(
    from: Date,
    to: Date,
    currency: string,
  ): Promise<{ cashInSettledUnits: bigint; totalSettledUnits: bigint }>;

  /**
   * Filters cash movements (CASH_IN | CASH_OUT) for a given party, with optional period and cursor.
   * Returns at most limit+1 items so callers can detect hasMore without a count query.
   */
  findCashMovementsPaginated(
    options: CashMovementsPaginatedOptions,
  ): Promise<CashMovementsQueryResult>;

  /**
   * Returns all position aggregates in a single pass — no pagination, no COUNT query.
   * Use for operations that need the full book state (dashboard, health score).
   */
  findAllPositionAggregates(): Promise<PositionAggregate[]>;

  /**
   * Aggregates CASH_IN and CASH_OUT amounts in [from, to] grouped by event_type × economic_effect.
   * Single aggregation query — never hydrates full entities.
   * Used by DashboardService to compute period cash flow without loading individual events.
   */
  aggregatePeriodCashFlow(
    from: Date,
    to: Date,
  ): Promise<Array<{ eventType: EventType; economicEffect: EconomicEffect; totalUnits: bigint; currency: string }>>;

  /**
   * Returns the most recent `limit` CASH_IN / CASH_OUT events, fully hydrated.
   * Filters by economic effect in SQL — no over-fetching.
   */
  findRecentCashMovements(limit: number): Promise<LedgerEvent[]>;
}
