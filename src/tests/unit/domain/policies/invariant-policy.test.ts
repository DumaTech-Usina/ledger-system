import { describe, expect, it } from "vitest";
import { InvariantPolicy } from "../../../../core/domain/policies/InvariantPolicy";
import { EventReason } from "../../../../core/domain/entities/EventReason";
import { LedgerEventObject } from "../../../../core/domain/entities/LedgerEconomicObject";
import { ConfidenceLevel } from "../../../../core/domain/enums/ConfidenceLevel";
import { EconomicEffect } from "../../../../core/domain/enums/EconomicEffect";
import { EventType } from "../../../../core/domain/enums/EventType";
import { ObjectType } from "../../../../core/domain/enums/ObjectType";
import { ReasonType } from "../../../../core/domain/enums/ReasonType";
import { Relation } from "../../../../core/domain/enums/Relation";
import { EventHash } from "../../../../core/domain/value-objects/EventHash";
import { ObjectId } from "../../../../core/domain/value-objects/ObjectId";
import { makeValidProps } from "../../../fixtures";

const obj = (type: ObjectType, relation: Relation) =>
  new LedgerEventObject(new ObjectId("obj-1"), type, relation);

const reason = (
  type: ReasonType,
  confidence: ConfidenceLevel = ConfidenceLevel.MEDIUM,
  requiresFollowup = false,
) => new EventReason(type, "desc", confidence, requiresFollowup);

