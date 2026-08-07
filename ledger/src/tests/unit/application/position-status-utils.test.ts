import { describe, it, expect } from "vitest";
import {
  computeCapitalMetrics,
  derivePositionStatus,
  openBalanceUnitsOf,
} from "../../../core/application/dtos/positionUtils";
import { PositionAggregate } from "../../../core/application/dtos/PositionAggregate";
import { ObjectType } from "../../../core/domain/enums/ObjectType";

// ── Fixture ───────────────────────────────────────────────────────────────────

function makeAggregate(
  overrides: Partial<PositionAggregate> = {},
): PositionAggregate {
  return {
    objectId: "obj-test",
    objectType: ObjectType.COMMISSION_RECEIVABLE,
    currency: "BRL",
    totalOriginatedUnits: 0n,
    totalSettledUnits: 0n,
    totalAdjustedUnits: 0n,
    cashRecoveredUnits: 0n,
    nonCashClosedUnits: 0n,
    refCashInUnits: 0n,
    refCashOutUnits: 0n,
    hasReversal: false,
    hasUnresolvedLineage: false,
    eventCount: 1,
    lastEventAt: new Date("2024-01-01"),
    originatedAt: new Date("2024-01-01"),
    createdAt: new Date("2024-01-01"),
    dueAt: null,
    ...overrides,
  };
}

// ── derivePositionStatus ──────────────────────────────────────────────────────

describe("derivePositionStatus — classifying the lifecycle state of a commission position", () => {
  it("a position that has been reversed is always 'reversed', regardless of how much was settled — a reversal supersedes all other state", () => {
    const agg = makeAggregate({
      hasReversal: true,
      totalOriginatedUnits: 1000n,
      totalSettledUnits: 1000n,
    });
    expect(derivePositionStatus(agg)).toBe("reversed");
  });

  it("a position with nothing originated and no reversal is 'open' — it was registered but no financial obligation has been recorded yet", () => {
    const agg = makeAggregate({ totalOriginatedUnits: 0n });
    expect(derivePositionStatus(agg)).toBe("open");
  });

  it("a position fully covered by settlements and adjustments combined is 'fully_settled' — the obligation has been completely discharged", () => {
    const agg = makeAggregate({
      totalOriginatedUnits: 1000n,
      totalSettledUnits: 600n,
      totalAdjustedUnits: 400n,
    });
    expect(derivePositionStatus(agg)).toBe("fully_settled");
  });

  it("a position where settlements alone exactly equal the originated amount is 'fully_settled' — exact settlement counts as fully closed", () => {
    const agg = makeAggregate({
      totalOriginatedUnits: 500n,
      totalSettledUnits: 500n,
      totalAdjustedUnits: 0n,
    });
    expect(derivePositionStatus(agg)).toBe("fully_settled");
  });

  it("a position where settlements exceed the originated amount is still 'fully_settled' — an over-settlement is closed, not a new category", () => {
    const agg = makeAggregate({
      totalOriginatedUnits: 500n,
      totalSettledUnits: 600n,
      totalAdjustedUnits: 0n,
    });
    expect(derivePositionStatus(agg)).toBe("fully_settled");
  });

  it("a position with some closure but not enough to cover the full originated amount is 'partially_settled' — the obligation is actively being worked down", () => {
    const agg = makeAggregate({
      totalOriginatedUnits: 1000n,
      totalSettledUnits: 300n,
      totalAdjustedUnits: 100n,
    });
    expect(derivePositionStatus(agg)).toBe("partially_settled");
  });

  it("a position originated but with zero settlements and zero adjustments is 'open' — the obligation has been named but not yet addressed", () => {
    const agg = makeAggregate({
      totalOriginatedUnits: 800n,
      totalSettledUnits: 0n,
      totalAdjustedUnits: 0n,
    });
    expect(derivePositionStatus(agg)).toBe("open");
  });
});

// ── openBalanceUnitsOf ────────────────────────────────────────────────────────

describe("openBalanceUnitsOf — calculating how much of a commission obligation remains unclosed", () => {
  it("when settlements plus adjustments fully cover the originated amount, the open balance is zero — nothing remains outstanding", () => {
    const agg = makeAggregate({
      totalOriginatedUnits: 1000n,
      totalSettledUnits: 700n,
      totalAdjustedUnits: 300n,
    });
    expect(openBalanceUnitsOf(agg)).toBe(0n);
  });

  it("when total closure exceeds the originated amount, the open balance is still zero — over-settlement creates no negative balance on the position", () => {
    const agg = makeAggregate({
      totalOriginatedUnits: 500n,
      totalSettledUnits: 600n,
      totalAdjustedUnits: 0n,
    });
    expect(openBalanceUnitsOf(agg)).toBe(0n);
  });

  it("when the position is partially settled, the open balance is the difference between what was originated and what has been closed so far", () => {
    const agg = makeAggregate({
      totalOriginatedUnits: 1000n,
      totalSettledUnits: 300n,
      totalAdjustedUnits: 100n,
    });
    expect(openBalanceUnitsOf(agg)).toBe(600n);
  });

  it("a position with nothing originated has zero open balance — there is no outstanding obligation to measure", () => {
    const agg = makeAggregate({
      totalOriginatedUnits: 0n,
      totalSettledUnits: 0n,
      totalAdjustedUnits: 0n,
    });
    expect(openBalanceUnitsOf(agg)).toBe(0n);
  });

  it("a fully open position with no closures at all has an open balance equal to the full originated amount — the entire obligation is still outstanding", () => {
    const agg = makeAggregate({
      totalOriginatedUnits: 800n,
      totalSettledUnits: 0n,
      totalAdjustedUnits: 0n,
    });
    expect(openBalanceUnitsOf(agg)).toBe(800n);
  });
});

