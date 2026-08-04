import { ObjectType } from "../../domain/enums/ObjectType";
import { Money } from "../../domain/value-objects/Money";
import { EconomicOutcome, PositionStatus } from "./PositionSummary";

export interface PositionAggregateOptions {
  page?: number;
  limit?: number;
  status?: PositionStatus;
  outcome?: EconomicOutcome;
  objectType?: ObjectType;
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
}
