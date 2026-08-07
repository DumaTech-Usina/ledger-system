import { CreateLedgerEventCommand } from "../../../../../core/application/dtos/CreateLedgerEventInput";
import { ConfidenceLevel } from "../../../../../core/domain/enums/ConfidenceLevel";
import { Direction } from "../../../../../core/domain/enums/Direction";
import { EconomicEffect } from "../../../../../core/domain/enums/EconomicEffect";
import { EventType } from "../../../../../core/domain/enums/EventType";
import { ObjectType } from "../../../../../core/domain/enums/ObjectType";
import { PartyRole } from "../../../../../core/domain/enums/PartyRole";
import { ReasonType } from "../../../../../core/domain/enums/ReasonType";
import { Relation } from "../../../../../core/domain/enums/Relation";
import { SUPPLIER, USINA, reporter } from "../parties";

/**
 * Ratified tuples for the obligation lifecycle — must not change without revisiting the contracts.
 *
 *   recognition: obligation_recognized · non_cash  · payroll/originates · obligation_recognition
 *   payment:     payroll_payment       · cash_out  · payroll/settles    · payroll_payment
 *
 * The recognition carries no relatedEventId: a fact's validity never depends on its lineage, and
 * the payment may legitimately precede it.
 */

export const obligationRecognized = (
  ref: (label: string) => string,
  objectId: string,
  amount: string,
  overrides: Partial<CreateLedgerEventCommand> = {},
): CreateLedgerEventCommand => ({
  eventType: EventType.OBLIGATION_RECOGNIZED,
  economicEffect: EconomicEffect.NON_CASH,
  occurredAt: new Date("2025-03-25"),
  amount,
  currency: "BRL",
  sourceSystem: "normalizer",
  sourceReference: ref("recognition"),
  normalizationVersion: "1.0",
  normalizationWorkerId: "worker-test",
  // NON_CASH: no leg may carry a direction, exactly as COMMISSION_EXPECTED declares its own.
  // The obligation names who it is owed to; the money moves only when the payment is recorded.
  parties: [
    { partyId: USINA,    role: PartyRole.PAYER, direction: Direction.NEUTRAL },
    { partyId: SUPPLIER, role: PartyRole.PAYEE, direction: Direction.NEUTRAL },
  ],
  objects: [{ objectId, objectType: ObjectType.PAYROLL, relation: Relation.ORIGINATES }],
  reason: {
    type: ReasonType.OBLIGATION_RECOGNITION,
    description: "March 2025 payroll closed",
    confidence: ConfidenceLevel.HIGH,
    requiresFollowup: false,
  },
  reporter: reporter(),
  ...overrides,
});

export const payrollPayment = (
  ref: (label: string) => string,
  objectId: string,
  amount: string,
  overrides: Partial<CreateLedgerEventCommand> = {},
): CreateLedgerEventCommand => ({
  eventType: EventType.PAYROLL_PAYMENT,
  economicEffect: EconomicEffect.CASH_OUT,
  occurredAt: new Date("2025-03-31"),
  amount,
  currency: "BRL",
  sourceSystem: "normalizer",
  sourceReference: ref("payroll"),
  normalizationVersion: "1.0",
  normalizationWorkerId: "worker-test",
  parties: [{ partyId: USINA, role: PartyRole.PAYER, direction: Direction.OUT, amount }],
  objects: [{ objectId, objectType: ObjectType.PAYROLL, relation: Relation.SETTLES }],
  reason: {
    type: ReasonType.PAYROLL_PAYMENT,
    description: "March 2025 payroll paid",
    confidence: ConfidenceLevel.HIGH,
    requiresFollowup: false,
  },
  reporter: reporter(),
  ...overrides,
});

/** Retracts any event on a PAYROLL position — the correction path for a mis-stated recognition. */
export const retractPayroll = (
  ref: (label: string) => string,
  objectId: string,
  relatedEventId: string,
  amount: string,
): CreateLedgerEventCommand => ({
  eventType: EventType.LEDGER_CORRECTION,
  economicEffect: EconomicEffect.NON_CASH,
  occurredAt: new Date("2025-04-20"),
  amount,
  currency: "BRL",
  sourceSystem: "manual-import",
  sourceReference: ref("retraction"),
  normalizationVersion: "1.0",
  normalizationWorkerId: "worker-test",
  relatedEventId,
  parties: [{ partyId: USINA, role: PartyRole.PLATFORM, direction: Direction.NEUTRAL }],
  objects: [{ objectId, objectType: ObjectType.PAYROLL, relation: Relation.RETRACTS }],
  reason: {
    type: ReasonType.DATA_RECONCILIATION,
    description: "verified against the source: this entry never happened",
    confidence: ConfidenceLevel.HIGH,
    requiresFollowup: false,
  },
  reporter: reporter(),
});
