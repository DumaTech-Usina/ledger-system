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

export const loanOrigination = (
  ref: (label: string) => string,
  objectId: string,
  amount = "2000.00",
): CreateLedgerEventCommand => ({
  eventType: EventType.LOAN_ORIGINATION,
  economicEffect: EconomicEffect.CASH_OUT,
  occurredAt: new Date("2025-02-01"),
  amount,
  currency: "BRL",
  sourceSystem: "normalizer",
  sourceReference: ref("loan-orig"),
  normalizationVersion: "1.0",
  normalizationWorkerId: "worker-test",
  parties: [
    { partyId: USINA,  role: PartyRole.PAYER, direction: Direction.OUT,     amount },
    { partyId: BROKER, role: PartyRole.PAYEE, direction: Direction.NEUTRAL, amount },
  ],
  objects: [{ objectId, objectType: ObjectType.LOAN, relation: Relation.ORIGINATES }],
  reason: {
    type: ReasonType.LOAN_ORIGINATION,
    description: "loan to broker",
    confidence: ConfidenceLevel.HIGH,
    requiresFollowup: false,
  },
  reporter: reporter(),
});

export const loanRepayment = (
  ref: (label: string) => string,
  objectId: string,
  relatedEventId: string,
  economicEffect: EconomicEffect,
  relation: Relation,
  reasonType: ReasonType,
  amount: string,
): CreateLedgerEventCommand => {
  const isCashIn = economicEffect === EconomicEffect.CASH_IN;
  return {
    eventType: EventType.LOAN_REPAYMENT,
    economicEffect,
    occurredAt: new Date("2025-05-01"),
    amount,
    currency: "BRL",
    sourceSystem: "normalizer",
    sourceReference: ref("loan-repay"),
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
    objects: [{ objectId, objectType: ObjectType.LOAN, relation }],
    reason: {
      type: reasonType,
      description: "loan repayment",
      confidence: ConfidenceLevel.MEDIUM,
      requiresFollowup: false,
    },
    reporter: reporter(),
  };
};
