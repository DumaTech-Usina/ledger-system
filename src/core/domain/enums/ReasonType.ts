export enum ReasonType {
  // Comissão
  COMMISSION_PAYMENT = "commission_payment",
  DIRECT_COMMISSION_PAYMENT_AUTHORIZED = "direct_commission_payment_authorized",
  COMMISSION_SPLIT = "commission_split",
  LATE_IDENTIFIED_COMMISSION = "late_identified_commission",
  COMMISSION_WAIVER = "commission_waiver",

  // Crédito
  LOAN_ORIGINATION = "loan_origination",
  LOAN_REPAYMENT = "loan_repayment",
  LOAN_REPAYMENT_VIA_COMMISSION = "loan_repayment_via_commission",
  ADVANCE_PAYMENT = "advance_payment",
  DEBT_RESTRUCTURING = "debt_restructuring",

  // Penalidade
  PENALTY_PAYMENT = "penalty_payment",
  PENALTY_RECOGNITION = "penalty_recognition",
  CHARGEBACK = "chargeback",
  DISPUTE_OPENED = "dispute_opened",
  LOSS_RECOGNITION = "loss_recognition",

  // Governança
  LATE_AWARENESS = "late_awareness",
  MANUAL_CORRECTION = "manual_correction",
  DATA_RECONCILIATION = "data_reconciliation",
  UNKNOWN_ORIGIN = "unknown_origin",

  // Operação
  PAYROLL_PAYMENT = "payroll_payment",
  INFRASTRUCTURE_EXPENSE = "infrastructure_expense",
  THIRD_PARTY_PAYMENT = "third_party_payment",
  TAX_PAYMENT = "tax_payment",
}
