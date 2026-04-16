import { EconomicEffect } from "../enums/EconomicEffect";
import { Relation } from "../enums/Relation";
import { ObjectNature } from "../enums/ObjectNature";
import { ObjectType } from "../enums/ObjectType";
import { ReasonType } from "../enums/ReasonType";

// ===============================
// economic_effect × relation
// ===============================

export const ECONOMIC_EFFECT_RELATION_MATRIX: Record<
  EconomicEffect,
  readonly Relation[]
> = {
  [EconomicEffect.CASH_IN]: [Relation.ORIGINATES, Relation.SETTLES],

  [EconomicEffect.CASH_OUT]: [Relation.ORIGINATES, Relation.SETTLES],

  [EconomicEffect.CASH_INTERNAL]: [Relation.ADJUSTS],

  [EconomicEffect.NON_CASH]: [
    Relation.ORIGINATES,
    Relation.ADJUSTS,
    Relation.SETTLES,
    Relation.REVERSES,
  ],

  [EconomicEffect.CONTINGENT]: [Relation.ORIGINATES, Relation.ADJUSTS],
};

// ===============================
// object_type × object_nature
// ===============================

export const OBJECT_NATURE_MATRIX: Record<ObjectType, ObjectNature> = {
  [ObjectType.COMMISSION_ENTITLEMENT]: ObjectNature.POSITIONAL,
  [ObjectType.COMMISSION_POOL]: ObjectNature.POSITIONAL,
  [ObjectType.COMMISSION_RECEIVABLE]: ObjectNature.POSITIONAL,
  [ObjectType.COMMISSION_PAYABLE]: ObjectNature.POSITIONAL,

  [ObjectType.LOAN]: ObjectNature.POSITIONAL,
  [ObjectType.ADVANCE]: ObjectNature.POSITIONAL,
  [ObjectType.RECEIVABLE]: ObjectNature.POSITIONAL,
  [ObjectType.PAYABLE]: ObjectNature.POSITIONAL,

  [ObjectType.PENALTY]: ObjectNature.POSITIONAL,
  [ObjectType.CHARGEBACK]: ObjectNature.POSITIONAL,
  [ObjectType.CONTINGENT_CLAIM]: ObjectNature.POSITIONAL,
  [ObjectType.DISPUTE]: ObjectNature.POSITIONAL,

  [ObjectType.INCENTIVE]: ObjectNature.POSITIONAL,
  [ObjectType.BONUS]: ObjectNature.POSITIONAL,

  [ObjectType.PAYROLL]: ObjectNature.POSITIONAL,
  [ObjectType.SERVICE_FEE]: ObjectNature.POSITIONAL,
  [ObjectType.INFRASTRUCTURE_COST]: ObjectNature.POSITIONAL,
  [ObjectType.TAX]: ObjectNature.POSITIONAL,

  [ObjectType.CONTRACT]: ObjectNature.CONTEXTUAL,
  [ObjectType.PROPOSAL]: ObjectNature.CONTEXTUAL,
  [ObjectType.INSTALLMENT]: ObjectNature.CONTEXTUAL,
  [ObjectType.SETTLEMENT_BATCH]: ObjectNature.CONTEXTUAL,
  [ObjectType.CAMPAIGN]: ObjectNature.CONTEXTUAL,
};

// ===============================
// object_type × relation
// ===============================

export const OBJECT_RELATION_MATRIX: Partial<
  Record<ObjectType, readonly Relation[]>
> = {
  [ObjectType.COMMISSION_ENTITLEMENT]: [
    Relation.ORIGINATES,
    Relation.ADJUSTS,
    Relation.SETTLES,
    Relation.REVERSES,
  ],

  [ObjectType.LOAN]: [Relation.ORIGINATES, Relation.ADJUSTS, Relation.SETTLES, Relation.REVERSES],

  [ObjectType.ADVANCE]: [
    Relation.ORIGINATES,
    Relation.ADJUSTS,
    Relation.SETTLES,
    Relation.REVERSES,
  ],

  [ObjectType.PENALTY]: [
    Relation.ORIGINATES,
    Relation.ADJUSTS,
    Relation.SETTLES,
    Relation.REVERSES,
  ],

  [ObjectType.CONTINGENT_CLAIM]: [Relation.ORIGINATES, Relation.ADJUSTS, Relation.REVERSES],

  [ObjectType.INCENTIVE]: [
    Relation.ORIGINATES,
    Relation.ADJUSTS,
    Relation.SETTLES,
    Relation.REVERSES,
  ],

  [ObjectType.COMMISSION_POOL]: [Relation.ADJUSTS, Relation.REVERSES],

  [ObjectType.CONTRACT]: [],
};

// ===============================
// reason_type × economic_effect
// ===============================

export const REASON_EFFECT_MATRIX: Partial<
  Record<ReasonType, readonly EconomicEffect[]>
