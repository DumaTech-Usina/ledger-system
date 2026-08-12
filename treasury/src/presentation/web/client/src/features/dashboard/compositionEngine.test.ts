import { describe, it, expect } from "vitest";
import { compositionState } from "@/features/dashboard/compositionEngine";

describe("compositionState", () => {
  it("tells an unpublished composition from an empty one", () => {
    // The whole reason this decision is a function: an absent composition is "not told", and
    // rendering it as "nothing outstanding" would put a claim on screen the book never made.
    expect(compositionState(undefined)).toBe("unknown");
    expect(compositionState([])).toBe("empty");
  });

  it("lists whatever the Ledger published", () => {
    expect(compositionState([{ objectType: "payroll", openBalance: "4000.00" }])).toBe("listed");
  });
});
