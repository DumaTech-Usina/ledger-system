import { CreateLedgerEventCommand } from "../../../../../core/application/dtos/CreateLedgerEventInput";
import { ConfidenceLevel } from "../../../../../core/domain/enums/ConfidenceLevel";
import { Direction } from "../../../../../core/domain/enums/Direction";
import { EconomicEffect } from "../../../../../core/domain/enums/EconomicEffect";
import { EventType } from "../../../../../core/domain/enums/EventType";
import { ObjectType } from "../../../../../core/domain/enums/ObjectType";
import { PartyRole } from "../../../../../core/domain/enums/PartyRole";
import { ReasonType } from "../../../../../core/domain/enums/ReasonType";
import { Relation } from "../../../../../core/domain/enums/Relation";
import { BROKER, TAX_AUTH, USINA, reporter } from "../parties";

export const commissionReceived = (
  ref: (label: string) => string,
  objectId: string,
  amount = "1000.00",
): CreateLedgerEventCommand => ({
  eventType: EventType.COMMISSION_RECEIVED,
  economicEffect: EconomicEffect.CASH_IN,
  occurredAt: new Date("2025-03-01"),
  amount,
  currency: "BRL",
  sourceSystem: "normalizer",
  sourceReference: ref("com-recv"),
  normalizationVersion: "1.0",
  normalizationWorkerId: "worker-test",
  parties: [
    { partyId: USINA,  role: PartyRole.PAYEE,        direction: Direction.IN,      amount },
    { partyId: BROKER, role: PartyRole.BENEFICIARY,  direction: Direction.NEUTRAL, amount },
  ],
  objects: [{ objectId, objectType: ObjectType.COMMISSION_RECEIVABLE, relation: Relation.SETTLES }],
  reason: {
    type: ReasonType.COMMISSION_PAYMENT,
    description: "commission received",
    confidence: ConfidenceLevel.MEDIUM,
    requiresFollowup: false,
  },
  reporter: reporter(),
});

export const commissionSplit = (
  ref: (label: string) => string,
  objectId: string,
  amount = "700.00",
): CreateLedgerEventCommand => ({
  eventType: EventType.COMMISSION_SPLIT,
  economicEffect: EconomicEffect.CASH_OUT,
  occurredAt: new Date("2025-03-02"),
  amount,
  currency: "BRL",
  sourceSystem: "normalizer",
  sourceReference: ref("com-split"),
  normalizationVersion: "1.0",
  normalizationWorkerId: "worker-test",
  parties: [
    { partyId: USINA,    role: PartyRole.PAYER, direction: Direction.OUT,     amount },
    { partyId: BROKER,   role: PartyRole.PAYEE, direction: Direction.NEUTRAL, amount: "560.00" },
    { partyId: TAX_AUTH, role: PartyRole.PAYEE, direction: Direction.NEUTRAL, amount: "140.00" },
  ],
  objects: [{ objectId, objectType: ObjectType.COMMISSION_PAYABLE, relation: Relation.SETTLES }],
  reason: {
    type: ReasonType.COMMISSION_SPLIT,
    description: "split 80% broker / 20% taxes",
    confidence: ConfidenceLevel.HIGH,
    requiresFollowup: false,
  },
  reporter: reporter(),
});

export const commissionWaiver = (
  ref: (label: string) => string,
  objectId: string,
): CreateLedgerEventCommand => ({
  eventType: EventType.COMMISSION_WAIVER,
  economicEffect: EconomicEffect.NON_CASH,
  occurredAt: new Date("2025-03-15"),
  amount: "500.00",
  currency: "BRL",
  sourceSystem: "manual-import",
  sourceReference: ref("waiver"),
  normalizationVersion: "1.0",
  normalizationWorkerId: "worker-test",
  parties: [{ partyId: BROKER, role: PartyRole.BENEFICIARY, direction: Direction.NEUTRAL }],
  objects: [{ objectId, objectType: ObjectType.COMMISSION_ENTITLEMENT, relation: Relation.SETTLES }],
  reason: {
    type: ReasonType.COMMISSION_WAIVER,
    description: "waiver granted by commercial agreement",
    confidence: ConfidenceLevel.HIGH,
    requiresFollowup: false,
  },
  reporter: reporter(),
});

export const directPaymentAcknowledged = (
  ref: (label: string) => string,
  objectId: string,
  objectType: ObjectType,
  reason: ReasonType,
  confidence: ConfidenceLevel,
  description: string,
  amount = "1000.00",
): CreateLedgerEventCommand => ({
  eventType: EventType.DIRECT_PAYMENT_ACKNOWLEDGED,
  economicEffect: EconomicEffect.NON_CASH,
  occurredAt: new Date("2025-03-10"),
  amount,
  currency: "BRL",
  sourceSystem: "manual-import",
  sourceReference: ref("direct-pay"),
  normalizationVersion: "1.0",
  normalizationWorkerId: "worker-test",
  parties: [{ partyId: BROKER, role: PartyRole.BENEFICIARY, direction: Direction.NEUTRAL }],
  objects: [{ objectId, objectType, relation: Relation.SETTLES }],
  reason: { type: reason, description, confidence, requiresFollowup: false },
  reporter: reporter(),
});