// ── unknown origination ───────────────────────────────────────────────────────

describe("an unknown origination is not an origination of zero", () => {
  /** The orphan: an event declared its lineage unresolved and nothing originated the object. */
  const orphan = () =>
    makeAggregate({
      hasUnresolvedLineage: true,
      totalOriginatedUnits: 0n,
      totalSettledUnits: 700n,
      cashRecoveredUnits: 700n,
      originatedAt: null,
    });

  it("classifies as 'unknown_origin', not as 'open' — the position does carry a settlement", () => {
    expect(derivePositionStatus(orphan())).toBe("unknown_origin");
  });

  it("reports the open balance as unknown, never as zero", () => {
    expect(openBalanceUnitsOf(orphan())).toBeNull();
  });

  it("a reversal still supersedes an unknown origination", () => {
    expect(derivePositionStatus(makeAggregate({ hasUnresolvedLineage: true, hasReversal: true }))).toBe("reversed");
  });

  it("once an origination IS on record, the position is measurable again even if an orphan event exists", () => {
    const agg = makeAggregate({
      hasUnresolvedLineage: true,
      totalOriginatedUnits: 1000n,
      totalSettledUnits: 400n,
    });
    expect(derivePositionStatus(agg)).toBe("partially_settled");
    expect(openBalanceUnitsOf(agg)).toBe(600n);
  });

  it("REGRESSION GUARD — nothing originated and nothing claimed stays 'open' with a zero balance (cash-basis payable)", () => {
    const agg = makeAggregate({ hasUnresolvedLineage: false, totalOriginatedUnits: 0n, totalSettledUnits: 1500n });
    expect(derivePositionStatus(agg)).toBe("open");
    expect(openBalanceUnitsOf(agg)).toBe(0n);
  });
});

// ── computeCapitalMetrics ─────────────────────────────────────────────────────

describe("computeCapitalMetrics — keeping what is owed TO Usina apart from what it owes", () => {
  const LONG_AGO = new Date("2020-01-01");
  const cutoff = new Date("2024-06-01").getTime();

  it("an obligation Usina owes counts as payable exposure, never as open exposure", () => {
    const obligation = makeAggregate({
      objectType: ObjectType.PAYROLL,
      totalOriginatedUnits: 4500000n,
      totalSettledUnits: 0n,
    });

    const m = computeCapitalMetrics([obligation], "BRL", cutoff);

    expect(m.openPayableExposureUnits).toBe(4500000n);
    expect(m.openExposureUnits).toBe(0n);
  });

  it("an unpaid obligation is never capital at risk — the risk of it is the creditor's, not Usina's", () => {
    const obligation = makeAggregate({
      objectType: ObjectType.PAYROLL,
      totalOriginatedUnits: 4500000n,
      totalSettledUnits: 0n,
      originatedAt: LONG_AGO,
    });

    // The same shape in a receivable type WOULD be capital at risk, which is the point of the guard.
    const receivable = makeAggregate({
      objectType: ObjectType.ADVANCE,
      totalOriginatedUnits: 4500000n,
      totalSettledUnits: 0n,
      originatedAt: LONG_AGO,
    });

    expect(computeCapitalMetrics([obligation], "BRL", cutoff).capitalAtRiskUnits).toBe(0n);
    expect(computeCapitalMetrics([receivable], "BRL", cutoff).capitalAtRiskUnits).toBe(4500000n);
  });

  it("the two exposures are reported separately and are never netted against each other", () => {
    const m = computeCapitalMetrics(
      [
        makeAggregate({ objectId: "a", objectType: ObjectType.ADVANCE, totalOriginatedUnits: 1000n }),
        makeAggregate({ objectId: "b", objectType: ObjectType.PAYROLL, totalOriginatedUnits: 1000n }),
        makeAggregate({ objectId: "c", objectType: ObjectType.TAX,     totalOriginatedUnits: 500n }),
      ],
      "BRL",
      cutoff,
    );

    expect(m.openExposureUnits).toBe(1000n);
    expect(m.openPayableExposureUnits).toBe(1500n);
  });

  it("REGRESSION GUARD — a paid-off obligation stops counting as payable exposure", () => {
    const settled = makeAggregate({
      objectType: ObjectType.PAYROLL,
      totalOriginatedUnits: 4500000n,
      totalSettledUnits: 4500000n,
    });
    expect(computeCapitalMetrics([settled], "BRL", cutoff).openPayableExposureUnits).toBe(0n);
  });

  it("REGRESSION GUARD — an obligation whose origination is unknown is left out of BOTH totals, never counted as zero", () => {
    const unknown = makeAggregate({
      objectType: ObjectType.PAYROLL,
      hasUnresolvedLineage: true,
      totalOriginatedUnits: 0n,
      totalSettledUnits: 700n,
    });
    const m = computeCapitalMetrics([unknown], "BRL", cutoff);
    expect(m.openPayableExposureUnits).toBe(0n);
    expect(m.openExposureUnits).toBe(0n);
  });
});
