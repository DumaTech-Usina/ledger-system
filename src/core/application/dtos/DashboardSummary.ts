import { LedgerEvent } from "../../domain/entities/LedgerEvent";
import { EventType } from "../../domain/enums/EventType";
import { Money } from "../../domain/value-objects/Money";
import { PositionListItem } from "./PositionAggregate";
import { BookHealthScore } from "./BookHealthScore";

export interface DashboardSummary {
  period: { from: Date; to: Date };
  /** ISO-4217 currency code used for all Money fields. */
  currency: string;

  // ── Zone 1: Vital Signs (cashIn/cashOut are period-scoped) ──────────────────
  cashIn: Money;
  cashOut: Money;
  /**
   * Signed net: cashIn.toUnits() − cashOut.toUnits().
   * Negative when outflows exceeded inflows in the period.
   */
  netCashUnits: bigint;

  /** Sum of all open balances across every position — current state, not period-scoped. */
  openExposure: Money;
  /**
   * Sum of open balances for positions with no settlement at all whose
   * origination date is older than 30 days — current state, not period-scoped.
   */
  capitalAtRisk: Money;

  // ── Zone 2: Profits & Holes (period-scoped) ─────────────────────────────────
  cashInByType: Readonly<Partial<Record<EventType, Money>>>;
  cashOutByType: Readonly<Partial<Record<EventType, Money>>>;
  /** Composite book health score derived from closure quality (Leg 1) and open book health (Leg 2). */
  healthScore: BookHealthScore;

  // ── Zone 3: Entry Points (current state) ────────────────────────────────────
  /** Open and partially-settled positions sorted oldest-origination first, capped at 6. */
  attentionPositions: PositionListItem[];
  /** Most recent cash_in / cash_out events across all time, capped at 8. */
  recentMovements: LedgerEvent[];
}
