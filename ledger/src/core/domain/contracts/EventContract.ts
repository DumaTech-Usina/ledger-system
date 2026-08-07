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

  /**
   * Cash (or directly-acknowledged) settlement of a commission receivable. Normally a received
   * SETTLES a receivable that a COMMISSION_EXPECTED originated, and relatedEventId points to that
   * originating COMMISSION_EXPECTED — the commission's "ignition point" — preserving causality
   * and CFO-level traceability.
   *
   * Orphan exception: a received whose origin the ledger has no evidence for (e.g. a receipt first
   * seen already discharged, with no ABERTA leg ever emitted) is still a valid fact. It may be
   * recorded with relatedEventId = null only when it explicitly declares its lineage unresolved —
   * reason UNKNOWN_ORIGIN with requiresFollowup = true (enforced in InvariantPolicy step 10). Its
   * lineage is established later by a new fact, never by fabricating an origin here.
   */
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
      ReasonType.UNKNOWN_ORIGIN, // orphan: lineage unresolved, requiresFollowup (see InvariantPolicy step 10)
    ],
    minConfidence: ConfidenceLevel.MEDIUM,
    requiresRelatedEventId: true,
    allowedOriginTypes: [EventType.COMMISSION_EXPECTED],
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
   * Generic cash-basis outbound payment. SETTLES a PAYABLE (an amount owed); the counterparty is a
   * Party and the business intent is the Reason. Reusable for types unhandled by the algebra.
   */
  [EventType.OUTBOUND_PAYMENT]: {
    economicEffects: [EconomicEffect.CASH_OUT],

    objects: [
      {
        objectType: ObjectType.PAYABLE,
        relations: [Relation.SETTLES],
      },
    ],

    reasons: [ReasonType.ORDINARY_SETTLEMENT],
    minConfidence: ConfidenceLevel.MEDIUM,
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
   * - RETRACTS declares that the event named by relatedEventId never corresponded to the world:
   *   it names the position only to say WHERE the retracted assertion lived, and moves nothing.
   *
   * Note: `objects` here is informational — enforcement of object-type matching
   * against the original event is a future step.
   */
  [EventType.LEDGER_CORRECTION]: {
    economicEffects: [EconomicEffect.NON_CASH],

    objects: [
      {
        objectType: ObjectType.COMMISSION_RECEIVABLE,
        relations: [Relation.REVERSES, Relation.ADJUSTS, Relation.RETRACTS],
      },
      {
        objectType: ObjectType.COMMISSION_PAYABLE,
        relations: [Relation.REVERSES, Relation.ADJUSTS, Relation.RETRACTS],
      },
      {
        objectType: ObjectType.COMMISSION_ENTITLEMENT,
        relations: [Relation.REVERSES, Relation.ADJUSTS, Relation.RETRACTS],
      },
      {
        objectType: ObjectType.COMMISSION_POOL,
        relations: [Relation.REVERSES, Relation.ADJUSTS, Relation.RETRACTS],
      },
      {
        objectType: ObjectType.LOAN,
        relations: [Relation.REVERSES, Relation.ADJUSTS, Relation.RETRACTS],
      },
      {
        objectType: ObjectType.ADVANCE,
        relations: [Relation.REVERSES, Relation.ADJUSTS, Relation.RETRACTS],
      },
      {
        objectType: ObjectType.RECEIVABLE,
        relations: [Relation.REVERSES, Relation.ADJUSTS, Relation.RETRACTS],
      },
      {
        objectType: ObjectType.PAYABLE,
        relations: [Relation.REVERSES, Relation.ADJUSTS, Relation.RETRACTS],
      },
      {
        objectType: ObjectType.PENALTY,
        relations: [Relation.REVERSES, Relation.ADJUSTS, Relation.RETRACTS],
      },
      {
        objectType: ObjectType.CHARGEBACK,
        relations: [Relation.REVERSES, Relation.ADJUSTS, Relation.RETRACTS],
      },
      {
        objectType: ObjectType.INCENTIVE,
        relations: [Relation.REVERSES, Relation.ADJUSTS, Relation.RETRACTS],
      },
      {
        objectType: ObjectType.BONUS,
        relations: [Relation.REVERSES, Relation.ADJUSTS, Relation.RETRACTS],
      },
      {
        objectType: ObjectType.PAYROLL,
        relations: [Relation.REVERSES, Relation.ADJUSTS, Relation.RETRACTS],
      },
      {
        objectType: ObjectType.SERVICE_FEE,
        relations: [Relation.REVERSES, Relation.ADJUSTS, Relation.RETRACTS],
      },
      {
        objectType: ObjectType.INFRASTRUCTURE_COST,
        relations: [Relation.REVERSES, Relation.ADJUSTS, Relation.RETRACTS],
      },
      {
        objectType: ObjectType.TAX,
        relations: [Relation.REVERSES, Relation.ADJUSTS, Relation.RETRACTS],
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

    reasons: [
      ReasonType.COMMISSION_ACCRUAL, // default for a normal/synthesized accrual
      ReasonType.COMMISSION_PAYMENT,
      ReasonType.LATE_IDENTIFIED_COMMISSION, // reserved for genuinely late-identified cases
    ],
    minConfidence: ConfidenceLevel.MEDIUM,
  },

  /**
   * Recognition entry: records an obligation the usina owes, established by an external fact — an
   * invoice issued against it, a payroll closed, a tax assessed. The outbound twin of
   * COMMISSION_EXPECTED: NON_CASH, ORIGINATES only, and it sets the baseline a later payment is
   * measured against.
   *
   * Which kind of obligation it is rides on the objectType, not on the event type — the economics
   * are identical across them, only the position differs.
   *
   * No relatedEventId requirement, by premise: a fact's validity never depends on its lineage. The
   * payment that settles the obligation may arrive before OR after this recognition, and both
   * orders derive to the same position, because the fold reads sums and never order. When the
   * recognition is the later of the two, LATE_AWARENESS is the honest reason.
   *
   * ADJUSTS is deliberately absent: a recognition stated at the wrong amount is corrected by
   * RETRACTS plus a new recognition, which leaves both the error and its correction on the record.
   */
  [EventType.OBLIGATION_RECOGNIZED]: {
    economicEffects: [EconomicEffect.NON_CASH],

    objects: [
      { objectType: ObjectType.PAYROLL,             relations: [Relation.ORIGINATES] },
      { objectType: ObjectType.SERVICE_FEE,         relations: [Relation.ORIGINATES] },
      { objectType: ObjectType.INFRASTRUCTURE_COST, relations: [Relation.ORIGINATES] },
      { objectType: ObjectType.TAX,                 relations: [Relation.ORIGINATES] },
      { objectType: ObjectType.PAYABLE,             relations: [Relation.ORIGINATES] },
    ],

    reasons: [
      ReasonType.OBLIGATION_RECOGNITION, // the obligation was established by an external fact
      ReasonType.LATE_AWARENESS,         // ...and only came to be known after it was already paid
    ],
    minConfidence: ConfidenceLevel.MEDIUM,
  },
};
