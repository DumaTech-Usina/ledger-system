import { useEffect, useState } from "react";
import { dashboardApi } from "@/features/dashboard/dashboardApi";
import type { CashMovementsPage } from "@/types/dashboard";

const PAGE_SIZE = 20;

export interface MovementsFilters {
  effect: string;
  /** Free-typed party id — the Ledger has no name search to offer instead. */
  partyId: string;
  sortBy: string;
  sortOrder: string;
}

export const emptyMovementsFilters: MovementsFilters = {
  effect: "",
  partyId: "",
  /** Matches the Ledger's own default — spelled out so the sort control has a real value to show. */
  sortBy: "occurredAt",
  sortOrder: "DESC",
};

/**
 * One page of the book's cash movements, paged and filtered by the Ledger. Uses the Ledger's
 * numbered-page mode rather than its cursor: this screen is "page N of M" (it has a `Pagination`
 * control with page numbers), and that is exactly the case the API reference says the numbered mode
 * is for. The keyset mode is for a "load more" feed, which this is not.
 *
 * The period is the caller's, not this hook's own state — the Dashboard page runs one period across
 * its cards, chart and this listing, and a second copy of `from`/`to` living here could drift from it.
 */
export function useMovementsPage(period: { from: string; to: string }) {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<MovementsFilters>(emptyMovementsFilters);
  const [result, setResult] = useState<CashMovementsPage | null>(null);
  const [loading, setLoading] = useState(true);

  function updateFilters(patch: Partial<MovementsFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }

  function clearFilters() {
    setFilters(emptyMovementsFilters);
    setPage(1);
  }

  // The period is external state; a change to it is as much a reason to restart at page 1 as a
  // filter change is — the page a previous window was on may not exist in the new one.
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period.from, period.to]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    dashboardApi
      .movements({
        page,
        limit: PAGE_SIZE,
        effect: filters.effect,
        partyId: filters.partyId,
        from: period.from,
        to: period.to,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      })
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filters, period.from, period.to]);

  return { page, setPage, filters, updateFilters, clearFilters, result, loading };
}
