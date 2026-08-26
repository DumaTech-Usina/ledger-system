import { useEffect, useState } from "react";
import { dashboardApi } from "@/features/dashboard/dashboardApi";
import type { PositionsPage } from "@/types/dashboard";

export interface PartyPositionsFilters {
  status: string[];
  objectType: string[];
  outcome: string;
  from: string;
  to: string;
  sortBy: string;
  sortOrder: string;
}

const emptyFilters: PartyPositionsFilters = {
  status: [],
  objectType: [],
  outcome: "",
  from: "",
  to: "",
  sortBy: "createdAt",
  sortOrder: "DESC",
};

/**
 * One counterparty's positions, paged and filtered by the Ledger — the same shape as
 * `usePositionsPage`, minus the `partyId` filter field (it is the one thing this modal never lets
 * the user change, since it is the whole reason the modal is open) plus that same id pinned onto
 * every request instead.
 */
export function usePartyPositions(partyId: string) {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<PartyPositionsFilters>(emptyFilters);
  const [result, setResult] = useState<PositionsPage | null>(null);
  const [partyNames, setPartyNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  function updateFilters(patch: Partial<PartyPositionsFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }

  function clearFilters() {
    setFilters(emptyFilters);
    setPage(1);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    dashboardApi
      .positions({
        page,
        partyId,
        status: filters.status,
        objectType: filters.objectType,
        outcome: filters.outcome,
        from: filters.from,
        to: filters.to,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      })
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (ok && data.available) {
          setResult(data.page);
          setPartyNames(data.partyNames ?? {});
        } else {
          setResult(null);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyId, page, filters]);

  return { page, setPage, filters, updateFilters, clearFilters, result, partyNames, loading };
}
