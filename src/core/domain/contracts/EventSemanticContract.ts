import { ConfidenceLevel } from "../enums/ConfidenceLevel";
import { EconomicEffect } from "../enums/EconomicEffect";
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
};
