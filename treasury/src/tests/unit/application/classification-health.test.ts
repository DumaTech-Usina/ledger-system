import { describe, it, expect } from "vitest";
import { computeClassificationHealth } from "../../../core/application/services/classificationHealth";
import type { PositionItem } from "../../../core/application/dtos/LedgerReadModels";

const now = new Date("2026-07-15T00:00:00.000Z");

function pos(over: Partial<PositionItem>): PositionItem {
  return {
    objectId: "o",
    objectType: "payable",
    status: "open",
    outcome: "pending",
    currency: "BRL",
    totalOriginated: "0.00",
    openBalance: "0.00",
    eventCount: 1,
    lastEventAt: "2026-07-10T00:00:00.000Z",
    ...over,
  };
}

describe("computeClassificationHealth", () => {
  it("reports zero when there are no positions", () => {
    expect(computeClassificationHealth([], 0, now)).toEqual({
      uncategorizedCount: 0,
      scannedCount: 0,
      totalPositions: 0,
      sharePercent: 0,
      aging: { fresh: 0, recent: 0, stale: 0 },
      oldestDays: null,
    });
  });

  it("counts only payable positions, buckets by age, and shares against the true total", () => {
    const positions = [
      pos({ objectType: "payable", lastEventAt: "2026-07-10T00:00:00.000Z" }), // 5d  → fresh
      pos({ objectType: "payroll", lastEventAt: "2026-07-01T00:00:00.000Z" }), // categorized → ignored
      pos({ objectType: "payable", lastEventAt: "2026-05-01T00:00:00.000Z" }), // 75d → recent
      pos({ objectType: "payable", lastEventAt: "2026-01-01T00:00:00.000Z" }), // 195d → stale
    ];
    const h = computeClassificationHealth(positions, 8, now);
    expect(h.uncategorizedCount).toBe(3);
    expect(h.scannedCount).toBe(4);
    expect(h.totalPositions).toBe(8);
    expect(h.sharePercent).toBe(38); // 3/8 = 37.5 → 38
    expect(h.aging).toEqual({ fresh: 1, recent: 1, stale: 1 });
    expect(h.oldestDays).toBe(195);
  });

  it("counts a payable with unknown age in the total but not in any bucket", () => {
    const h = computeClassificationHealth([pos({ objectType: "payable", lastEventAt: null })], 1, now);
    expect(h.uncategorizedCount).toBe(1);
    expect(h.aging).toEqual({ fresh: 0, recent: 0, stale: 0 });
    expect(h.oldestDays).toBeNull();
  });
});
