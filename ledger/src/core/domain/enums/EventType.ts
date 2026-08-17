export enum EventType {
  PAYROLL_PAYMENT = "payroll_payment",
  INFRASTRUCTURE_EXPENSE = "infrastructure_expense",
  COMMISSION_RECEIVED = "commission_received",
  COMMISSION_SPLIT = "commission_split",
  COMMISSION_WAIVER = "commission_waiver",
  PENALTY_PAYMENT = "penalty_payment",
  ADVANCE_PAYMENT = "advance_payment",

  /** Full recovery, partial recovery, loss recognition, or renegotiation of an advance.
   *  Requires relatedEventId pointing to the originating ADVANCE_PAYMENT event. */
  ADVANCE_SETTLEMENT = "advance_settlement",

  /** Usina disburses a loan to a broker. Creates a LOAN receivable. */
  LOAN_ORIGINATION = "loan_origination",

  /** Broker repays a loan (cash or via commission deduction).
   *  Requires relatedEventId pointing to the originating LOAN_ORIGINATION event. */
  LOAN_REPAYMENT = "loan_repayment",

  /** Operator paid a broker directly (bypassing Usina). Usina records the
   *  settlement of its commission receivable even though no cash arrived. */
  DIRECT_PAYMENT_ACKNOWLEDGED = "direct_payment_acknowledged",

  /** Usina pays an incentive, bonus, or campaign reward to a broker or partner. */
  INCENTIVE_PAYMENT = "incentive_payment",

  /**
   * A first-class corrective entry that reverses or adjusts a previously
   * registered event. Always append-only: the original stays in the ledger
   * and this event documents the correction with a mandatory previousHash link.
   *
   * Actual money movement resulting from the correction (e.g. a clawback)
   * must be recorded as a separate domain event.
   */
  LEDGER_CORRECTION = "ledger_correction",

  /**
   * Records the expected (accrued) amount of a commission before cash arrives.
   * NON_CASH — no money moves; this is a bookkeeping entry that ORIGINATES a
   * COMMISSION_RECEIVABLE so subsequent commission_received events can be
   * reconciled against a known expected amount.
   */
  COMMISSION_EXPECTED = "commission_expected",

  /**
   * Generic cash-basis outbound payment: the usina pays a counterparty, SETTLING a PAYABLE.
   *
   * Reserved for the outflow whose category the model does not express. A category that HAS its own
   * ObjectType gets its own event type and its own Reason — the way PAYROLL, INFRASTRUCTURE_COST,
   * SERVICE_FEE and TAX do — so that the paid category survives into the reason and not only into
   * the position. This tuple is the zero-point for everything still uncategorized.
   */
  OUTBOUND_PAYMENT = "outbound_payment",

  /**
   * Usina pays a service fee, SETTLING a SERVICE_FEE obligation. The cash-out twin of the
   * SERVICE_FEE branch of OBLIGATION_RECOGNIZED.
   *
   * Needs no prior recognition: paying a fee nobody recognized first is the ordinary cash-basis
   * fact, and it derives to the same position as the recognized order (the fold reads sums, never
   * order). When a recognition does exist, the payment closes it by naming the same objectId.
   */
  SERVICE_FEE_PAYMENT = "service_fee_payment",

  /**
   * Usina pays an assessed tax, SETTLING a TAX obligation. The cash-out twin of the TAX branch of
   * OBLIGATION_RECOGNIZED, on the same terms as SERVICE_FEE_PAYMENT above.
   */
  TAX_PAYMENT = "tax_payment",

  /**
   * Records an obligation the usina owes, created by an external fact — an invoice issued against
   * it, a payroll closed, a tax assessed. NON_CASH — no money moves; this ORIGINATES the position
   * that a later payment settles.
   *
   * The twin of COMMISSION_EXPECTED on the outbound side: which kind of obligation it is rides on
   * the objectType (PAYROLL, SERVICE_FEE, INFRASTRUCTURE_COST, TAX, PAYABLE), not on the event type.
   *
   * Carries no relatedEventId requirement, and the payment that settles it needs no prior
   * recognition: both orders of arrival are legitimate, and both derive to the same position.
   */
  OBLIGATION_RECOGNIZED = "obligation_recognized",
}
