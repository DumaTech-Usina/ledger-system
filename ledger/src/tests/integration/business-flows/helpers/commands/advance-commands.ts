import { CreateLedgerEventCommand } from "../../../../../core/application/dtos/CreateLedgerEventInput";
import { ConfidenceLevel } from "../../../../../core/domain/enums/ConfidenceLevel";
import { Direction } from "../../../../../core/domain/enums/Direction";
import { EconomicEffect } from "../../../../../core/domain/enums/EconomicEffect";
import { EventType } from "../../../../../core/domain/enums/EventType";
import { ObjectType } from "../../../../../core/domain/enums/ObjectType";
import { PartyRole } from "../../../../../core/domain/enums/PartyRole";
import { ReasonType } from "../../../../../core/domain/enums/ReasonType";
import { Relation } from "../../../../../core/domain/enums/Relation";
import { BROKER, USINA, reporter } from "../parties";

export const advancePayment = (
  ref: (label: string) => string,
  objectId: string,
  amount = "500.00",
  extraObjects: CreateLedgerEventCommand["objects"] = [],
): CreateLedgerEventCommand => ({
  eventType: EventType.ADVANCE_PAYMENT,
  economicEffect: EconomicEffect.CASH_OUT,
  occurredAt: new Date("2025-03-05"),
  amount,
  currency: "BRL",
  sourceSystem: "normalizer",
  sourceReference: ref("adv-pay"),
  normalizationVersion: "1.0",
  normalizationWorkerId: "worker-test",
  parties: [
    { partyId: USINA,  role: PartyRole.PAYER, direction: Direction.OUT,     amount },
    { partyId: BROKER, role: PartyRole.PAYEE, direction: Direction.NEUTRAL, amount },
  ],
  objects: [
    { objectId, objectType: ObjectType.ADVANCE, relation: Relation.ORIGINATES },
    ...extraObjects,
  ],
  reason: {
    type: ReasonType.ADVANCE_PAYMENT,
    description: "advance on future commission",
    confidence: ConfidenceLevel.HIGH,
    requiresFollowup: false,
  },
  reporter: reporter(),
});

export const advanceSettlement = (
  ref: (label: string) => string,
  objectId: string,
  relatedEventId: string,
  relation: Relation,
  economicEffect: EconomicEffect,
  amount: string,
  reasonType: ReasonType,
): CreateLedgerEventCommand => {
  const isCashIn = economicEffect === EconomicEffect.CASH_IN;
  return {
    eventType: EventType.ADVANCE_SETTLEMENT,
    economicEffect,
    occurredAt: new Date("2025-04-01"),
    amount,
    currency: "BRL",
    sourceSystem: "normalizer",
    sourceReference: ref("adv-settle"),
    normalizationVersion: "1.0",
    normalizationWorkerId: "worker-test",
    relatedEventId,
    parties: isCashIn
      ? [
          { partyId: USINA,  role: PartyRole.PAYEE, direction: Direction.IN,      amount },
          { partyId: BROKER, role: PartyRole.PAYER,  direction: Direction.NEUTRAL, amount },
        ]
      : [
          { partyId: BROKER, role: PartyRole.BENEFICIARY, direction: Direction.NEUTRAL },
        ],
    objects: [{ objectId, objectType: ObjectType.ADVANCE, relation }],
    reason: {
      type: reasonType,
      description: "advance settlement",
      confidence: ConfidenceLevel.MEDIUM,
      requiresFollowup: false,
    },
    reporter: reporter(),
  };
};
