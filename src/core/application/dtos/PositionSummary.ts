import { LedgerEvent } from "../../domain/entities/LedgerEvent";
import { ObjectType } from "../../domain/enums/ObjectType";
import { Money } from "../../domain/value-objects/Money";

/**
 * open            — no SETTLES or REVERSES events yet
 * partially_settled — some SETTLES events, but totalSettled < totalOriginated
 * fully_settled   — totalSettled >= totalOriginated
 * reversed        — a REVERSES event is present (position cancelled)
 */
export type PositionStatus = "open" | "partially_settled" | "fully_settled" | "reversed";

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
  /** Remaining: totalOriginated − (totalSettled + totalAdjusted). Zero when fully closed. */
  openBalance: Money;
  /** Amount by which (totalSettled + totalAdjusted) exceeds totalOriginated. Zero when within bounds. */
  overSettlement: Money;
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
}
