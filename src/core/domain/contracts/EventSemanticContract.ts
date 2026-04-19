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
};
