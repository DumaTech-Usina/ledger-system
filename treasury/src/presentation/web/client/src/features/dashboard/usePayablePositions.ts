import { useEffect, useState } from "react";
import { dashboardApi } from "@/features/dashboard/dashboardApi";
import type { PayablePositionsResult } from "@/types/dashboard";

/**
 * The payable positions behind the upcoming/overdue figures.
 *
 * `null` after loading means the Ledger could not be reached — shown as unavailable, never as three
 * empty lists: "nothing is overdue" and "we could not find out" read as opposite news, exactly as
 * they do for exposure.
 */
export function usePayablePositions() {
  const [payables, setPayables] = useState<PayablePositionsResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    dashboardApi
      .payables()
      .then(({ ok, data }) => {
        if (cancelled) return;
        setPayables(ok && data.available ? data : null);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { payables, loading };
}
