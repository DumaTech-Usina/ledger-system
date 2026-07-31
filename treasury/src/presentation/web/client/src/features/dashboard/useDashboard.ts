import { useEffect, useState } from "react";
import { dashboardApi } from "@/features/dashboard/dashboardApi";
import type { TreasuryDashboard } from "@/types/dashboard";

const UNAVAILABLE: TreasuryDashboard = {
  available: false,
  cashPosition: null,
  movements: null,
  positions: null,
  classificationHealth: null,
};

export function useDashboard() {
  const [data, setData] = useState<TreasuryDashboard | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    dashboardApi.overview().then(({ ok, data: body }) => {
      if (!cancelled) setData(ok ? body : UNAVAILABLE);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading: data === null };
}
