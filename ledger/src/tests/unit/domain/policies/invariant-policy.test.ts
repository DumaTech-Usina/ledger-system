import { describe, expect, it } from "vitest";
import { InvariantPolicy } from "../../../../core/domain/policies/InvariantPolicy";
import { EventReason } from "../../../../core/domain/entities/EventReason";
import { LedgerEventObject } from "../../../../core/domain/entities/LedgerEconomicObject";
import { LedgerEventParty } from "../../../../core/domain/entities/LedgerEventParty";
import { ConfidenceLevel } from "../../../../core/domain/enums/ConfidenceLevel";
import { Direction } from "../../../../core/domain/enums/Direction";
import { EconomicEffect } from "../../../../core/domain/enums/EconomicEffect";
import { EventType } from "../../../../core/domain/enums/EventType";
import { ObjectType } from "../../../../core/domain/enums/ObjectType";
import { PartyRole } from "../../../../core/domain/enums/PartyRole";
import { ReasonType } from "../../../../core/domain/enums/ReasonType";
import { Relation } from "../../../../core/domain/enums/Relation";
import { EventHash } from "../../../../core/domain/value-objects/EventHash";
import { Money } from "../../../../core/domain/value-objects/Money";
import { ObjectId } from "../../../../core/domain/value-objects/ObjectId";
import { PartyId } from "../../../../core/domain/value-objects/PartyId";
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
    // ADVANCE_PAYMENT + CASH_OUT + ADVANCE + ORIGINATES is a valid semantic path:
    // CASH_OUT allows ORIGINATES (step 2) and ADVANCE_PAYMENT reason allows ORIGINATES (step 6).
    const props = makeValidProps({
      eventType: EventType.ADVANCE_PAYMENT,
      economicEffect: EconomicEffect.CASH_OUT,
      objects: [obj(ObjectType.ADVANCE, Relation.ORIGINATES)],
      reason: reason(ReasonType.ADVANCE_PAYMENT, ConfidenceLevel.HIGH),
      parties: [
        new LedgerEventParty(
          new PartyId("party-1"),
          PartyRole.PAYER,
          Direction.OUT,
          Money.fromDecimal("1000.00", "BRL"),
        ),
      ],
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
    // PROPOSAL is CONTEXTUAL; using SETTLES instead of REFERENCES should throw.
    // Step 3 (OBJECT_RELATION_MATRIX) now catches this before step 11.
    const props = makeValidProps({
      eventType: EventType.ADVANCE_PAYMENT,
      economicEffect: EconomicEffect.NON_CASH,
      objects: [obj(ObjectType.PROPOSAL, Relation.SETTLES)],
      reason: reason(ReasonType.ADVANCE_PAYMENT, ConfidenceLevel.HIGH),
    });
    expect(() => InvariantPolicy.validateSemantic(props)).toThrow(
      "not allowed for object proposal",
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
      "not allowed for object proposal",
    );
  });

  // ============================
  // LEDGER_CORRECTION contract
  // ============================
  describe("LEDGER_CORRECTION", () => {
    const prevHash = EventHash.generateCanonical({ id: "prev-evt" });

    const validCorrectionProps = () =>
      makeValidProps({
        eventType: EventType.LEDGER_CORRECTION,
        economicEffect: EconomicEffect.NON_CASH,
        objects: [obj(ObjectType.COMMISSION_RECEIVABLE, Relation.REVERSES)],
        reason: reason(ReasonType.MANUAL_CORRECTION, ConfidenceLevel.HIGH),
        previousHash: prevHash,
        // parties: NON_CASH — no cash flow, party direction must be NEUTRAL
        // (reuse default party from makeValidProps — flow validation in LedgerEvent handles this)
      });

    it("passes with a valid full reversal", () => {
      expect(() =>
        InvariantPolicy.validateSemantic(validCorrectionProps()),
      ).not.toThrow();
    });

    it("passes with ADJUSTS relation (partial correction)", () => {
      const props = validCorrectionProps();
      props.objects = [obj(ObjectType.COMMISSION_RECEIVABLE, Relation.ADJUSTS)];
      expect(() => InvariantPolicy.validateSemantic(props)).not.toThrow();
    });

    it("passes with DATA_RECONCILIATION reason", () => {
      const props = validCorrectionProps();
      props.reason = reason(ReasonType.DATA_RECONCILIATION, ConfidenceLevel.HIGH);
      expect(() => InvariantPolicy.validateSemantic(props)).not.toThrow();
    });

    it("passes with LATE_AWARENESS reason", () => {
      const props = validCorrectionProps();
      props.reason = reason(ReasonType.LATE_AWARENESS, ConfidenceLevel.HIGH);
      expect(() => InvariantPolicy.validateSemantic(props)).not.toThrow();
    });

    it("throws when previousHash is absent — contract mandates it", () => {
      const props = validCorrectionProps();
      props.previousHash = null;
      expect(() => InvariantPolicy.validateSemantic(props)).toThrow(
        "previousHash",
      );
    });

    it("throws when economicEffect is not NON_CASH", () => {
      const props = validCorrectionProps();
      props.economicEffect = EconomicEffect.CASH_OUT;
      expect(() => InvariantPolicy.validateSemantic(props)).toThrow(
        "Invalid economic effect",
      );
    });

    it("throws when confidence is below HIGH", () => {
      const props = validCorrectionProps();
      props.reason = reason(ReasonType.MANUAL_CORRECTION, ConfidenceLevel.MEDIUM);
      expect(() => InvariantPolicy.validateSemantic(props)).toThrow(
        "Insufficient confidence",
      );
    });

    it("throws when reason is not a governance correction reason", () => {
      const props = validCorrectionProps();
      props.reason = reason(ReasonType.COMMISSION_PAYMENT, ConfidenceLevel.HIGH);
      expect(() => InvariantPolicy.validateSemantic(props)).toThrow(
        "not allowed for",
      );
    });

    it("throws when relation is ORIGINATES (not allowed in correction contract)", () => {
      // Step 4 (contract objects check) now fires before the reason×relation matrix check.
      const props = validCorrectionProps();
      props.objects = [obj(ObjectType.COMMISSION_RECEIVABLE, Relation.ORIGINATES)];
      expect(() => InvariantPolicy.validateSemantic(props)).toThrow(
        "not allowed for object commission_receivable on event type ledger_correction",
      );
    });
  });
});
