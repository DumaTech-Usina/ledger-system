import { describe, it, expect } from "vitest";
import { debitMatches, lineProblem, selectionItems, selectionTotal, toggle, unbatchable, type SelectableLine } from "@/features/batches/batchSelection";

const line = (objectId: string, openBalance: string | null, over: Partial<SelectableLine> = {}): SelectableLine => ({
  objectId,
  currency: "BRL",
  openBalance,
  creditors: [{ partyId: "p-1" }],
  ...over,
});

describe("unbatchable (REQ-651)", () => {
  it("a line with one creditor, in reais, with something open, can enter a batch", () => {
    expect(unbatchable(line("a", "10.00"))).toBeNull();
  });

  it("says why the others are paid from their position", () => {
    expect(unbatchable(line("a", "10.00", { creditors: [] }))).toBe("creditor");
    expect(unbatchable(line("a", "10.00", { creditors: [{ partyId: "x" }, { partyId: "y" }] }))).toBe("creditors");
    expect(unbatchable(line("a", "10.00", { currency: "USD" }))).toBe("currency");
    expect(unbatchable(line("a", null))).toBe("balance");
  });
});

describe("the selection", () => {
  it("ticking chooses the whole open balance; ticking again lets it go", () => {
    const one = toggle({}, line("a", "300.00"));
    expect(one.a.digits).toBe("30000");
    expect(toggle(one, line("a", "300.00"))).toEqual({});
  });

  it("sums what was chosen, in cents, and sends it in the Ledger's form", () => {
    let s = toggle({}, line("a", "300.00"));
    s = toggle(s, line("b", "200.50"));
    expect(selectionTotal(s)).toBe("500.50");
    expect(selectionItems(s)).toEqual([
      { objectId: "a", amount: "300.00" },
      { objectId: "b", amount: "200.50" },
    ]);
  });

  it("a partial amount is fine; more than is open, or nothing, is not (Q-048)", () => {
    const chosen = toggle({}, line("a", "120.00")).a;
    expect(lineProblem({ ...chosen, digits: "10000" })).toBeNull();
    expect(lineProblem({ ...chosen, digits: "15000" })).toBe("over");
    expect(lineProblem({ ...chosen, digits: "" })).toBe("zero");
  });
});

describe("debitMatches (REQ-653)", () => {
  it("only an exact match lets the payment go", () => {
    expect(debitMatches("50000", "500.00")).toBe(true);
    expect(debitMatches("51000", "500.00")).toBe(false);
    expect(debitMatches("", "0.00")).toBe(false);
  });
});
