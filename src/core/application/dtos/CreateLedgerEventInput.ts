import { EconomicEffect } from "../../domain/enums/EconomicEffect";
import { EventType } from "../../domain/enums/EventType";
import { PartyRole } from "../../domain/enums/PartyRole";
import { Direction } from "../../domain/enums/Direction";
import { ObjectType } from "../../domain/enums/ObjectType";
import { Relation } from "../../domain/enums/Relation";
import { ReasonType } from "../../domain/enums/ReasonType";
import { ConfidenceLevel } from "../../domain/enums/ConfidenceLevel";
import { ReporterType } from "../../domain/enums/ReporterType";

export interface CreateLedgerEventCommand {
  eventType: EventType;
  economicEffect: EconomicEffect;

  occurredAt: Date;
  sourceAt?: Date | null;

  amount: string;
  currency: string;

  description?: string | null;

  sourceSystem: string;
  sourceReference: string;

  normalizationVersion: string;
  normalizationWorkerId: string;

  previousHash?: string | null;

  /** Caller-supplied idempotency key. If provided and an event with this commandId already
   *  exists in the ledger, the existing event is returned without creating a duplicate. */
  commandId?: string | null;

  parties: {
    partyId: string;
    role: PartyRole;
    direction: Direction;
    amount?: string;
  }[];

  objects: {
    objectId: string;
    objectType: ObjectType;
    relation: Relation;
  }[];

  reason?: {
    type: ReasonType;
    description: string;
    confidence: ConfidenceLevel;
    requiresFollowup: boolean;
  };

  reporter: {
    reporterType: ReporterType;
    reporterId: string;
    reporterName?: string | null;
    channel: string;
  };
}
