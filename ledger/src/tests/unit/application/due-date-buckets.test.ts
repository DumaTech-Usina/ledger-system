import { describe, expect, it } from "vitest";
import { computeCapitalMetrics, dueStateOf } from "../../../core/application/dtos/positionUtils";
import { PositionAggregate } from "../../../core/application/dtos/PositionAggregate";
import { ObjectType } from "../../../core/domain/enums/ObjectType";

/**
 * The three due-date states a payable position can be in, and the rule that keeps them three.
 *
 * `unknown` is the one that matters here. An obligation whose establishing document stated no terms
 * is not late and not upcoming — folding it into either total would publish a claim the book cannot
 * support, which is the same reason an unknown open balance stays out of exposure instead of being
 * added as zero.
 */

const NOW = new Date("2026-08-07T12:00:00Z");

function payable(overrides: Partial<PositionAggregate> = {}): PositionAggregate {
  return {
    objectId: "obj-1",
    objectType: ObjectType.PAYABLE,
    currency: "BRL",
    totalOriginatedUnits: 100_00n,
    totalSettledUnits: 0n,
    totalAdjustedUnits: 0n,
    cashRecoveredUnits: 0n,
    nonCashClosedUnits: 0n,
    refCashInUnits: 0n,
    refCashOutUnits: 0n,
    hasReversal: false,
    hasUnresolvedLineage: false,
    eventCount: 1,
    lastEventAt: new Date("2026-08-01"),
    originatedAt: new Date("2026-08-01"),
    createdAt: new Date("2026-08-01"),
    dueAt: null,
    ...overrides,
  };
}

const metrics = (aggs: PositionAggregate[]) =>
  computeCapitalMetrics(aggs, "BRL", NOW.getTime() - 30 * 24 * 60 * 60 * 1000, NOW);

describe("dueStateOf", () => {
  it("a stated date already past is overdue", () => {
    expect(dueStateOf(payable({ dueAt: new Date("2026-08-05") }), NOW)).toBe("overdue");
  });

  it("a stated date still ahead is upcoming", () => {
    expect(dueStateOf(payable({ dueAt: new Date("2026-08-30") }), NOW)).toBe("upcoming");
  });

  it("no stated date is unknown — never overdue, never upcoming", () => {
    expect(dueStateOf(payable({ dueAt: null }), NOW)).toBe("unknown");
  });
});

describe("computeCapitalMetrics — the payable split", () => {
  it("sorts payables into overdue, upcoming and undated by their stated terms", () => {
    const result = metrics([
      payable({ objectId: "late", dueAt: new Date("2026-08-05") }),
      payable({ objectId: "soon", dueAt: new Date("2026-08-30") }),
      payable({ objectId: "untold", dueAt: null }),
    ]);

    expect(result.overduePayableUnits).toBe(100_00n);
    expect(result.upcomingPayableUnits).toBe(100_00n);
    expect(result.undatedPayableUnits).toBe(100_00n);
  });

  it("the three parts sum to openPayableExposure — the published total does not change meaning", () => {
    const result = metrics([
      payable({ objectId: "late", dueAt: new Date("2026-08-05") }),
      payable({ objectId: "soon", dueAt: new Date("2026-08-30") }),
      payable({ objectId: "untold", dueAt: null }),
    ]);

    expect(
      result.overduePayableUnits + result.upcomingPayableUnits + result.undatedPayableUnits,
    ).toBe(result.openPayableExposureUnits);
  });

  it("an obligation with no stated terms never lands in overdue, however old it is", () => {
    // Originated a year ago and never settled. Age is not lateness: nothing ever said when it was
    // due, so the book has no ground to call it late.
    const result = metrics([
      payable({
        objectId: "ancient",
        dueAt: null,
        originatedAt: new Date("2025-01-01"),
        createdAt: new Date("2025-01-01"),
      }),
    ]);

    expect(result.overduePayableUnits).toBe(0n);
    expect(result.undatedPayableUnits).toBe(100_00n);
  });

  it("a settled obligation is in none of the three: a paid debt cannot be late", () => {
    const result = metrics([
      payable({ objectId: "paid", dueAt: new Date("2026-08-05"), totalSettledUnits: 100_00n }),
    ]);

    expect(result.overduePayableUnits).toBe(0n);
    expect(result.upcomingPayableUnits).toBe(0n);
    expect(result.undatedPayableUnits).toBe(0n);
  });

  it("counts only the part still outstanding on a partially-settled obligation", () => {
    const result = metrics([
      payable({ objectId: "half", dueAt: new Date("2026-08-05"), totalSettledUnits: 40_00n }),
    ]);

    expect(result.overduePayableUnits).toBe(60_00n);
  });

  it("leaves receivables out entirely — the split is about what Usina owes", () => {
    const result = metrics([
      payable({ objectId: "owed-to-us", objectType: ObjectType.LOAN, dueAt: new Date("2026-08-05") }),
    ]);

    expect(result.overduePayableUnits).toBe(0n);
    expect(result.openExposureUnits).toBe(100_00n);
  });

  it("a position whose origination is unknown stays out: an unknown balance is not summable", () => {
    const result = metrics([
      payable({
        objectId: "orphan",
        dueAt: new Date("2026-08-05"),
        totalOriginatedUnits: 0n,
        hasUnresolvedLineage: true,
      }),
    ]);

    expect(result.overduePayableUnits).toBe(0n);
    expect(result.openPayableExposureUnits).toBe(0n);
  });

  it("the same obligation reads upcoming today and overdue later, with no event in between", () => {
    // Overdue is a reading of the chain at a moment, not a flag stored on the position.
    const agg = payable({ dueAt: new Date("2026-08-20") });

    expect(dueStateOf(agg, NOW)).toBe("upcoming");
    expect(dueStateOf(agg, new Date("2026-09-01T00:00:00Z"))).toBe("overdue");
  });
});
