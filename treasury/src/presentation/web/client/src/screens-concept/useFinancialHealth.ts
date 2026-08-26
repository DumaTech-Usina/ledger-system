import { useEffect, useState } from "react";
import { dashboardApi } from "@/features/dashboard/dashboardApi";
import { addDays, toISO } from "@/utils/dateRange";
import type { BookExposure, CashPosition, PositionItem } from "@/types/dashboard";

const WINDOW_DAYS = 30;
/** How many open positions are worth fetching to rank locally — the Ledger has no "sort by amount"
 * of its own (only `createdAt`/`dueAt`), so this is the pool the top-N table is chosen from. */
const OPEN_POSITIONS_POOL = 200;

export interface FinancialHealthData {
  /** Present only when the overview could actually be read. */
  cashPosition: CashPosition | null;
  /** Current-state figures (healthScore, capitalAtRisk, overduePayable) — never period-scoped. */
  currentExposure: BookExposure | null;
  /** This window's cash fold, period-scoped. */
  currentPeriodExposure: BookExposure | null;
  /** The window before that, same length — what the current one is compared against. */
  previousPeriodExposure: BookExposure | null;
  /** A pool of open/partially-settled positions to rank by balance — never re-sorted by the caller
   * into anything claiming to be the WHOLE book; see `OPEN_POSITIONS_POOL`. */
  openPositions: PositionItem[];
  partyNames: Record<string, string>;
}

/**
 * Every figure the Saúde Financeira screen reads, fetched once. All five calls already exist on
 * `dashboardApi` — the screen adds no backend surface, it just asks the same endpoints the
 * Dashboard/Positions screens use for a second, earlier window too, so the insight rules have
 * something to compare against.
 */
export function useFinancialHealth() {
  const [data, setData] = useState<FinancialHealthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const today = new Date();
    const currentFrom = toISO(addDays(today, -WINDOW_DAYS));
    const currentTo = toISO(today);
    const previousFrom = toISO(addDays(today, -2 * WINDOW_DAYS));
    const previousTo = currentFrom;

    Promise.all([
      dashboardApi.overview({}),
      dashboardApi.exposure({}),
      dashboardApi.exposure({ from: currentFrom, to: currentTo }),
      dashboardApi.exposure({ from: previousFrom, to: previousTo }),
      dashboardApi.positions({ status: ["open", "partially_settled"], perPage: OPEN_POSITIONS_POOL }),
    ])
      .then(([overview, current, currentPeriod, previousPeriod, positions]) => {
        if (cancelled) return;
        setData({
          cashPosition: overview.ok && overview.data.available ? overview.data.cashPosition : null,
          currentExposure: current.ok && current.data.available ? current.data.exposure : null,
          currentPeriodExposure:
            currentPeriod.ok && currentPeriod.data.available ? currentPeriod.data.exposure : null,
          previousPeriodExposure:
            previousPeriod.ok && previousPeriod.data.available ? previousPeriod.data.exposure : null,
          openPositions: positions.ok && positions.data.available ? (positions.data.page?.data ?? []) : [],
          partyNames: positions.ok && positions.data.available ? positions.data.partyNames : {},
        });
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading };
}
