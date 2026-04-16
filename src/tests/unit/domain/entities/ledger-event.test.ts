import { describe, expect, it } from "vitest";
import { LedgerEvent } from "../../../../core/domain/entities/LedgerEvent";
import { LedgerEventObject } from "../../../../core/domain/entities/LedgerEconomicObject";
import { LedgerEventParty } from "../../../../core/domain/entities/LedgerEventParty";
import { EventReason } from "../../../../core/domain/entities/EventReason";
import { ConfidenceLevel } from "../../../../core/domain/enums/ConfidenceLevel";
import { Direction } from "../../../../core/domain/enums/Direction";
import { EconomicEffect } from "../../../../core/domain/enums/EconomicEffect";
import { EventType } from "../../../../core/domain/enums/EventType";
import { ObjectType } from "../../../../core/domain/enums/ObjectType";
import { PartyRole } from "../../../../core/domain/enums/PartyRole";
import { ReasonType } from "../../../../core/domain/enums/ReasonType";
import { Relation } from "../../../../core/domain/enums/Relation";
import { ReporterType } from "../../../../core/domain/enums/ReporterType";
import { Money } from "../../../../core/domain/value-objects/Money";
import { ObjectId } from "../../../../core/domain/value-objects/ObjectId";
import { PartyId } from "../../../../core/domain/value-objects/PartyId";
import { makeValidProps } from "../../../fixtures";

