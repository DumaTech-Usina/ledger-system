import { useEffect, useState } from "react";
import { dashboardApi } from "@/features/dashboard/dashboardApi";
import type { PositionsPage } from "@/types/dashboard";

export interface PositionsFilters {
  status: string[];
  objectType: string[];
  /** Free-typed party id — the Ledger has no name search to offer instead. */
  partyId: string;
  outcome: string;
  from: string;
  to: string;
  sortBy: string;
  sortOrder: string;
}

export const emptyPositionsFilters: PositionsFilters = {
  status: [],
  objectType: [],
  partyId: "",
  outcome: "",
  from: "",
  to: "",
  /** Matches the Ledger's own default — spelled out so the sort control has a real value to show. */
  sortBy: "createdAt",
  sortOrder: "DESC",
};

/**
 * One page of positions, paged and filtered by the Ledger. The page number and every filter are
 * state here; the slicing is not — asking the Ledger for page N of a given selection is what keeps
 * the list from claiming the book holds only what an overview happened to carry.
 */
export function usePositionsPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<PositionsFilters>(emptyPositionsFilters);
  const [result, setResult] = useState<PositionsPage | null>(null);
  const [selectedParties, setSelectedParties] = useState<string[]>([]);
  const [selfPartyId, setSelfPartyId] = useState("");
  const [partyNames, setPartyNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  /** Any filter change starts back at page 1 — the page the previous selection was on may not exist here. */
  function updateFilters(patch: Partial<PositionsFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }

  function clearFilters() {
    setFilters(emptyPositionsFilters);
    setPage(1);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    dashboardApi
      .positions({
        page,
        status: filters.status,
        objectType: filters.objectType,
        partyId: filters.partyId,
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
          setSelectedParties(data.selectedParties);
          setSelfPartyId(data.selfPartyId);
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
  }, [page, filters]);

  return {
    page,
    setPage,
    filters,
    updateFilters,
    clearFilters,
    result,
    selectedParties,
    selfPartyId,
    partyNames,
    loading,
  };
}
