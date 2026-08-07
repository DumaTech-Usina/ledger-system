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
import { Money } from "../../../../core/domain/value-objects/Money";
import { ObjectId } from "../../../../core/domain/value-objects/ObjectId";
import { PartyId } from "../../../../core/domain/value-objects/PartyId";
import { makeValidProps } from "../../../fixtures";

/**
 * Invariant 13 — a due date belongs to an obligation being originated.
 *
 * The rule is deliberately one-directional: it refuses a due date that could not mean anything, and
 * never demands one. An obligation whose establishing document stated no terms is an ordinary fact,
 * and requiring `dueAt` would gate a real fact on information that may not exist.
 */

const DUE = new Date("2026-09-30T00:00:00Z");

/** An OBLIGATION_RECOGNIZED that originates a payroll — the one tuple that admits a due date. */
function recognitionProps(overrides: Parameters<typeof makeValidProps>[0] = {}) {
  return makeValidProps({
    eventType: EventType.OBLIGATION_RECOGNIZED,
    economicEffect: EconomicEffect.NON_CASH,
    relatedEventId: null,
    parties: [
      new LedgerEventParty(new PartyId("usina"), PartyRole.PAYER, Direction.NEUTRAL, null),
      new LedgerEventParty(new PartyId("supplier"), PartyRole.PAYEE, Direction.NEUTRAL, null),
    ],
    objects: [
      new LedgerEventObject(new ObjectId("payroll-1"), ObjectType.PAYROLL, Relation.ORIGINATES),
    ],
    reason: new EventReason(
      ReasonType.OBLIGATION_RECOGNITION,
      "March payroll closed",
      ConfidenceLevel.HIGH,
      false,
    ),
    ...overrides,
  });
}

describe("invariant 13 — dueAt requires a contract that admits it and an ORIGINATES", () => {
  it("accepts a due date on an obligation being recognized", () => {
    const event = LedgerEvent.create(recognitionProps({ dueAt: DUE }));

    expect(event.dueAt).toEqual(DUE);
  });

  it("accepts a recognition with no due date at all — absence is a fact, not a gap", () => {
    const event = LedgerEvent.create(recognitionProps());

    expect(event.dueAt).toBeNull();
  });

  it("refuses a due date on a payment: an obligation falls due, a settlement does not", () => {
    // PAYROLL_PAYMENT settles the position. Its contract does not admit a due date, so a caller
    // trying to date the payment is corrected rather than silently having the field dropped.
    const props = makeValidProps({
      eventType: EventType.PAYROLL_PAYMENT,
      economicEffect: EconomicEffect.CASH_OUT,
      relatedEventId: null,
      dueAt: DUE,
      parties: [
        new LedgerEventParty(
          new PartyId("usina"),
          PartyRole.PAYER,
          Direction.OUT,
          Money.fromDecimal("1000.00", "BRL"),
        ),
      ],
      objects: [
        new LedgerEventObject(new ObjectId("payroll-1"), ObjectType.PAYROLL, Relation.SETTLES),
      ],
      reason: new EventReason(
        ReasonType.PAYROLL_PAYMENT,
        "March payroll paid",
        ConfidenceLevel.HIGH,
        false,
      ),
    });

    expect(() => LedgerEvent.create(props)).toThrow(/cannot carry a dueAt/);
  });

  it("refuses a due date with no ORIGINATES — a date attached to nothing", () => {
    // The contract admits dueAt, so the first half of the rule passes. What fails is the second:
    // this event only REFERENCES a contract (a contextual object, exempt from the contract's own
    // object list), so it originates no obligation for the date to belong to.
    const props = recognitionProps({
      dueAt: DUE,
      objects: [
        new LedgerEventObject(new ObjectId("contract-1"), ObjectType.CONTRACT, Relation.REFERENCES),
      ],
    });

    expect(() => LedgerEvent.create(props)).toThrow(/dueAt requires an object with relation ORIGINATES/);
  });

  it("puts the due date inside the hash: two otherwise identical recognitions differ", () => {
    // This is what makes the date tamper-evident. If it were outside the hash, the two events below
    // would be indistinguishable and a deadline could be moved after the fact.
    const withDue = LedgerEvent.create(recognitionProps({ dueAt: DUE }));
    const withoutDue = LedgerEvent.create(recognitionProps());

    expect(withDue.hash.value).not.toBe(withoutDue.hash.value);
  });
});
