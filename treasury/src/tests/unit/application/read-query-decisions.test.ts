import { describe, it, expect } from "vitest";
import { clampSlice, servedByScan } from "../../../core/application/use-cases/GetTreasuryDashboard";
import { clampPageSize } from "../../../core/application/use-cases/ListPositions";
import { clampLimit } from "../../../core/application/use-cases/ListCashMovements";

/**
 * The non-trivial decisions behind the read parameters, as pure functions with tests — the
 * convention `client/ARCHITECTURE.md` states and the one an untested inline predicate broke once.
 * Getting `servedByScan` wrong is not a display bug: a `true` for a filtered request would show the
 * unfiltered book under a filter the user chose.
 */
describe("servedByScan", () => {
  it("true for the default overview: first page, no filter, no period", () => {
    expect(servedByScan({}, 8, 1)).toBe(true);
  });

  it("false once a page beyond the first is asked for", () => {
    expect(servedByScan({}, 8, 2)).toBe(false);
  });

  it("false for any filter — the scan is the whole book and would ignore it", () => {
    expect(servedByScan({ status: "open" }, 8, 1)).toBe(false);
    expect(servedByScan({ objectType: ["payroll"] }, 8, 1)).toBe(false);
  });

  it("false for a period, on either bound", () => {
    expect(servedByScan({ from: "2026-01-01" }, 8, 1)).toBe(false);
    expect(servedByScan({ to: "2026-01-01" }, 8, 1)).toBe(false);
  });

  it("false when the slice would run past what the scan holds", () => {
    expect(servedByScan({}, 500, 1)).toBe(true);
    expect(servedByScan({}, 501, 1)).toBe(false);
  });

  it("an empty selection is not a filter — it selects nothing to filter by", () => {
    expect(servedByScan({ status: [] }, 8, 1)).toBe(true);
    expect(servedByScan({ objectType: "" }, 8, 1)).toBe(true);
  });
});

describe("page sizes", () => {
  it("absent keeps each listing's established default", () => {
    expect(clampSlice(undefined)).toBe(8);
    expect(clampPageSize(undefined)).toBe(20);
    expect(clampLimit(undefined)).toBe(50);
  });

  it("clamped to the Ledger's cap, so the reply describes the page actually returned", () => {
    expect(clampPageSize(5000)).toBe(200);
    expect(clampLimit(5000)).toBe(200);
    expect(clampSlice(5000)).toBe(200);
  });

  it("zero and negatives become one row, never zero rows", () => {
    expect(clampPageSize(0)).toBe(1);
    expect(clampLimit(-3)).toBe(1);
  });

  it("a non-number falls back to the default rather than to NaN", () => {
    expect(clampPageSize(Number.NaN)).toBe(20);
    expect(clampLimit(Number.NaN)).toBe(50);
  });
});
