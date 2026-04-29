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
  eventCount: number;
  lastEventAt: Date;
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
  openBalance: Money;
  overSettlement: Money;
  cashRecovered: Money;
  nonCashClosed: Money;
  allocationGap: Money;
  eventCount: number;
  lastEventAt: Date;
}
