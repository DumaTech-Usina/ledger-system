import { ConfidenceLevel } from "../enums/ConfidenceLevel";
import { EconomicEffect } from "../enums/EconomicEffect";
import { EventType } from "../enums/EventType";
import { ObjectType } from "../enums/ObjectType";
import { ReasonType } from "../enums/ReasonType";
import { Relation } from "../enums/Relation";
import { EventSemanticContract } from "./EventSemanticContract";

export const EVENT_CONTRACTS: Record<EventType, EventSemanticContract> = {
  [EventType.COMMISSION_SPLIT]: {
    // CASH_OUT when distributing to brokers/partners; CASH_INTERNAL for intra-Usina reallocation
    economicEffects: [EconomicEffect.CASH_OUT, EconomicEffect.CASH_INTERNAL],

    objects: [
      {
        objectType: ObjectType.COMMISSION_POOL,
        relations: [Relation.ADJUSTS, Relation.SETTLES],
      },
      {
        objectType: ObjectType.COMMISSION_PAYABLE,
        relations: [Relation.ORIGINATES, Relation.SETTLES],
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
        // SETTLES for a standard waiver; REVERSES for reversing an incorrectly granted entitlement
        relations: [Relation.SETTLES, Relation.REVERSES],
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

  /**
   * Settles, partially recovers, recognizes loss on, or renegotiates an advance.
   * relatedEventId must point to the originating ADVANCE_PAYMENT event.
   */
  [EventType.ADVANCE_SETTLEMENT]: {
    economicEffects: [EconomicEffect.CASH_IN, EconomicEffect.NON_CASH],

    objects: [
      {
        objectType: ObjectType.ADVANCE,
        relations: [Relation.SETTLES, Relation.ADJUSTS],
      },
    ],

    reasons: [
      ReasonType.ADVANCE_PAYMENT, // full or partial recovery
      ReasonType.LOSS_RECOGNITION, // realized loss on unrecovered advance
      ReasonType.DEBT_RESTRUCTURING, // renegotiation / deferral
    ],

    requiresRelatedEventId: true,
    allowedOriginTypes: [EventType.ADVANCE_PAYMENT],
  },

  /** Usina disburses a loan to a broker. Creates a LOAN receivable in the ledger. */
  [EventType.LOAN_ORIGINATION]: {
    economicEffects: [EconomicEffect.CASH_OUT],

    objects: [
      { objectType: ObjectType.LOAN, relations: [Relation.ORIGINATES] },
    ],

    reasons: [ReasonType.LOAN_ORIGINATION],
  },

  /**
   * Broker repays a loan (via cash or commission deduction).
   * relatedEventId must point to the originating LOAN_ORIGINATION event.
   */
  [EventType.LOAN_REPAYMENT]: {
    economicEffects: [EconomicEffect.CASH_IN, EconomicEffect.NON_CASH],

    objects: [
      {
        objectType: ObjectType.LOAN,
        relations: [Relation.SETTLES, Relation.ADJUSTS],
      },
    ],

    reasons: [
      ReasonType.LOAN_REPAYMENT,
      ReasonType.LOAN_REPAYMENT_VIA_COMMISSION,
      ReasonType.DEBT_RESTRUCTURING,
    ],

    requiresRelatedEventId: true,
    allowedOriginTypes: [EventType.LOAN_ORIGINATION],
  },

  /**
   * Operator paid a broker directly, bypassing Usina.
   * Usina records the settlement of its commission receivable even though no cash arrived.
   * This is always NON_CASH from Usina's perspective.
   */
  [EventType.DIRECT_PAYMENT_ACKNOWLEDGED]: {
    economicEffects: [EconomicEffect.NON_CASH],

    objects: [
      {
        objectType: ObjectType.COMMISSION_RECEIVABLE,
        relations: [Relation.SETTLES],
      },
      {
        objectType: ObjectType.COMMISSION_ENTITLEMENT,
        relations: [Relation.SETTLES],
      },
    ],

    reasons: [
      ReasonType.LATE_AWARENESS,
      ReasonType.DIRECT_COMMISSION_PAYMENT_AUTHORIZED,
    ],
  },

  /** Usina pays an incentive, bonus, or campaign reward to a broker or partner. */
  [EventType.INCENTIVE_PAYMENT]: {
    economicEffects: [EconomicEffect.CASH_OUT, EconomicEffect.NON_CASH],

    objects: [
      {
        objectType: ObjectType.INCENTIVE,
        relations: [Relation.ORIGINATES, Relation.SETTLES],
      },
      {
        objectType: ObjectType.BONUS,
        relations: [Relation.ORIGINATES, Relation.SETTLES],
      },
    ],

    reasons: [ReasonType.INCENTIVE_PAYMENT],
  },

  /**
   * Corrects any previously registered event.
   *
   * Rules:
   * - NON_CASH only: the correction is a bookkeeping entry; cash adjustments
   *   caused by the error are separate domain events.
   * - previousHash mandatory: must link to the event being corrected.
   * - HIGH confidence mandatory: corrections must be certain.
   * - REVERSES cancels the original entirely; ADJUSTS records a partial fix.
   *
   * Note: `objects` here is informational — enforcement of object-type matching
   * against the original event is a future step.
   */
  [EventType.LEDGER_CORRECTION]: {
    economicEffects: [EconomicEffect.NON_CASH],

    objects: [
      {
        objectType: ObjectType.COMMISSION_RECEIVABLE,
        relations: [Relation.REVERSES, Relation.ADJUSTS],
      },
      {
        objectType: ObjectType.COMMISSION_PAYABLE,
        relations: [Relation.REVERSES, Relation.ADJUSTS],
      },
      {
        objectType: ObjectType.COMMISSION_ENTITLEMENT,
        relations: [Relation.REVERSES, Relation.ADJUSTS],
      },
      {
        objectType: ObjectType.COMMISSION_POOL,
        relations: [Relation.REVERSES, Relation.ADJUSTS],
      },
      {
        objectType: ObjectType.LOAN,
        relations: [Relation.REVERSES, Relation.ADJUSTS],
      },
      {
        objectType: ObjectType.ADVANCE,
        relations: [Relation.REVERSES, Relation.ADJUSTS],
      },
      {
        objectType: ObjectType.RECEIVABLE,
        relations: [Relation.REVERSES, Relation.ADJUSTS],
      },
      {
        objectType: ObjectType.PAYABLE,
        relations: [Relation.REVERSES, Relation.ADJUSTS],
      },
      {
        objectType: ObjectType.PENALTY,
        relations: [Relation.REVERSES, Relation.ADJUSTS],
      },
      {
        objectType: ObjectType.CHARGEBACK,
        relations: [Relation.REVERSES, Relation.ADJUSTS],
      },
      {
        objectType: ObjectType.INCENTIVE,
        relations: [Relation.REVERSES, Relation.ADJUSTS],
      },
      {
        objectType: ObjectType.BONUS,
        relations: [Relation.REVERSES, Relation.ADJUSTS],
      },
      {
        objectType: ObjectType.PAYROLL,
        relations: [Relation.REVERSES, Relation.ADJUSTS],
      },
      {
        objectType: ObjectType.SERVICE_FEE,
        relations: [Relation.REVERSES, Relation.ADJUSTS],
      },
      {
        objectType: ObjectType.INFRASTRUCTURE_COST,
        relations: [Relation.REVERSES, Relation.ADJUSTS],
      },
      {
        objectType: ObjectType.TAX,
        relations: [Relation.REVERSES, Relation.ADJUSTS],
      },
    ],

    reasons: [
      ReasonType.MANUAL_CORRECTION,
      ReasonType.DATA_RECONCILIATION,
      ReasonType.LATE_AWARENESS,
    ],

    minConfidence: ConfidenceLevel.HIGH,
    requiresPreviousHash: true,
  },

  /**
   * Accrual entry: records the amount Usina expects to receive for a commission
   * before the cash actually arrives. Establishes the baseline so that a later
   * commission_received can be compared and a discrepancy (or over-settlement)
   * detected via PositionProjectionService.
   */
  [EventType.COMMISSION_EXPECTED]: {
    economicEffects: [EconomicEffect.NON_CASH],

    objects: [
      {
        objectType: ObjectType.COMMISSION_RECEIVABLE,
        relations: [Relation.ORIGINATES],
      },
    ],

    reasons: [ReasonType.COMMISSION_PAYMENT, ReasonType.LATE_IDENTIFIED_COMMISSION],
    minConfidence: ConfidenceLevel.MEDIUM,
  },
};
