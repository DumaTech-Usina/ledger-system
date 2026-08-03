import { EVENT_CONTRACTS } from "../contracts/EventContract";
import { CreateLedgerEventProps } from "../entities/LedgerEvent";
import { ConfidenceLevel } from "../enums/ConfidenceLevel";
import { ObjectNature } from "../enums/ObjectNature";
import { ReasonType } from "../enums/ReasonType";
import { Relation } from "../enums/Relation";
import {
  ECONOMIC_EFFECT_RELATION_MATRIX,
  OBJECT_NATURE_MATRIX,
  OBJECT_RELATION_MATRIX,
  REASON_EFFECT_MATRIX,
  REASON_RELATION_MATRIX,
} from "./FormalMatrices";

export class InvariantPolicy {
  static validateSemantic(props: CreateLedgerEventProps) {
    const contract = EVENT_CONTRACTS[props.eventType];

    if (!contract) {
      throw new Error(`Missing semantic contract for ${props.eventType}`);
    }

    // Separate positional (financial) objects from contextual (annotation) objects.
    // Contextual objects only carry REFERENCES relation and are validated in step 9.
    const positionalObjects = props.objects.filter(
      (o) => OBJECT_NATURE_MATRIX[o.objectType] !== ObjectNature.CONTEXTUAL,
    );
    const contextualObjects = props.objects.filter(
      (o) => OBJECT_NATURE_MATRIX[o.objectType] === ObjectNature.CONTEXTUAL,
    );

    // ===============================
    // 1️⃣ Validate economic effect allowed by contract
    // ===============================

    if (!contract.economicEffects.includes(props.economicEffect)) {
      throw new Error(
        `Invalid economic effect ${props.economicEffect} for ${props.eventType}`,
      );
    }

    // ===============================
    // 2️⃣ Validate positional object relations against the effect × relation matrix
    //    Contextual objects (REFERENCES) are exempt — they annotate, not flow.
    // ===============================

    const allowedRelationsByEffect =
      ECONOMIC_EFFECT_RELATION_MATRIX[props.economicEffect];

    for (const obj of positionalObjects) {
      if (!allowedRelationsByEffect.includes(obj.relation)) {
        throw new Error(
          `Relation ${obj.relation} not allowed for economic effect ${props.economicEffect}`,
        );
      }
    }

    // ===============================
    // 3️⃣ Validate object_type × relation (formal matrix)
    // ===============================

    for (const obj of props.objects) {
      const allowedRelations = OBJECT_RELATION_MATRIX[obj.objectType];

      if (allowedRelations !== undefined) {
        if (!allowedRelations.includes(obj.relation)) {
          throw new Error(
            `Relation ${obj.relation} not allowed for object ${obj.objectType}`,
          );
        }
      }
    }

    // ===============================
    // 4️⃣ Validate allowed object types and their relations against the contract
    //    Every positional object must be declared in the contract's objects list.
    // ===============================

    for (const obj of positionalObjects) {
      const contractEntry = contract.objects.find(
        (c) => c.objectType === obj.objectType,
      );

      if (!contractEntry) {
        throw new Error(
          `Object type ${obj.objectType} not allowed for event type ${props.eventType}`,
        );
      }

      if (!contractEntry.relations.includes(obj.relation)) {
        throw new Error(
          `Relation ${obj.relation} not allowed for object ${obj.objectType} on event type ${props.eventType}`,
        );
      }
    }

    // ===============================
    // 5️⃣ Validate reason existence if required
    // ===============================

    if (contract.reasons) {
      if (!props.reason) {
        throw new Error("Reason required");
      }

      if (!contract.reasons.includes(props.reason.type)) {
        throw new Error(
          `Reason ${props.reason.type} not allowed for ${props.eventType}`,
        );
      }
    }

    // ===============================
    // 6️⃣ Validate reason × economic_effect
    // ===============================

    if (props.reason) {
      const allowedEffects = REASON_EFFECT_MATRIX[props.reason.type];

      if (allowedEffects) {
        if (!allowedEffects.includes(props.economicEffect)) {
          throw new Error(
            `Reason ${props.reason.type} not allowed for economic effect ${props.economicEffect}`,
          );
        }
      }
    }

    // ===============================
    // 7️⃣ Validate reason × relation
    // ===============================

    if (props.reason) {
      const allowedRelations = REASON_RELATION_MATRIX[props.reason.type];

      if (allowedRelations) {
        for (const obj of positionalObjects) {
          if (!allowedRelations.includes(obj.relation)) {
            throw new Error(
              `Reason ${props.reason.type} incompatible with relation ${obj.relation}`,
            );
          }
        }
      }
    }

    // ===============================
    // 8️⃣ Confidence hierarchy validation
    // ===============================

    if (contract.minConfidence && props.reason) {
      const hierarchy = {
        [ConfidenceLevel.LOW]: 1,
        [ConfidenceLevel.MEDIUM]: 2,
        [ConfidenceLevel.HIGH]: 3,
      };

      if (
        hierarchy[props.reason.confidence] < hierarchy[contract.minConfidence]
      ) {
        throw new Error("Insufficient confidence level");
      }
    }

    // ===============================
    // 9️⃣ Enforce previousHash for reversals and contract-mandated links
    // ===============================

    const hasReverse = positionalObjects.some(
      (o) => o.relation === Relation.REVERSES,
    );

    if (hasReverse && !props.previousHash) {
      throw new Error("Reversal events require previousHash");
    }

    if (contract.requiresPreviousHash && !props.previousHash) {
      throw new Error(
        `Event type ${props.eventType} requires previousHash`,
      );
    }

    // ===============================
    // 🔟 Enforce relatedEventId for events that must link to an origin
    // ===============================
    //
    // An origin-linked event may omit its link only when it explicitly declares the lineage
    // unresolved: reason UNKNOWN_ORIGIN with requiresFollowup = true. This records an orphan
    // (e.g. a commission received with no known originating expected) as a first-class fact,
    // to be linked later by a new fact — never fabricating an origin or rejecting the fact.

    if (contract.requiresRelatedEventId && !props.relatedEventId) {
      const declaresUnresolvedOrigin =
        props.reason?.type === ReasonType.UNKNOWN_ORIGIN &&
        props.reason.requiresFollowup === true;

      if (!declaresUnresolvedOrigin) {
        throw new Error(
          `Event type ${props.eventType} requires relatedEventId pointing to its originating event`,
        );
      }
    }

    // ===============================
    // 1️⃣1️⃣ Contextual objects must use REFERENCES
    // ===============================

    for (const obj of contextualObjects) {
      if (obj.relation !== Relation.REFERENCES) {
        throw new Error(
          `Contextual object ${obj.objectType} must use relation REFERENCES`,
        );
      }
    }

    // ===============================
    // 1️⃣2️⃣ Rectification: a RETRACTS must name what it retracts, and retract only
    // ===============================
    //
    // RETRACTS declares that a previously recorded event never corresponded to the world. Two things
    // follow, and both are structural rather than a matter of policy:
    //
    //  - the retraction is meaningless without a target: "something never happened" is not a fact
    //    until it says WHICH something. The target travels in relatedEventId;
    //  - retracting and flowing are opposite acts. An event that both retracts a prior assertion and
    //    moves a position is two facts wearing one hash, and no reader could tell them apart.
    //
    // Whether the target EXISTS (and the chain-depth rules) needs the ledger, so it lives in the use
    // case; what can be decided from the event alone is decided here.

    const retracting = props.objects.filter((o) => o.relation === Relation.RETRACTS);

    if (retracting.length > 0) {
      if (!props.relatedEventId) {
        throw new Error(
          "A retraction requires relatedEventId pointing to the event being retracted",
        );
      }

      const flowing = props.objects.filter((o) => o.relation !== Relation.RETRACTS);
      if (flowing.length > 0) {
        throw new Error(
          "A retraction cannot also move a position: RETRACTS must be the only relation on the event",
        );
      }
    }
  }
}
