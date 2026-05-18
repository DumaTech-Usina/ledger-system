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
import { CashMovementsPaginatedOptions } from "../dtos/CashStatement";

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
  ): Promise<{
    items: LedgerEvent[];
    hasMore: boolean;
    nextCursor: { occurredAt: Date; id: string } | null;
  }>;

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
