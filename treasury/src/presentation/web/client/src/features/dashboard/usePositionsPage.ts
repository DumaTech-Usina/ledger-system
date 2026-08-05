import { useEffect, useState } from "react";
import { dashboardApi } from "@/features/dashboard/dashboardApi";
import type { PositionsPage } from "@/types/dashboard";

/**
 * One page of positions, paged by the Ledger. The page number is state here; the slicing is not —
 * asking the Ledger for page N is what keeps the list from claiming the book holds only what an
 * overview happened to carry.
 */
export function usePositionsPage() {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PositionsPage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    dashboardApi
      .positions(page)
      .then(({ ok, data }) => {
        if (cancelled) return;
        setResult(ok && data.available ? data.page : null);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  return { page, setPage, result, loading };
}
