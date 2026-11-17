import { CreateLedgerEventCommand } from "../../../../../core/application/dtos/CreateLedgerEventInput";
import { ConfidenceLevel } from "../../../../../core/domain/enums/ConfidenceLevel";
import { Direction } from "../../../../../core/domain/enums/Direction";
import { EconomicEffect } from "../../../../../core/domain/enums/EconomicEffect";
import { EventType } from "../../../../../core/domain/enums/EventType";
import { ObjectType } from "../../../../../core/domain/enums/ObjectType";
import { PartyRole } from "../../../../../core/domain/enums/PartyRole";
import { ReasonType } from "../../../../../core/domain/enums/ReasonType";
import { Relation } from "../../../../../core/domain/enums/Relation";
import { USINA, reporter } from "../parties";

/** An institution cited by a cash fact; on a transfer, as where the money left from or arrived in. */
export const institution = (key: string, relation = Relation.REFERENCES) => ({
  objectId: `instituicao:${key}`,
  objectType: ObjectType.CASH_ACCOUNT,
  relation,
});

const base = (ref: (label: string) => string, label: string, amount: string, occurredAt: Date) => ({
  amount,
  currency: "BRL",
  occurredAt,
  sourceSystem: "treasury",
  sourceReference: ref(label),
  normalizationVersion: "1.0",
  normalizationWorkerId: "worker-test",
  reporter: reporter(),
});

/** What `key`'s statement showed at the end of the day (REQ-670). A "-" amount is an overdrawn account. */
export const openingBalance = (ref: (label: string) => string, key: string, amount: string, occurredAt: Date): CreateLedgerEventCommand => {
  const overdrawn = amount.startsWith("-");
  const abs = overdrawn ? amount.slice(1) : amount;
  return {
    ...base(ref, "opening", abs, occurredAt),
    eventType: EventType.OPENING_BALANCE,
    economicEffect: overdrawn ? EconomicEffect.CASH_OUT : EconomicEffect.CASH_IN,
    parties: [
      overdrawn
        ? { partyId: USINA, role: PartyRole.PAYER, direction: Direction.OUT, amount: abs }
        : { partyId: USINA, role: PartyRole.PAYEE, direction: Direction.IN, amount: abs },
    ],
    objects: [institution(key)],
    reason: { type: ReasonType.OPENING_BALANCE, description: "statement balance", confidence: ConfidenceLevel.HIGH, requiresFollowup: false },
  };
};

/** Money moved from `from` to `to` (REQ-672): one fact, balanced, naming both. */
export const institutionTransfer = (
  ref: (label: string) => string,
  from: string,
  to: string,
  amount: string,
  occurredAt: Date,
  objects: CreateLedgerEventCommand["objects"] = [institution(from, Relation.TRANSFERS_FROM), institution(to, Relation.TRANSFERS_TO)],
): CreateLedgerEventCommand => ({
  ...base(ref, "transfer", amount, occurredAt),
  eventType: EventType.INSTITUTION_TRANSFER,
  economicEffect: EconomicEffect.CASH_INTERNAL,
  parties: [
    { partyId: USINA, role: PartyRole.PAYER, direction: Direction.OUT, amount },
    { partyId: USINA, role: PartyRole.PAYEE, direction: Direction.IN, amount },
  ],
  objects,
  reason: { type: ReasonType.INSTITUTION_TRANSFER, description: "between institutions", confidence: ConfidenceLevel.HIGH, requiresFollowup: false },
});
