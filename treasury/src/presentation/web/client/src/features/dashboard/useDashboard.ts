import { useEffect, useState } from "react";
import { dashboardApi } from "@/features/dashboard/dashboardApi";
import type { TreasuryDashboard } from "@/types/dashboard";

const UNAVAILABLE: TreasuryDashboard = {
  available: false,
  cashPosition: null,
  movements: null,
  positions: null,
  classificationHealth: null,
  period: null,
};

export function useDashboard(range?: { from: string | null; to: string | null }) {
  const [data, setData] = useState<TreasuryDashboard | null>(null);
  const from = range?.from ?? null;
  const to = range?.to ?? null;

  useEffect(() => {
    let cancelled = false;
    setData(null);
    dashboardApi.overview({ from, to }).then(({ ok, data: body }) => {
      if (!cancelled) setData(ok ? body : UNAVAILABLE);
    });
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  return { data, loading: data === null };
}
