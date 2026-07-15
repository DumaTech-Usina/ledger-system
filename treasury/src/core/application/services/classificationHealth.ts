import type { PositionItem } from "../dtos/LedgerReadModels";

/**
 * Governance signal for the panel: how much of the book is recorded under the GENERIC/uncategorized
 * outbound tuple, and how old those records are. A generic payment settles a PAYABLE object — the
 * only source of PAYABLE positions today — so `objectType === "payable"` is the uncategorized marker.
 *
 * This is COUNTING and AGE bucketing only: treasury never sums or recomputes Ledger money. It reports
 * position counts and staleness so Finance can watch the uncategorized backlog trend toward zero as
 * dedicated operations (e.g. Payroll) are added. Amounts are shown verbatim elsewhere, never summed.
 */
export const UNCATEGORIZED_OBJECT_TYPE = "payable";
export const AGING_FRESH_MAX_DAYS = 30;
export const AGING_RECENT_MAX_DAYS = 90;

export interface ClassificationHealth {
  /** Positions recorded under the generic tuple, within the scanned window. */
  uncategorizedCount: number;
  /** Positions actually inspected (the fetched window). */
  scannedCount: number;
  /** True total positions reported by the Ledger — the denominator for `sharePercent`. */
  totalPositions: number;
  /** `uncategorizedCount` as an integer percentage of `totalPositions` (0 when there are none). */
  sharePercent: number;
  /** Uncategorized positions bucketed by the age of their last event. */
  aging: { fresh: number; recent: number; stale: number };
  /** Age in days of the oldest uncategorized position, or null when there are none (or ages unknown). */
  oldestDays: number | null;
}

function ageInDays(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const days = Math.floor((now.getTime() - t) / 86_400_000);
  return days < 0 ? 0 : days;
}

/**
 * Pure: derives the classification-health signal from a window of positions and the Ledger's true
 * total. Uncategorized positions whose age is unknown are counted in the total but not in a bucket.
 */
export function computeClassificationHealth(
  positions: PositionItem[],
  totalPositions: number,
  now: Date = new Date(),
): ClassificationHealth {
  const uncategorized = positions.filter((p) => p.objectType === UNCATEGORIZED_OBJECT_TYPE);

  const aging = { fresh: 0, recent: 0, stale: 0 };
  let oldestDays: number | null = null;

  for (const p of uncategorized) {
    const age = ageInDays(p.lastEventAt, now);
    if (age === null) continue;
    if (oldestDays === null || age > oldestDays) oldestDays = age;
    if (age <= AGING_FRESH_MAX_DAYS) aging.fresh++;
    else if (age <= AGING_RECENT_MAX_DAYS) aging.recent++;
    else aging.stale++;
  }

  const sharePercent =
    totalPositions > 0 ? Math.round((uncategorized.length / totalPositions) * 100) : 0;

  return {
    uncategorizedCount: uncategorized.length,
    scannedCount: positions.length,
    totalPositions,
    sharePercent,
    aging,
    oldestDays,
  };
}
