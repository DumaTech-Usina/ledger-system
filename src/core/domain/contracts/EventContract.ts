import { ConfidenceLevel } from "../enums/ConfidenceLevel";
import { EconomicEffect } from "../enums/EconomicEffect";
import { EventType } from "../enums/EventType";
import { ObjectType } from "../enums/ObjectType";
import { ReasonType } from "../enums/ReasonType";
import { Relation } from "../enums/Relation";
import { EventSemanticContract } from "./EventSemanticContract";

export const EVENT_CONTRACTS: Record<EventType, EventSemanticContract> = {
  [EventType.COMMISSION_SPLIT]: {
    economicEffects: [EconomicEffect.CASH_INTERNAL],

    objects: [
      {
        objectType: ObjectType.COMMISSION_POOL,
        relations: [Relation.ADJUSTS],
      },
    ],

    reasons: [ReasonType.COMMISSION_SPLIT],
  },

  [EventType.PAYROLL_PAYMENT]: {
    economicEffects: [EconomicEffect.CASH_OUT],

    objects: [
      {
        objectType: ObjectType.PAYROLL,
        relations: [Relation.SETTLES],
      },
    ],

    reasons: [ReasonType.PAYROLL_PAYMENT],
    minConfidence: ConfidenceLevel.MEDIUM,
  },

  [EventType.COMMISSION_RECEIVED]: {
    economicEffects: [EconomicEffect.CASH_IN],

    objects: [
      {
        objectType: ObjectType.COMMISSION_RECEIVABLE,
        relations: [Relation.SETTLES],
      },
    ],

    reasons: [
      ReasonType.COMMISSION_PAYMENT,
      ReasonType.DIRECT_COMMISSION_PAYMENT_AUTHORIZED,
    ],
    minConfidence: ConfidenceLevel.MEDIUM,
  },

  [EventType.COMMISSION_WAIVER]: {
    economicEffects: [EconomicEffect.NON_CASH],

    objects: [
      {
        objectType: ObjectType.COMMISSION_ENTITLEMENT,
        relations: [Relation.SETTLES],
      },
    ],

    reasons: [ReasonType.COMMISSION_WAIVER],
  },

  [EventType.PENALTY_PAYMENT]: {
    economicEffects: [EconomicEffect.CASH_OUT],

    objects: [
      {
        objectType: ObjectType.PENALTY,
        relations: [Relation.SETTLES],
      },
    ],

    reasons: [ReasonType.PENALTY_PAYMENT],
  },

  [EventType.ADVANCE_PAYMENT]: {
    economicEffects: [EconomicEffect.CASH_OUT, EconomicEffect.NON_CASH],

    objects: [
      {
        objectType: ObjectType.ADVANCE,
        relations: [Relation.ORIGINATES, Relation.ADJUSTS, Relation.SETTLES],
      },
    ],

    reasons: [ReasonType.ADVANCE_PAYMENT],
  },

  [EventType.INFRASTRUCTURE_EXPENSE]: {
    economicEffects: [EconomicEffect.CASH_OUT],

    objects: [
      {
        objectType: ObjectType.INFRASTRUCTURE_COST,
        relations: [Relation.SETTLES],
      },
    ],

    reasons: [ReasonType.INFRASTRUCTURE_EXPENSE],
  },
};
