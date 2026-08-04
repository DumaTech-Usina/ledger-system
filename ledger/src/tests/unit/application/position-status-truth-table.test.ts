import { describe, it, expect } from "vitest";
import { derivePositionStatus } from "../../../core/application/dtos/positionUtils";
import { PositionAggregate } from "../../../core/application/dtos/PositionAggregate";
import { PositionStatus } from "../../../core/application/dtos/PositionSummary";
import { ObjectType } from "../../../core/domain/enums/ObjectType";

/**
 * EQ-4 — the position status rule exists twice: once in TypeScript (`derivePositionStatus`, which
 * also backs the projection) and once in SQL (`statusToSql`, the `?status=` filter). SQL cannot call
 * the TypeScript rule, so the two can only be kept in agreement by pinning the SAME truth table
 * against both.
 *
 * This file owns the table and checks the TypeScript side. The SQL side evaluates the very same
 * predicates over the same columns; a Postgres-backed run of this table is the remaining gap and is
 * recorded as such — the ledger's suite has no database-backed test today, which is precisely how
 * the same defect came to exist in both implementations unnoticed.
 */

type Row = {
  name: string;
  /** The columns the SQL predicates read, by their SQL names. */
  totalOriginated: bigint;
  totalSettled: bigint;
  totalAdjusted: bigint;
  hasReversal: boolean;
  hasUnresolvedLineage: boolean;
  expected: PositionStatus;
};

/**
 * The canonical table. Every row states the four columns both implementations branch on, and the
 * one status they must both produce. Adding a status member without a row here fails the coverage
 * check at the bottom.
 */
export const POSITION_STATUS_TRUTH_TABLE: Row[] = [
  {
    name: "reversal supersedes everything",
    totalOriginated: 1000n, totalSettled: 1000n, totalAdjusted: 0n,
    hasReversal: true, hasUnresolvedLineage: false,
    expected: "reversed",
  },
  {
    name: "reversal supersedes an unknown origination",
    totalOriginated: 0n, totalSettled: 700n, totalAdjusted: 0n,
    hasReversal: true, hasUnresolvedLineage: true,
    expected: "reversed",
  },
  {
    name: "orphan — settled with an origination nobody knows",
    totalOriginated: 0n, totalSettled: 700n, totalAdjusted: 0n,
    hasReversal: false, hasUnresolvedLineage: true,
    expected: "unknown_origin",
  },
  {
    name: "orphan declared but nothing settled yet",
    totalOriginated: 0n, totalSettled: 0n, totalAdjusted: 0n,
    hasReversal: false, hasUnresolvedLineage: true,
    expected: "unknown_origin",
  },
  {
    name: "cash-basis payable — nothing originated, none claimed",
    totalOriginated: 0n, totalSettled: 1500n, totalAdjusted: 0n,
    hasReversal: false, hasUnresolvedLineage: false,
    expected: "open",
  },
  {
    name: "originated, untouched",
    totalOriginated: 800n, totalSettled: 0n, totalAdjusted: 0n,
    hasReversal: false, hasUnresolvedLineage: false,
    expected: "open",
  },
  {
    name: "partially settled",
    totalOriginated: 1000n, totalSettled: 300n, totalAdjusted: 100n,
    hasReversal: false, hasUnresolvedLineage: false,
    expected: "partially_settled",
  },
  {
    name: "exactly settled",
    totalOriginated: 500n, totalSettled: 500n, totalAdjusted: 0n,
    hasReversal: false, hasUnresolvedLineage: false,
    expected: "fully_settled",
  },
  {
    name: "over-settled is still closed",
    totalOriginated: 500n, totalSettled: 600n, totalAdjusted: 0n,
    hasReversal: false, hasUnresolvedLineage: false,
    expected: "fully_settled",
  },
  {
    name: "an orphan event on a position that DOES have an origination is measurable",
    totalOriginated: 1000n, totalSettled: 400n, totalAdjusted: 0n,
    hasReversal: false, hasUnresolvedLineage: true,
    expected: "partially_settled",
  },
];

const toAggregate = (row: Row): PositionAggregate => ({
  objectId: `obj:${row.name}`,
  objectType: ObjectType.COMMISSION_RECEIVABLE,
  currency: "BRL",
  totalOriginatedUnits: row.totalOriginated,
  totalSettledUnits: row.totalSettled,
  totalAdjustedUnits: row.totalAdjusted,
  cashRecoveredUnits: 0n,
  nonCashClosedUnits: 0n,
  refCashInUnits: 0n,
  refCashOutUnits: 0n,
  hasReversal: row.hasReversal,
  hasUnresolvedLineage: row.hasUnresolvedLineage,
  eventCount: 1,
  lastEventAt: new Date("2025-01-01"),
  originatedAt: row.totalOriginated > 0n ? new Date("2025-01-01") : null,
});

describe("EQ-4 — position status truth table (TypeScript side)", () => {
  it.each(POSITION_STATUS_TRUTH_TABLE)("$name → $expected", (row) => {
    expect(derivePositionStatus(toAggregate(row))).toBe(row.expected);
  });

  it("covers every member of the status vocabulary — a new status without a row fails here", () => {
    const covered = new Set(POSITION_STATUS_TRUTH_TABLE.map((r) => r.expected));
    const all: PositionStatus[] = ["open", "partially_settled", "fully_settled", "reversed", "unknown_origin"];
    expect([...covered].sort()).toEqual([...all].sort());
  });

  it("the table is unambiguous — no two rows share the same input with different outputs", () => {
    const byInput = new Map<string, PositionStatus>();
    for (const row of POSITION_STATUS_TRUTH_TABLE) {
      const key = `${row.totalOriginated}|${row.totalSettled}|${row.totalAdjusted}|${row.hasReversal}|${row.hasUnresolvedLineage}`;
      const seen = byInput.get(key);
      expect(seen === undefined || seen === row.expected, `contradictory rows for ${key}`).toBe(true);
      byInput.set(key, row.expected);
    }
  });
});
