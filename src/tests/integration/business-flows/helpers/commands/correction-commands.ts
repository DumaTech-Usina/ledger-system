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

export const ledgerCorrection = (
  ref: (label: string) => string,
  objectId: string,
  objectType: ObjectType,
  relation: Relation.REVERSES | Relation.ADJUSTS,
  reasonType: ReasonType.MANUAL_CORRECTION | ReasonType.DATA_RECONCILIATION,
): CreateLedgerEventCommand => ({
  eventType: EventType.LEDGER_CORRECTION,
  economicEffect: EconomicEffect.NON_CASH,
  occurredAt: new Date("2025-04-10"),
  amount: "1000.00",
  currency: "BRL",
  sourceSystem: "manual-import",
  sourceReference: ref("correction"),
  normalizationVersion: "1.0",
  normalizationWorkerId: "worker-test",
  parties: [{ partyId: USINA, role: PartyRole.PLATFORM, direction: Direction.NEUTRAL }],
  objects: [{ objectId, objectType, relation }],
  reason: {
    type: reasonType,
    description: "correction of erroneous entry",
    confidence: ConfidenceLevel.HIGH,
    requiresFollowup: false,
  },
  reporter: reporter(),
});
