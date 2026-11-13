import { describe, it, expect } from "vitest";
import { firstWindow, totalsOf } from "@/features/agenda/agendaEngine";

const counts = (c: Partial<Record<"overdue" | "today" | "next" | "later" | "undated", number>>) => ({
  overdue: { count: c.overdue ?? 0 },
  today: { count: c.today ?? 0 },
  next: { count: c.next ?? 0 },
  later: { count: c.later ?? 0 },
  undated: { count: c.undated ?? 0 },
});

describe("firstWindow (§8.5)", () => {
  it("opens on the most urgent window with something in it", () => {
    expect(firstWindow(counts({ overdue: 2, today: 1 }))).toBe("overdue");
    expect(firstWindow(counts({ today: 1, undated: 9 }))).toBe("today");
    expect(firstWindow(counts({ undated: 9 }))).toBe("undated");
  });

  it("opens on today when nothing is owed", () => {
    expect(firstWindow(counts({}))).toBe("today");
  });
});

describe("totalsOf (REQ-642)", () => {
  it("passes the Ledger's totals through, one per currency, without adding them", () => {
    expect(totalsOf({ USD: "10.00", BRL: "140.00" })).toEqual([
      { currency: "BRL", amount: "140.00" },
      { currency: "USD", amount: "10.00" },
    ]);
  });
});
