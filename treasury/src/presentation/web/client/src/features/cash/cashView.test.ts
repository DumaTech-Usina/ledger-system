import { describe, it, expect } from "vitest";
import { checkTone, signedAmount } from "@/features/cash/cashView";

describe("cash view (§8.8)", () => {
  it("an overdrawn balance is sent signed; zero never gets a sign", () => {
    expect(signedAmount("120000", false)).toBe("1200.00");
    expect(signedAmount("120000", true)).toBe("-1200.00");
    expect(signedAmount("", true)).toBe("0.00");
  });

  it("REQ-675: a difference to explain, a match, or nothing to compare — never an invented zero", () => {
    expect(checkTone("0.00")).toBe("ok");
    expect(checkTone("300.00")).toBe("bad");
    expect(checkTone("-9600.00")).toBe("bad");
    expect(checkTone(null)).toBe("unknown");
  });
});
