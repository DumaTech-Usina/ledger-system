import { describe, it, expect } from "vitest";
import { brlOf, cell, columnKeys, dayLabel } from "@/features/morning/morningView";
import type { Columns } from "@/features/morning/morningApi";

const c: Columns = {
  overdue: { count: 2, totals: { BRL: "140.00" } },
  days: [
    { day: "2026-11-17", count: 1, totals: { BRL: "200.00" } },
    { day: "2026-11-18", count: 0, totals: {} },
  ],
  later: { count: 0, totals: {} },
  undated: { count: 3, totals: { BRL: "999.99" } },
};

describe("morning panel view (§8.10)", () => {
  it("REQ-682: overdue first, then each day; undated never becomes a column", () => {
    expect(columnKeys(c)).toEqual(["overdue", "2026-11-17", "2026-11-18"]);
  });

  it("shows the Ledger's figure, nothing for an empty day, and unknown for a day it did not publish", () => {
    expect(brlOf(cell(c, "overdue"))).toBe("140.00");
    expect(brlOf(cell(c, "2026-11-18"))).toBeNull();
    expect(cell(c, "2026-12-01")).toBeNull();
  });

  it("names a day briefly", () => {
    expect(dayLabel("2026-11-18", "pt-BR")).toBe("qua 18/11");
  });
});
