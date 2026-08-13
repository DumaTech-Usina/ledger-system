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
  /**
   * One status, or several. Several are read as OR — "positions in any of these states" — because
   * a status is exclusive: no position is both `open` and `reversed`, so an AND would name the
   * empty set. A single value keeps meaning exactly what it meant.
   */
  status?: PositionStatus | PositionStatus[];
  outcome?: EconomicOutcome;
  /** One type, or several, read as OR for the same reason: an objectId resolves to one type. */
  objectType?: ObjectType | ObjectType[];
  /**
   * Restricts to positions a party is INVOLVED in: it appears on some standing event of the
   * position, in any role, any direction, under any relation.
   *
   * Involvement, not protagonism. A position originated with one party and settled by another is
   * returned for both — the settlement is part of that position's life, and hiding it from the
   * party who paid would answer a narrower question than the one asked. Several values are read as
   * OR, like the other selections.
   *
   * The ledger does not call this a "counterparty" because it does not know which side is us. It
   * knows parties; who counts as the other side is the reader's own knowledge.
   */
  partyId?: string | string[];
  /**
   * Restricts to positions that entered the book within [from, to].
   *
   * The axis is `createdAt` — the recording time of the position's earliest standing event — and
   * deliberately not `originatedAt` or `dueAt`. Those two are null for whole families of legitimate
   * positions (every cash-basis one originates nothing; every obligation whose establishing fact
   * stated no terms has no due date), and filtering on a null axis would silently drop them from a
   * listing that claims to be a period of the book. `createdAt` is defined for every position, and
   * is the same key the default ordering already uses.
   *
   * A period over `dueAt` is a different question ("what falls due in this window") and would need
   * its own parameter, so that "not known" can stay visible rather than being filtered out.
   */
  from?: Date;
  to?: Date;
  sortBy?: PositionSortKey;
  sortOrder?: "ASC" | "DESC";
}

/**
 * Normalizes a filter that admits one value or many into a list.
 *
 * Lives in one place because the two read paths — SQL and in-memory — must agree on what "several"
 * means, and on the fact that an EMPTY selection is no filter at all rather than a filter matching
 * nothing. The alternative is the accidental duplication §7 of `refinamento_de_valor.md` records:
 * the same rule resolved differently in each path, with no test fixing the agreement.
 */
export function asList<T>(value: T | readonly T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? [...value] : [value as T];
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
  /**
   * Every party named by some standing event of this position, deduplicated, in no meaningful order.
   *
   * Absent — not empty — when the read did not ask for them. An empty array would state that no one
   * took part in the position, which is never true of a recorded fact; absence states that this
   * particular read did not publish them. Populated by the paginated listing only: the whole-book
   * folds have no use for it and would pay to aggregate it over every position in the book.
   */
  parties?: readonly string[];
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
  /**
   * Every party involved in the position. Null when this read did not publish them — never an empty
   * array, which would claim the position has no parties at all.
   */
  parties: readonly string[] | null;
}
