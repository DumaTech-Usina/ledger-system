import { EconomicEffect } from "../../domain/enums/EconomicEffect";
import { EventType } from "../../domain/enums/EventType";
import { Relation } from "../../domain/enums/Relation";

/**
 * A fact that moved the usina's money, with the institutions it cites (treasury REQ-673). The read
 * the balance per institution is folded from: standing facts only, a retracted one never happened.
 */
export interface InstitutionCashEvent {
  eventId: string;
  eventType: EventType;
  economicEffect: EconomicEffect;
  amountUnits: bigint;
  currency: string;
  occurredAt: Date;
  recordedAt: Date;
  /** The cash_account objects it cites, with how: REFERENCES, TRANSFERS_FROM or TRANSFERS_TO. */
  institutions: { objectId: string; relation: Relation }[];
}