> = {
  // Comissão
  [ReasonType.COMMISSION_PAYMENT]: [EconomicEffect.CASH_IN],
  [ReasonType.DIRECT_COMMISSION_PAYMENT_AUTHORIZED]: [EconomicEffect.CASH_IN],
  [ReasonType.COMMISSION_SPLIT]: [EconomicEffect.CASH_INTERNAL],
  [ReasonType.LATE_IDENTIFIED_COMMISSION]: [EconomicEffect.NON_CASH],
  [ReasonType.COMMISSION_WAIVER]: [EconomicEffect.NON_CASH],

  // Crédito
  [ReasonType.LOAN_ORIGINATION]: [EconomicEffect.CASH_OUT],
  [ReasonType.LOAN_REPAYMENT]: [EconomicEffect.CASH_IN],
  [ReasonType.LOAN_REPAYMENT_VIA_COMMISSION]: [EconomicEffect.NON_CASH, EconomicEffect.CASH_INTERNAL],
  [ReasonType.ADVANCE_PAYMENT]: [EconomicEffect.CASH_OUT, EconomicEffect.NON_CASH],
  [ReasonType.DEBT_RESTRUCTURING]: [EconomicEffect.NON_CASH],

  // Penalidade
  [ReasonType.PENALTY_PAYMENT]: [EconomicEffect.CASH_OUT],
  [ReasonType.PENALTY_RECOGNITION]: [EconomicEffect.CONTINGENT, EconomicEffect.NON_CASH],
  [ReasonType.CHARGEBACK]: [EconomicEffect.CASH_OUT, EconomicEffect.NON_CASH],
  [ReasonType.DISPUTE_OPENED]: [EconomicEffect.CONTINGENT],
  [ReasonType.LOSS_RECOGNITION]: [EconomicEffect.NON_CASH],

  // Operação
  [ReasonType.PAYROLL_PAYMENT]: [EconomicEffect.CASH_OUT],
  [ReasonType.INFRASTRUCTURE_EXPENSE]: [EconomicEffect.CASH_OUT],
  [ReasonType.THIRD_PARTY_PAYMENT]: [EconomicEffect.CASH_OUT],
  [ReasonType.TAX_PAYMENT]: [EconomicEffect.CASH_OUT],

  // Governança — corrections are always bookkeeping entries (no cash movement)
  [ReasonType.MANUAL_CORRECTION]: [EconomicEffect.NON_CASH],
  [ReasonType.DATA_RECONCILIATION]: [EconomicEffect.NON_CASH],

  // LATE_AWARENESS and UNKNOWN_ORIGIN are intentionally absent:
  // they are polymorphic reasons that can accompany any economic effect.
};

// ===============================
// reason_type × relation
// ===============================

export const REASON_RELATION_MATRIX: Partial<
  Record<ReasonType, readonly Relation[]>
> = {
  // Comissão
  [ReasonType.COMMISSION_PAYMENT]: [Relation.SETTLES],
  [ReasonType.DIRECT_COMMISSION_PAYMENT_AUTHORIZED]: [Relation.SETTLES],
  [ReasonType.COMMISSION_SPLIT]: [Relation.ADJUSTS],
  [ReasonType.LATE_IDENTIFIED_COMMISSION]: [Relation.ORIGINATES, Relation.ADJUSTS],
  [ReasonType.COMMISSION_WAIVER]: [Relation.SETTLES, Relation.REVERSES],

  // Crédito
  [ReasonType.LOAN_ORIGINATION]: [Relation.ORIGINATES],
  [ReasonType.LOAN_REPAYMENT]: [Relation.SETTLES],
  [ReasonType.LOAN_REPAYMENT_VIA_COMMISSION]: [Relation.SETTLES],
  [ReasonType.ADVANCE_PAYMENT]: [Relation.ORIGINATES, Relation.ADJUSTS, Relation.SETTLES],
  [ReasonType.DEBT_RESTRUCTURING]: [Relation.ADJUSTS],

  // Penalidade
  [ReasonType.PENALTY_PAYMENT]: [Relation.SETTLES],
  [ReasonType.PENALTY_RECOGNITION]: [Relation.ORIGINATES],
  [ReasonType.CHARGEBACK]: [Relation.ORIGINATES, Relation.SETTLES],
  [ReasonType.DISPUTE_OPENED]: [Relation.ORIGINATES],
  [ReasonType.LOSS_RECOGNITION]: [Relation.ORIGINATES, Relation.SETTLES],

  // Operação
  [ReasonType.PAYROLL_PAYMENT]: [Relation.SETTLES],
  [ReasonType.INFRASTRUCTURE_EXPENSE]: [Relation.SETTLES],
  [ReasonType.THIRD_PARTY_PAYMENT]: [Relation.ORIGINATES, Relation.SETTLES],
  [ReasonType.TAX_PAYMENT]: [Relation.SETTLES],

  // Governança — corrections fully reverse or partially adjust a prior entry
  [ReasonType.MANUAL_CORRECTION]: [Relation.REVERSES, Relation.ADJUSTS],
  [ReasonType.DATA_RECONCILIATION]: [Relation.REVERSES, Relation.ADJUSTS],

  // LATE_AWARENESS and UNKNOWN_ORIGIN are intentionally absent:
  // they can accompany any relation depending on what is being documented.
};
