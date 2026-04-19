import { LedgerEvent } from "../../domain/entities/LedgerEvent";
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
  status: PositionStatus;
  /** Sum of amounts from all ORIGINATES events for this object. */
  totalOriginated: Money;
  /** Sum of amounts from all SETTLES events (any economic effect). */
  totalSettled: Money;
  /** Remaining: totalOriginated − totalSettled. Zero when fully settled or reversed. */
  openBalance: Money;
  /** SETTLES events with CASH_IN effect — actual money returned. */
  cashRecovered: Money;
  /** SETTLES events with NON_CASH effect — written off or debt-renegotiated amounts. */
  nonCashClosed: Money;
  outcome: EconomicOutcome;
  eventCount: number;
  events: readonly LedgerEvent[];
}
