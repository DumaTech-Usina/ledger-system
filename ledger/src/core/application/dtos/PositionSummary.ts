import { LedgerEvent } from "../../domain/entities/LedgerEvent";
import { EventType } from "../../domain/enums/EventType";
import { ObjectType } from "../../domain/enums/ObjectType";
import { Money } from "../../domain/value-objects/Money";

export interface PositionOrigin {
  eventId: string;
  eventType: EventType;
  occurredAt: Date;
  /** External ID from the source system — proposal number, contract ID, etc. */
  sourceReference: string;
  sourceSystem: string;
  description: string | null;
  reporter: {
    reporterType: string;
    reporterId: string;
    reporterName: string | null;
    channel: string;
  };
  parties: Array<{
    partyId: string;
    role: string;
    direction: string;
    amount: string | null;
  }>;
  /** Sibling objects from the originating event (proposal, contract, installment, etc.) */
  relatedObjects: Array<{
    objectId: string;
    objectType: string;
    relation: string;
  }>;
}

/**
 * open            — no SETTLES or REVERSES events yet
 * partially_settled — some SETTLES events, but totalSettled < totalOriginated
 * fully_settled   — totalSettled >= totalOriginated
 * reversed        — a REVERSES event is present (position cancelled)
 * unknown_origin  — an event declared its lineage unresolved and no ORIGINATES is on record: what
 *                   was originated is NOT known. Distinct from `open` (which asserts a known
 *                   baseline still outstanding) and never to be read as an origination of zero.
 */
export type PositionStatus =
  | "open"
  | "partially_settled"
  | "fully_settled"
  | "reversed"
  | "unknown_origin";

/**
 * gain         — fully settled via cash (no loss events)
 * partial_loss — some cash recovered, some recognised as lost or written off
 * full_loss    — originated but zero cash recovered (settled NON_CASH or loss-recognised)
 * cancelled    — reversed before settlement
 * pending      — not yet fully settled
 */
export type EconomicOutcome = "gain" | "partial_loss" | "full_loss" | "cancelled" | "pending";

export interface PositionSummary {
  objectId: string;
  objectType: ObjectType;
  status: PositionStatus;
  /** Sum of amounts from all ORIGINATES events for this object. */
  totalOriginated: Money;
  /** Sum of amounts from all SETTLES events (any economic effect). */
  totalSettled: Money;
  /** Sum of amounts from all ADJUSTS events (e.g. partial repayments via commission netting). */
  totalAdjusted: Money;
  /**
   * Remaining: totalOriginated − (totalSettled + totalAdjusted). Zero when fully closed.
   * **Null when the origination is unknown** — a missing baseline makes the remainder unknowable,
   * and reporting it as zero would state a completeness the event stream does not assert.
   */
  openBalance: Money | null;
  /**
   * Amount by which (totalSettled + totalAdjusted) exceeds totalOriginated. Zero when within bounds.
   * **Null when the origination is unknown** — there is no baseline to exceed, so conservation
   * cannot be evaluated; zero here would silently claim it was.
   */
  overSettlement: Money | null;
  /** SETTLES events with CASH_IN effect — actual money returned. */
  cashRecovered: Money;
  /** SETTLES events with NON_CASH effect — written off or debt-renegotiated amounts. */
  nonCashClosed: Money;
  /**
   * For contextual objects (SETTLEMENT_BATCH): cash received (CASH_IN) minus cash distributed
   * (CASH_OUT). Positive value means unallocated cash is sitting in the batch. Zero when fully
   * allocated or when the object is not a correlation anchor for cash flows.
   */
  allocationGap: Money;
  outcome: EconomicOutcome;
  eventCount: number;
  events: readonly LedgerEvent[];
  /** Context extracted from the ORIGINATES event — null when no origination event exists. */
  origin: PositionOrigin | null;
}
