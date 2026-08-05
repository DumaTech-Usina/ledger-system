import { describe, it, expect } from "vitest";
import { hasOutstandingBalance, rectifiability } from "@/features/dashboard/lifecycleEngine";

describe("rectifiability", () => {
  it("offers the correction for a supported position", () => {
    expect(rectifiability({ relation: "settles" }, "advance")).toEqual({ available: true });
    expect(rectifiability({ relation: "originates" }, "loan")).toEqual({ available: true });
    expect(rectifiability({ relation: "adjusts" }, "commission_receivable")).toEqual({ available: true });
  });

  it("refuses a kind of position treasury cannot describe a correction of", () => {
    expect(rectifiability({ relation: "settles" }, "payroll")).toEqual({
      available: false,
      reason: "unsupported",
    });
  });

  it("refuses an event that only references this position — it moves another one", () => {
    expect(rectifiability({ relation: "references" }, "advance")).toEqual({
      available: false,
      reason: "contextual",
    });
  });

  it("checks the relation before the type: a contextual event is contextual either way", () => {
    expect(rectifiability({ relation: "references" }, "payroll")).toEqual({
      available: false,
      reason: "contextual",
    });
  });

  it("offers the correction when the type is unknown — absence of information is not a refusal", () => {
    expect(rectifiability({ relation: "settles" }, undefined)).toEqual({ available: true });
  });

  it("offers the correction for an event with no declared relation", () => {
    expect(rectifiability({ relation: null }, "advance")).toEqual({ available: true });
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
