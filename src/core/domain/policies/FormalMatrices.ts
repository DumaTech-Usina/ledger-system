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

  [ObjectType.COMMISSION_POOL]: [Relation.ADJUSTS],

  [ObjectType.LOAN]: [Relation.ORIGINATES, Relation.ADJUSTS, Relation.SETTLES],

  [ObjectType.ADVANCE]: [
    Relation.ORIGINATES,
    Relation.ADJUSTS,
    Relation.SETTLES,
  ],

  [ObjectType.PENALTY]: [
    Relation.ORIGINATES,
    Relation.ADJUSTS,
    Relation.SETTLES,
  ],

  [ObjectType.CONTINGENT_CLAIM]: [Relation.ORIGINATES, Relation.ADJUSTS],

  [ObjectType.INCENTIVE]: [
    Relation.ORIGINATES,
    Relation.ADJUSTS,
    Relation.SETTLES,
  ],

  [ObjectType.CONTRACT]: [],
};

// ===============================
// reason_type × economic_effect
// ===============================

export const REASON_EFFECT_MATRIX: Partial<
  Record<ReasonType, readonly EconomicEffect[]>
> = {
  [ReasonType.COMMISSION_PAYMENT]: [EconomicEffect.CASH_IN],
  [ReasonType.DIRECT_COMMISSION_PAYMENT_AUTHORIZED]: [EconomicEffect.CASH_IN],
  [ReasonType.COMMISSION_SPLIT]: [EconomicEffect.CASH_INTERNAL],
  [ReasonType.LATE_IDENTIFIED_COMMISSION]: [EconomicEffect.NON_CASH],
  [ReasonType.COMMISSION_WAIVER]: [EconomicEffect.NON_CASH],
};

// ===============================
// reason_type × relation
// ===============================

export const REASON_RELATION_MATRIX: Partial<
  Record<ReasonType, readonly Relation[]>
> = {
  [ReasonType.LOAN_ORIGINATION]: [Relation.ORIGINATES],
  [ReasonType.LOAN_REPAYMENT]: [Relation.SETTLES],
  [ReasonType.LOAN_REPAYMENT_VIA_COMMISSION]: [Relation.SETTLES],
  [ReasonType.ADVANCE_PAYMENT]: [
    Relation.ORIGINATES,
    Relation.ADJUSTS,
    Relation.SETTLES,
  ],
  [ReasonType.DEBT_RESTRUCTURING]: [Relation.ADJUSTS],
};
