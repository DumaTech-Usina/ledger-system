export enum EventType {
  PAYROLL_PAYMENT = "payroll_payment",
  INFRASTRUCTURE_EXPENSE = "infrastructure_expense",
  COMMISSION_RECEIVED = "commission_received",
  COMMISSION_SPLIT = "commission_split",
  COMMISSION_WAIVER = "commission_waiver",
  PENALTY_PAYMENT = "penalty_payment",
  ADVANCE_PAYMENT = "advance_payment",

  /**
   * A first-class corrective entry that reverses or adjusts a previously
   * registered event. Always append-only: the original stays in the ledger
   * and this event documents the correction with a mandatory previousHash link.
   *
   * Actual money movement resulting from the correction (e.g. a clawback)
   * must be recorded as a separate domain event.
   */
  LEDGER_CORRECTION = "ledger_correction",
}
