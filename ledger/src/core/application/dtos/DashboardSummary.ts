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

  /**
   * Sum of open balances for positions where Usina is the creditor — what is owed TO it.
   * Current state, not period-scoped. Never includes obligations; see openPayableExposure.
   */
  openExposure: Money;
  /**
   * Sum of open balances for recognized obligations Usina has not yet paid — what it owes.
   * Current state, not period-scoped. Kept apart from openExposure on purpose: the two run in
   * opposite directions and a combined total would assert nothing.
   */
  openPayableExposure: Money;
  /**
   * The three parts `openPayableExposure` splits into, by what the establishing fact said about
   * timing. They sum to it and are never merged: "we owe 100" answers a different question from
   * "40 of it was due last week". `undatedPayable` is the honest remainder — obligations whose terms
   * were never stated — and belongs to neither of the other two.
   */
  overduePayable: Money;
  upcomingPayable: Money;
  undatedPayable: Money;
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
