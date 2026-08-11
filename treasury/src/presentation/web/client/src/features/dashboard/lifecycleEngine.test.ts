import { describe, it, expect } from "vitest";
import { hasOutstandingBalance, pendingCorrection, rectifiability } from "@/features/dashboard/lifecycleEngine";
import type { PositionLifecycleEvent } from "@/types/dashboard";

describe("rectifiability", () => {
  it("offers the correction for a supported position", () => {
    expect(rectifiability({ relation: "settles" })).toEqual({ available: true });
    expect(rectifiability({ relation: "originates" })).toEqual({ available: true });
    expect(rectifiability({ relation: "adjusts" })).toEqual({ available: true });
  });

  it("refuses only when the server says this position admits no correction", () => {
    // The answer used to come from a hardcoded list of kinds copied from the backend. It now comes
    // from the position's admissible actions, so a payroll — which the Ledger DOES admit a
    // correction of — stopped being refused here without anyone editing a list.
    expect(rectifiability({ relation: "settles" }, [{ relation: "settles" }])).toEqual({
      available: false,
      reason: "unsupported",
    });
    expect(
      rectifiability({ relation: "settles" }, [
        { relation: "settles" },
        { relation: "retracts" },
      ]),
    ).toEqual({ available: true });
  });

  it("offers the correction while the actions are still unknown — unknown is not unsupported", () => {
    expect(rectifiability({ relation: "settles" }, undefined)).toEqual({ available: true });
    expect(rectifiability({ relation: "settles" }, undefined)).toEqual({ available: true });
  });

  it("refuses an event that only references this position — it moves another one", () => {
    expect(rectifiability({ relation: "references" })).toEqual({
      available: false,
      reason: "contextual",
    });
  });

  it("checks the relation before the type: a contextual event is contextual either way", () => {
    expect(rectifiability({ relation: "references" })).toEqual({
      available: false,
      reason: "contextual",
    });
  });

  it("offers the correction when the type is unknown — absence of information is not a refusal", () => {
    expect(rectifiability({ relation: "settles" }, undefined)).toEqual({ available: true });
  });

  it("offers the correction for an event with no declared relation", () => {
    expect(rectifiability({ relation: null })).toEqual({ available: true });
  });
});

describe("hasOutstandingBalance", () => {
  it("counts a position with a balance still to close", () => {
    expect(hasOutstandingBalance({ openBalance: "500.00" })).toBe(true);
  });

  it("does not count a zero balance, whether it was settled or never originated", () => {
    // The two cases are indistinguishable here, and that is the point: a payroll settles a position
    // nobody originated, so the Ledger reports it `open` with a balance of 0.00 — the row its own
    // truth table names "cash-basis payable — nothing originated, none claimed". Status would list
    // it as pending; the balance says plainly that nothing is.
    expect(hasOutstandingBalance({ openBalance: "0.00" })).toBe(false);
  });

  it("does not count an unknown origination — an unknown is never folded into a total", () => {
    expect(hasOutstandingBalance({ openBalance: null })).toBe(false);
  });
});

describe("pendingCorrection", () => {
  const event = (over: Partial<PositionLifecycleEvent> = {}): PositionLifecycleEvent => ({
    eventId: "evt-1",
    eventType: "advance_payment",
    economicEffect: "cash_out",
    relation: "originates",
    amount: "400.00",
    currency: "BRL",
    occurredAt: "2026-07-01T00:00:00.000Z",
    recordedAt: "2026-07-01T00:00:00.000Z",
    description: null,
    relatedEventId: null,
    retracted: false,
    requiresFollowup: false,
    objects: [],
    source: null,
    parties: [],
    ...over,
  });

  const origination = event({ eventId: "evt-origin", retracted: true });
  const withdrawal = event({
    eventId: "evt-retract",
    eventType: "ledger_correction",
    relation: "retracts",
    relatedEventId: "evt-origin",
    requiresFollowup: true,
  });

  it("reports a withdrawal that declared a sequel and has not received one", () => {
    expect(pendingCorrection([origination, withdrawal])).toEqual({
      retractionEventId: "evt-retract",
      targetEventId: "evt-origin",
    });
  });

  it("stops reporting once the corrected entry lands — nothing is marked resolved", () => {
    const reissued = event({ eventId: "evt-reissue", amount: "450.00" });
    expect(pendingCorrection([origination, withdrawal, reissued])).toBeNull();
  });

  it("ignores a withdrawal that was always meant to stand alone", () => {
    expect(pendingCorrection([origination, { ...withdrawal, requiresFollowup: false }])).toBeNull();
  });

  it("a withdrawal that was itself retracted no longer stands", () => {
    expect(pendingCorrection([origination, { ...withdrawal, retracted: true }])).toBeNull();
  });

  it("a position with no correction reports nothing", () => {
    expect(pendingCorrection([event()])).toBeNull();
  });
});