describe("InvariantPolicy.validateSemantic", () => {
  // ============================
  // Step 0 — contract existence
  // ============================
  it("throws when no contract exists for the event type", () => {
    const props = makeValidProps({
      eventType: "UNKNOWN_TYPE" as EventType,
    });
    expect(() => InvariantPolicy.validateSemantic(props)).toThrow(
      "Missing semantic contract",
    );
  });

  // ============================
  // Step 1 — economic effect allowed by contract
  // ============================
  it("throws when economic effect is not allowed by the event contract", () => {
    // COMMISSION_RECEIVED only allows CASH_IN; use CASH_OUT
    const props = makeValidProps({ economicEffect: EconomicEffect.CASH_OUT });
    expect(() => InvariantPolicy.validateSemantic(props)).toThrow(
      "Invalid economic effect",
    );
  });

  it("passes when economic effect matches the contract", () => {
    expect(() =>
      InvariantPolicy.validateSemantic(makeValidProps()),
    ).not.toThrow();
  });

  // ============================
  // Step 2 — economic_effect × relation matrix
  // ============================
  it("throws when relation is not allowed for the economic effect", () => {
    // CASH_IN only allows ORIGINATES and SETTLES — not REVERSES
    const props = makeValidProps({
      objects: [obj(ObjectType.COMMISSION_RECEIVABLE, Relation.REVERSES)],
    });
    expect(() => InvariantPolicy.validateSemantic(props)).toThrow(
      "not allowed for economic effect",
    );
  });

  it("passes when relation is allowed for the economic effect", () => {
    const props = makeValidProps({
      objects: [obj(ObjectType.COMMISSION_RECEIVABLE, Relation.ORIGINATES)],
    });
    expect(() => InvariantPolicy.validateSemantic(props)).not.toThrow();
  });

  // ============================
  // Step 3 — object_type × relation matrix
  // ============================
  it("throws when relation is not allowed for the object type", () => {
    // COMMISSION_POOL only allows ADJUSTS; SETTLES is not in its list.
    // CASH_IN allows SETTLES (step 2 passes), but COMMISSION_POOL restricts to ADJUSTS.
    const props = makeValidProps({
      objects: [obj(ObjectType.COMMISSION_POOL, Relation.SETTLES)],
    });
    expect(() => InvariantPolicy.validateSemantic(props)).toThrow(
      "not allowed for object",
    );
  });

  // ============================
  // Step 4 — reason required by contract
  // ============================
  it("throws when reason is missing and the contract requires one", () => {
    const props = makeValidProps({ reason: null });
    expect(() => InvariantPolicy.validateSemantic(props)).toThrow(
      "Reason required",
    );
  });

  it("throws when reason type is not in the contract's allowed reasons", () => {
    const props = makeValidProps({
      reason: reason(ReasonType.PAYROLL_PAYMENT), // not allowed for COMMISSION_RECEIVED
    });
    expect(() => InvariantPolicy.validateSemantic(props)).toThrow(
      "not allowed for",
    );
  });

  // ============================
  // Step 7 — confidence hierarchy
  // ============================
  it("throws when confidence is below the contract's minimum", () => {
    // COMMISSION_RECEIVED requires at least MEDIUM; LOW is insufficient
    const props = makeValidProps({
      reason: reason(
        ReasonType.COMMISSION_PAYMENT,
        ConfidenceLevel.LOW,
      ),
    });
    expect(() => InvariantPolicy.validateSemantic(props)).toThrow(
      "Insufficient confidence",
    );
  });

  it("passes with exactly the minimum required confidence", () => {
    const props = makeValidProps({
      reason: reason(ReasonType.COMMISSION_PAYMENT, ConfidenceLevel.MEDIUM),
    });
    expect(() => InvariantPolicy.validateSemantic(props)).not.toThrow();
  });

  it("passes with confidence higher than required", () => {
    const props = makeValidProps({
      reason: reason(ReasonType.COMMISSION_PAYMENT, ConfidenceLevel.HIGH),
    });
    expect(() => InvariantPolicy.validateSemantic(props)).not.toThrow();
  });

  // ============================
  // Step 8 — previousHash required for reversals
  // ============================
  it("throws when reversal object is present but previousHash is absent", () => {
    // NON_CASH + COMMISSION_ENTITLEMENT + REVERSES is a valid relation path
    const props = makeValidProps({
      eventType: EventType.COMMISSION_WAIVER,
      economicEffect: EconomicEffect.NON_CASH,
      objects: [obj(ObjectType.COMMISSION_ENTITLEMENT, Relation.REVERSES)],
      reason: reason(ReasonType.COMMISSION_WAIVER, ConfidenceLevel.HIGH),
      previousHash: null,
    });
    expect(() => InvariantPolicy.validateSemantic(props)).toThrow(
      "previousHash",
    );
  });

  it("passes reversal when previousHash is provided", () => {
    const prevHash = EventHash.generateCanonical({ id: "prev-evt" });
    const props = makeValidProps({
      eventType: EventType.COMMISSION_WAIVER,
      economicEffect: EconomicEffect.NON_CASH,
      objects: [obj(ObjectType.COMMISSION_ENTITLEMENT, Relation.REVERSES)],
      reason: reason(ReasonType.COMMISSION_WAIVER, ConfidenceLevel.HIGH),
      previousHash: prevHash,
    });
    expect(() => InvariantPolicy.validateSemantic(props)).not.toThrow();
  });

  // ============================
  // Step 9 — CONTEXTUAL objects must use REFERENCES
  // ============================
  it("throws when a CONTEXTUAL object does not use REFERENCES relation", () => {
    // PROPOSAL is CONTEXTUAL; using SETTLES instead of REFERENCES should throw
    // Setup: ADVANCE_PAYMENT + NON_CASH + PROPOSAL + SETTLES
    const props = makeValidProps({
      eventType: EventType.ADVANCE_PAYMENT,
      economicEffect: EconomicEffect.NON_CASH,
      objects: [obj(ObjectType.PROPOSAL, Relation.SETTLES)],
      reason: reason(ReasonType.ADVANCE_PAYMENT, ConfidenceLevel.HIGH),
    });
    expect(() => InvariantPolicy.validateSemantic(props)).toThrow(
      "must use relation REFERENCES",
    );
  });

  it("throws when a CONTEXTUAL object uses ORIGINATES instead of REFERENCES", () => {
    const props = makeValidProps({
      eventType: EventType.ADVANCE_PAYMENT,
      economicEffect: EconomicEffect.NON_CASH,
      objects: [obj(ObjectType.PROPOSAL, Relation.ORIGINATES)],
      reason: reason(ReasonType.ADVANCE_PAYMENT, ConfidenceLevel.HIGH),
    });
    expect(() => InvariantPolicy.validateSemantic(props)).toThrow(
      "must use relation REFERENCES",
    );
  });
});
