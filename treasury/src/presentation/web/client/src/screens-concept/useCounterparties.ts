import { useEffect, useMemo, useState } from "react";
import { partiesApi, type PartySummary } from "@/screens-concept/partiesApi";
import { dashboardApi } from "@/features/dashboard/dashboardApi";

const PAGE_SIZE = 10;
/** Matches `ListPositionsUseCase`'s own clamp — the most positions one status-filter fetch can see. */
const STATUS_FILTER_FETCH_LIMIT = 200;

/**
 * The Contrapartes table's data: every registered party, searched and paged client-side (there is
 * no paginated/searchable party-listing endpoint, and the Directory is small enough that fetching it
 * whole is the honest simplest thing to do), plus an optional filter down to counterparties that
 * have at least one position in a given status.
 *
 * The status filter piggybacks on the existing positions endpoint rather than needing new backend
 * surface: it asks for every position in that status (up to the Ledger's own page-size ceiling) and
 * collects the union of `parties` across them. A book with more matching positions than the ceiling
 * is reported as truncated rather than silently missing counterparties past the cutoff.
 */
export function useCounterparties() {
  const [parties, setParties] = useState<PartySummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [statusFilterPartyIds, setStatusFilterPartyIds] = useState<Set<string> | null>(null);
  const [statusFilterLoading, setStatusFilterLoading] = useState(false);
  const [statusFilterTruncated, setStatusFilterTruncated] = useState(false);
  const [page, setPage] = useState(1);

  const load = () => {
    setLoading(true);
    partiesApi.list().then(({ ok, data }) => {
      setParties(ok ? data.parties : []);
      setLoading(false);
    });
  };

  useEffect(load, []);

  useEffect(() => {
    if (!statusFilter) {
      setStatusFilterPartyIds(null);
      setStatusFilterTruncated(false);
      return;
    }
    let cancelled = false;
    setStatusFilterLoading(true);
    dashboardApi
      .positions({ status: [statusFilter], perPage: STATUS_FILTER_FETCH_LIMIT })
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (ok && data.available && data.page) {
          const ids = new Set<string>();
          for (const position of data.page.data) {
            for (const partyId of position.parties ?? []) ids.add(partyId);
          }
          setStatusFilterPartyIds(ids);
          setStatusFilterTruncated(data.page.total > data.page.data.length);
        } else {
          setStatusFilterPartyIds(new Set());
          setStatusFilterTruncated(false);
        }
        setStatusFilterLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setStatusFilterPartyIds(new Set());
          setStatusFilterLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [statusFilter]);

  const filtered = useMemo(() => {
    let list = parties ?? [];
    if (statusFilterPartyIds) list = list.filter((p) => statusFilterPartyIds.has(p.partyId));
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.displayName.toLowerCase().includes(q) ||
          p.partyId.toLowerCase().includes(q) ||
          (p.document ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [parties, statusFilterPartyIds, search]);

  // A new search term or status filter may leave the current page past the end of the new result —
  // never leave the table showing an empty page when rows exist on page 1.
  useEffect(() => {
    setPage(1);
  }, [search, statusFilterPartyIds]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const rename = (partyId: string, displayName: string) => {
    setParties((prev) => (prev ? prev.map((p) => (p.partyId === partyId ? { ...p, displayName } : p)) : prev));
  };

  return {
    loading,
    pageRows,
    filteredCount: filtered.length,
    page,
    setPage,
    totalPages,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    statusFilterLoading,
    statusFilterTruncated,
    /** Applies a rename locally — the rename endpoint already confirmed it server-side. */
    rename,
    reload: load,
  };
}
