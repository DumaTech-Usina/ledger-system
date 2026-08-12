import { describe, it, expect } from "vitest";
import {
  hasOutstandingBalance,
  outcomeTone,
  pendingCorrection,
  rectifiability,
  relatedEventOf,
  relationTone,
  statusTone,
} from "@/features/dashboard/lifecycleEngine";
import type { PositionLifecycleEvent } from "@/types/dashboard";

const eventFixture = (over: Partial<PositionLifecycleEvent> = {}): PositionLifecycleEvent => ({
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
  // The contextual references the Ledger publishes about the event. Empty here because neither
  // function under test reads them — both decide on the retraction chain alone.
  objects: [],
  source: null,
  parties: [],
  ...over,
});

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

describe("lifecycle tones", () => {
  it("gives each step of a life its own colour", () => {
    // The point of the mapping: a reader must be able to find where the object stands without
    // reading every pill, which a single grey made impossible.
    const tones = ["originates", "settles", "adjusts", "references"].map(relationTone);
    expect(new Set(tones).size).toBe(4);
  });

  it("colours the two ways of taking something back the same", () => {
    // From the position's side both subtract something previously recorded.
    expect(relationTone("reverses")).toBe("bad");
    expect(relationTone("retracts")).toBe("bad");
  });

  it("stays neutral about a step it has no opinion on", () => {
    // A relation this app was never taught must not be coloured as good or bad.
    expect(relationTone("some_new_relation")).toBe("neutral");
    expect(relationTone(null)).toBe("neutral");
  });

  it("does not colour an unknown origination as a problem", () => {
    // The book was not told what was originated. That is a gap in the record, not a position in
    // trouble, and colouring it red would accuse it of something nobody said.
    expect(statusTone("unknown_origin")).toBe("neutral");
    expect(statusTone("reversed")).toBe("bad");
  });

  it("separates still-running from settled and from lost", () => {
    expect(outcomeTone("pending")).toBe("accent");
    expect(outcomeTone("gain")).toBe("ok");
    expect(outcomeTone("full_loss")).toBe("bad");
  });
});

describe("relatedEventOf", () => {
  const target = eventFixture({ eventId: "evt-origin" });
  const retraction = eventFixture({ eventId: "evt-retract", relatedEventId: "evt-origin" });

  it("names the event a retraction speaks about when this history holds it", () => {
    expect(relatedEventOf([target, retraction], retraction.relatedEventId)).toBe(target);
  });

  it("answers null when the related event belongs to another position", () => {
    // The caller tells this apart from "no related event" by looking at relatedEventId itself, and
    // says so on screen — an unresolved id would read as a lookup that failed.
    expect(relatedEventOf([retraction], "evt-somewhere-else")).toBeNull();
  });

  it("answers null when the event speaks about nothing", () => {
    expect(relatedEventOf([target, retraction], null)).toBeNull();
  });
});

describe("pendingCorrection", () => {
  const event = eventFixture;

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
