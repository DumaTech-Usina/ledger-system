import { useEffect, useState } from "react";
import { dashboardApi } from "@/features/dashboard/dashboardApi";
import type { TreasuryDashboard } from "@/types/dashboard";

const UNAVAILABLE: TreasuryDashboard = {
  available: false,
  cashPosition: null,
  movements: null,
  positions: null,
  movementsHasMore: false,
  partyNames: {},
};

/**
 * Rows per block, raised well past the summary-sized default: this page charts and drills into the
 * movements block for the whole selected period, which the Ledger's usual 8-row summary slice
 * cannot support. Still the Ledger's own cap, never sliced again on this side.
 */
const MOVEMENTS_CHART_LIMIT = 200;

export function useDashboard(period?: { from: string; to: string }) {
  const [data, setData] = useState<TreasuryDashboard | null>(null);
  const from = period?.from;
  const to = period?.to;

  useEffect(() => {
    let cancelled = false;
    setData(null);
    dashboardApi.overview({ from, to, perPage: MOVEMENTS_CHART_LIMIT }).then(({ ok, data: body }) => {
      if (!cancelled) setData(ok ? body : UNAVAILABLE);
    });
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  return { data, loading: data === null };
}
