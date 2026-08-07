import { ConfidenceLevel } from "../enums/ConfidenceLevel";
import { EconomicEffect } from "../enums/EconomicEffect";
import { EventType } from "../enums/EventType";
import { ObjectType } from "../enums/ObjectType";
import { ReasonType } from "../enums/ReasonType";
import { Relation } from "../enums/Relation";

export type EventSemanticContract = {
  economicEffects: readonly EconomicEffect[];

  objects: readonly {
    objectType: ObjectType;
    relations: readonly Relation[];
  }[];

  reasons?: readonly ReasonType[];

  minConfidence?: ConfidenceLevel;

  requiresPreviousHash?: boolean;

  /** When true, the event must carry a relatedEventId pointing to its originating event
   *  (e.g. an ADVANCE_SETTLEMENT must reference its ADVANCE_PAYMENT). */
  requiresRelatedEventId?: boolean;

  /** Restricts which EventType(s) the relatedEventId may point to.
   *  Prevents cross-product link confusion (e.g. loan repayment referencing an advance). */
  allowedOriginTypes?: readonly EventType[];

  /**
   * When true, this event type may carry a `dueAt` — the date the obligation it originates falls due,
   * as stated by the external fact that established it (an invoice's terms, a tax assessment).
   *
   * Absent means NOT admissible, so the exception is granted per contract rather than globally. Only
   * an event that ORIGINATES an obligation can carry one: a payment has no due date, the obligation
   * does. Admitting it is never requiring it — an obligation whose terms were not stated is recorded
   * with no due date at all, which is a known state, not a gap to fill.
   */
  admitsDueAt?: boolean;
};
