export enum ObjectType {
  // Comissão
  COMMISSION_ENTITLEMENT = "commission_entitlement",
  COMMISSION_POOL = "commission_pool",
  COMMISSION_RECEIVABLE = "commission_receivable",
  COMMISSION_PAYABLE = "commission_payable",

  // Crédito
  LOAN = "loan",
  ADVANCE = "advance",
  RECEIVABLE = "receivable",
  PAYABLE = "payable",

  // Contratual
  CONTRACT = "contract",
  PROPOSAL = "proposal",
  INSTALLMENT = "installment",
  SETTLEMENT_BATCH = "settlement_batch",

  // Penalidade
  PENALTY = "penalty",
  CHARGEBACK = "chargeback",
  CONTINGENT_CLAIM = "contingent_claim",
  DISPUTE = "dispute",

  // Incentivo
  INCENTIVE = "incentive",
  CAMPAIGN = "campaign",
  BONUS = "bonus",

  // Custo
  PAYROLL = "payroll",
  SERVICE_FEE = "service_fee",
  INFRASTRUCTURE_COST = "infrastructure_cost",
  TAX = "tax",
}
