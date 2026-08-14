import { useState } from "react";
import { Card } from "@/components/Card";
import { ClearFiltersButton } from "@/components/ClearFiltersButton";
import { Input } from "@/components/Input";
import { Pagination } from "@/components/Pagination";
import { Select } from "@/components/Select";
import { MovementsTable } from "@/features/dashboard/MovementsTable";
import { useMovementsPage } from "@/features/dashboard/useMovementsPage";
import { CASH_EFFECTS, MOVEMENT_SORT_KEYS } from "@/features/dashboard/vocabulary";
import { formatTemplate, useLanguage } from "@/i18n/i18n";

/**
 * The book's cash movements — the real listing behind the "recent" slice `/overview` carries,
 * paged, filtered and sorted by the Ledger itself (`GET /api/dashboard/movements`).
 *
 * The period is owned by the Dashboard page, not by this section: cards, chart and this listing
 * read the same window, so there is exactly one `from`/`to` on the page rather than one per block
 * that could silently disagree. Direction, counterparty and sort stay local — they only ever
 * narrow this one list.
 *
 * No running-balance column here, unlike the summary drill-downs elsewhere on this page: a balance
 * only means something over a complete, fixed-order run of movements, and this list can be
 * filtered to one direction or one party and re-sorted by the reader — either of which would make
 * "the balance right after this row" a number that does not correspond to anything.
 *
 * `counterparty` shows the raw party id: this route does not resolve display names the way
 * `/overview` does (see `treasury_api_reference.md` §3.5/§7), and inventing one from a page that
 * happens to have it cached would be a label this list cannot support for every row.
 */
export function MovementsSection({
  currency,
  period,
}: {
  currency: string;
  period: { from: string; to: string };
}) {
  const { t } = useLanguage();
  const { page, setPage, filters, updateFilters, clearFilters, result, loading } = useMovementsPage(period);
  const [partyDraft, setPartyDraft] = useState(filters.partyId);

  const commitParty = () => {
    if (partyDraft.trim() !== filters.partyId) updateFilters({ partyId: partyDraft.trim() });
  };

  const hasActiveFilters = filters.effect !== "" || filters.partyId !== "";

  return (
    <section className="space-y-4">
      <h3 className="font-display text-[15px] font-semibold text-ink">{t.dashboard.recentMovements}</h3>
      <Card padding="none">
        <div className="flex flex-wrap items-end gap-4 border-b border-line px-5 py-4">
          <Select
            label={t.filters.effect}
            value={filters.effect}
            onChange={(value) => updateFilters({ effect: value })}
            options={[
              { value: "", label: t.filters.allEffects },
              ...CASH_EFFECTS.map((e) => ({ value: e, label: t.cashEffect[e] ?? e })),
            ]}
            className="min-w-36"
          />
          <Input
            label={t.filters.party}
            placeholder={t.filters.partyPlaceholder}
            value={partyDraft}
            onChange={(event) => setPartyDraft(event.target.value)}
            onBlur={commitParty}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitParty();
              }
            }}
            className="min-w-48"
          />
          <Select
            label={t.filters.sortBy}
            value={filters.sortBy}
            onChange={(value) => updateFilters({ sortBy: value })}
            options={MOVEMENT_SORT_KEYS.map((key) => ({
              value: key,
              label: key === "occurredAt" ? t.filters.sortOccurredAt : t.filters.sortRecordedAt,
            }))}
          />
          <Select
            label={t.filters.sortOrder}
            value={filters.sortOrder}
            onChange={(value) => updateFilters({ sortOrder: value })}
            options={[
              { value: "DESC", label: t.filters.sortDesc },
              { value: "ASC", label: t.filters.sortAsc },
            ]}
          />
          {hasActiveFilters && (
            <ClearFiltersButton
              onClick={() => {
                setPartyDraft("");
                clearFilters();
              }}
            />
          )}
        </div>

        {loading ? (
          <p className="px-5 py-6 text-sm text-muted">{t.common.loading}</p>
        ) : !result ? (
          <p className="px-5 py-6 text-sm text-muted">{t.dashboard.movementsUnavailable}</p>
        ) : (
          <>
            {/* Paged and filtered by the Ledger — the table must not slice a page again. */}
            <MovementsTable movements={result.items} currency={currency} paginate={false} />
            <Pagination page={page} totalPages={result.totalPages ?? 1} onPageChange={setPage} />
            {result.total != null && (
              <p className="px-5 pb-4 text-[12px] text-muted">
                {formatTemplate(t.dashboard.movementsTotal, { count: result.total })}
              </p>
            )}
          </>
        )}
      </Card>
    </section>
  );
}