describe("LedgerEvent", () => {
  // ============================
  // Happy path
  // ============================
  describe("create — valid COMMISSION_RECEIVED (CASH_IN)", () => {
    it("creates the event without throwing", () => {
      expect(() => LedgerEvent.create(makeValidProps())).not.toThrow();
    });

    it("assigns the correct eventType and economicEffect", () => {
      const event = LedgerEvent.create(makeValidProps());
      expect(event.eventType).toBe(EventType.COMMISSION_RECEIVED);
      expect(event.economicEffect).toBe(EconomicEffect.CASH_IN);
    });

    it("generates a non-null SHA-256 hash", () => {
      const event = LedgerEvent.create(makeValidProps());
      expect(event.hash).toBeDefined();
      expect(event.hash.value).toMatch(/^[a-f0-9]{64}$/);
    });

    it("exposes parties defensively (copy)", () => {
      const event = LedgerEvent.create(makeValidProps());
      const parties = event.getParties();
      expect(parties).toHaveLength(1);
    });

    it("exposes objects defensively (copy)", () => {
      const event = LedgerEvent.create(makeValidProps());
      expect(event.getObjects()).toHaveLength(1);
    });

    it("exposes reason", () => {
      const event = LedgerEvent.create(makeValidProps());
      expect(event.getReason()?.type).toBe(ReasonType.COMMISSION_PAYMENT);
    });

    it("exposes reporter", () => {
      const event = LedgerEvent.create(makeValidProps());
      expect(event.getReporter().reporterType).toBe(ReporterType.SYSTEM);
    });

    it("sets previousHash to null when not provided", () => {
      const event = LedgerEvent.create(makeValidProps({ previousHash: null }));
      expect(event.previousHash).toBeNull();
    });

    it("sets recordedAt close to now", () => {
      const before = Date.now();
      const event = LedgerEvent.create(makeValidProps());
      const after = Date.now();
      expect(event.recordedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(event.recordedAt.getTime()).toBeLessThanOrEqual(after);
    });
  });

  // ============================
  // Basic invariants
  // ============================
  describe("validateBasic — invariants enforced", () => {
    it("throws when amount is zero", () => {
      const props = makeValidProps({ amount: Money.zero("BRL") });
      expect(() => LedgerEvent.create(props)).toThrow(
        "Event amount cannot be zero",
      );
    });

    it("throws when parties list is empty", () => {
      const props = makeValidProps({ parties: [] });
      expect(() => LedgerEvent.create(props)).toThrow(
        "Event must contain at least one party",
      );
    });

    it("throws when objects list is empty", () => {
      const props = makeValidProps({ objects: [] });
      expect(() => LedgerEvent.create(props)).toThrow(
        "Event must reference at least one economic object",
      );
    });
  });

  // ============================
  // Flow validation — CASH_IN
  // ============================
  describe("validateFlow — CASH_IN", () => {
    it("throws when there is no inbound flow", () => {
      const props = makeValidProps({
        parties: [
          new LedgerEventParty(
            new PartyId("p1"),
            PartyRole.PAYER,
            Direction.OUT,
            Money.fromDecimal("1000.00", "BRL"),
          ),
        ],
      });
      expect(() => LedgerEvent.create(props)).toThrow("Cash in must have inbound flow");
    });

    it("throws when inbound total does not match event amount", () => {
      const props = makeValidProps({
        parties: [
          new LedgerEventParty(
            new PartyId("p1"),
            PartyRole.PAYEE,
            Direction.IN,
            Money.fromDecimal("500.00", "BRL"), // only half of event amount
          ),
        ],
      });
      expect(() => LedgerEvent.create(props)).toThrow(
        "Cash in total must match event amount",
      );
    });

    it("throws when CASH_IN has outbound flow", () => {
      const props = makeValidProps({
        parties: [
          new LedgerEventParty(
            new PartyId("p1"),
            PartyRole.PAYEE,
            Direction.IN,
            Money.fromDecimal("1000.00", "BRL"),
          ),
          new LedgerEventParty(
            new PartyId("p2"),
            PartyRole.PAYER,
            Direction.OUT,
            Money.fromDecimal("200.00", "BRL"),
          ),
        ],
      });
      expect(() => LedgerEvent.create(props)).toThrow(
        "Cash in cannot have outbound flow",
      );
    });
  });

  // ============================
  // Flow validation — CASH_OUT (PENALTY_PAYMENT fixture)
  // ============================
  describe("validateFlow — CASH_OUT", () => {
    const cashOutProps = () =>
      makeValidProps({
        eventType: EventType.PENALTY_PAYMENT,
        economicEffect: EconomicEffect.CASH_OUT,
        parties: [
          new LedgerEventParty(
            new PartyId("p1"),
            PartyRole.PAYER,
            Direction.OUT,
            Money.fromDecimal("1000.00", "BRL"),
          ),
        ],
        objects: [
          new LedgerEventObject(
            new ObjectId("obj-1"),
            ObjectType.PENALTY,
            Relation.SETTLES,
          ),
        ],
        reason: new EventReason(
          ReasonType.PENALTY_PAYMENT,
          "Penalty settled",
          ConfidenceLevel.HIGH,
          false,
        ),
      });

    it("creates a valid CASH_OUT event", () => {
      expect(() => LedgerEvent.create(cashOutProps())).not.toThrow();
    });

    it("throws when there is no outbound flow", () => {
      const props = cashOutProps();
      props.parties[0] = new LedgerEventParty(
        new PartyId("p1"),
        PartyRole.PAYEE,
        Direction.IN,
        Money.fromDecimal("1000.00", "BRL"),
      );
      expect(() => LedgerEvent.create(props)).toThrow(
        "Cash out must have outbound flow",
      );
    });

    it("throws when outbound total does not match event amount", () => {
      const props = cashOutProps();
      props.parties[0] = new LedgerEventParty(
        new PartyId("p1"),
        PartyRole.PAYER,
        Direction.OUT,
        Money.fromDecimal("500.00", "BRL"),
      );
      expect(() => LedgerEvent.create(props)).toThrow(
        "Cash out total must match event amount",
      );
    });
  });

  // ============================
  // Flow validation — NON_CASH (COMMISSION_WAIVER)
  // ============================
  describe("validateFlow — NON_CASH", () => {
    it("creates a valid NON_CASH event with NEUTRAL parties", () => {
      const props = makeValidProps({
        eventType: EventType.COMMISSION_WAIVER,
        economicEffect: EconomicEffect.NON_CASH,
        parties: [
          new LedgerEventParty(
            new PartyId("p1"),
            PartyRole.PLATFORM,
            Direction.NEUTRAL,
            null,
          ),
        ],
        objects: [
          new LedgerEventObject(
            new ObjectId("obj-1"),
            ObjectType.COMMISSION_ENTITLEMENT,
            Relation.SETTLES,
          ),
        ],
        reason: new EventReason(
          ReasonType.COMMISSION_WAIVER,
          "Waiver approved",
          ConfidenceLevel.HIGH,
          false,
        ),
      });
      expect(() => LedgerEvent.create(props)).not.toThrow();
    });

    it("throws when NON_CASH party has directional (cash) flow", () => {
      const props = makeValidProps({
        eventType: EventType.COMMISSION_WAIVER,
        economicEffect: EconomicEffect.NON_CASH,
        parties: [
          new LedgerEventParty(
            new PartyId("p1"),
            PartyRole.PAYEE,
            Direction.IN,
            Money.fromDecimal("1000.00", "BRL"),
          ),
        ],
        objects: [
          new LedgerEventObject(
            new ObjectId("obj-1"),
            ObjectType.COMMISSION_ENTITLEMENT,
            Relation.SETTLES,
          ),
        ],
        reason: new EventReason(
          ReasonType.COMMISSION_WAIVER,
          "Waiver",
          ConfidenceLevel.HIGH,
          false,
        ),
      });
      expect(() => LedgerEvent.create(props)).toThrow(
        "Non-cash event cannot alter cash flow",
      );
    });
  });

  // ============================
  // Reason rules
  // ============================
  describe("validateReasonRules", () => {
    it("throws when NON_CASH event has no reason", () => {
      const props = makeValidProps({
        eventType: EventType.COMMISSION_WAIVER,
        economicEffect: EconomicEffect.NON_CASH,
        parties: [
          new LedgerEventParty(
            new PartyId("p1"),
            PartyRole.PLATFORM,
            Direction.NEUTRAL,
            null,
          ),
        ],
        objects: [
          new LedgerEventObject(
            new ObjectId("obj-1"),
            ObjectType.COMMISSION_ENTITLEMENT,
            Relation.SETTLES,
          ),
        ],
        reason: null,
      });
      expect(() => LedgerEvent.create(props)).toThrow(
        "Non-cash events require a reason",
      );
    });
  });
});
