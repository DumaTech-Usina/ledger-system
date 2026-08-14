import { useEffect, useState } from "react";
import { dashboardApi } from "@/features/dashboard/dashboardApi";
import type { BookExposure } from "@/types/dashboard";

/**
 * The book's economic state, and the Ledger's own fold of cash movements over `period`. `null`
 * after loading means the Ledger could not be reached — which is shown as unavailable, never as
 * zero: a zero exposure and an unknown exposure read as opposite news to whoever is looking.
 */
export function useBookExposure(period?: { from: string; to: string }) {
  const [exposure, setExposure] = useState<BookExposure | null>(null);
  const [loading, setLoading] = useState(true);
  const from = period?.from;
  const to = period?.to;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    dashboardApi
      .exposure({ from, to })
      .then(({ ok, data }) => {
        if (cancelled) return;
        setExposure(ok && data.available ? data.exposure : null);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  return { exposure, loading };
}
