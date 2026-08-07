import { ObjectType } from "../../domain/enums/ObjectType";
import { Money } from "../../domain/value-objects/Money";
import { EconomicOutcome, PositionStatus } from "./PositionSummary";

/**
 * How the listing is ordered.
 *
 * `createdAt` — newest position in the book first. The default, and what a listing of "the book"
 * means when no question about timing was asked.
 *
 * `dueAt` — nearest due date first, so a listing about deadlines is ordered by deadline. Positions
 * with no stated due date sort LAST regardless of direction: they are not the most urgent thing in
 * the book, and putting an unknown at the top of a list about time would read as an answer.
 */
export type PositionSortKey = "createdAt" | "dueAt";

export interface PositionAggregateOptions {
  page?: number;
  limit?: number;
  status?: PositionStatus;
  outcome?: EconomicOutcome;
  objectType?: ObjectType;
  sortBy?: PositionSortKey;
  sortOrder?: "ASC" | "DESC";
}

/** Raw per-object numbers from the persistence layer. Units are bigint cents (same scale as Money.toUnits()). */
export interface PositionAggregate {
  objectId: string;
  objectType: ObjectType;
  currency: string;
  totalOriginatedUnits: bigint;
  totalSettledUnits: bigint;
  totalAdjustedUnits: bigint;
  cashRecoveredUnits: bigint;
  nonCashClosedUnits: bigint;
  refCashInUnits: bigint;
  refCashOutUnits: bigint;
  hasReversal: boolean;
  /**
   * True when some event on this object declared its lineage unresolved (reason UNKNOWN_ORIGIN with
   * requiresFollowup). Combined with no ORIGINATES, it is the difference between "nothing was ever
   * originated" (a cash-basis payable) and "we do not know what was originated" (an orphan).
   */
  hasUnresolvedLineage: boolean;
  eventCount: number;
  lastEventAt: Date;
  /** Date of the first ORIGINATES event for this object. Null when the position has no origination event. */
  originatedAt: Date | null;
  /**
   * When this position first appeared in the book: the RECORDING time of its earliest standing event.
   *
   * Deliberately not `originatedAt`, which is null for every cash-basis position (a payroll, a
   * penalty, an infrastructure expense originate nothing) — ordering by it would push those to one
   * end of the list regardless of when they appeared, which is an ordering the book cannot justify.
   * Deliberately not `occurredAt` either: a fact may be recorded long after it happened, and
   * "created" is about the book, not about the world.
   *
   * Derived from the immutable chain on every read, never stored on the position.
   */
  createdAt: Date;
  /**
   * When this position falls due: the earliest due date any standing ORIGINATES declared for it.
   *
   * `MIN` because a position originated more than once is governed by the earliest commitment made
   * about it. Read only from ORIGINATES — a settlement carries no due date, and the invariant refuses
   * one there.
   *
   * Null when no origination stated terms. That is a THIRD state, not a late one and not a future
   * one: nothing downstream may fold it into either total.
   */
  dueAt: Date | null;
}

/** A projected position for list views — PositionSummary without the events array. */
export interface PositionListItem {
  objectId: string;
  objectType: ObjectType;
  status: PositionStatus;
  outcome: EconomicOutcome;
  totalOriginated: Money;
  totalSettled: Money;
  totalAdjusted: Money;
  /** Null when the origination is unknown: the remaining balance is not computable, not zero. */
  openBalance: Money | null;
  /** Null when the origination is unknown: there is no baseline to exceed. */
  overSettlement: Money | null;
  cashRecovered: Money;
  nonCashClosed: Money;
  allocationGap: Money;
  eventCount: number;
  lastEventAt: Date;
  /** Date of the first ORIGINATES event. Null when no origination event exists on this position. */
  originatedAt: Date | null;
  /** When the position first appeared in the book — the recording time of its earliest standing event. */
  createdAt: Date;
  /** Earliest due date declared by a standing ORIGINATES. Null when no origination stated terms. */
  dueAt: Date | null;
}
