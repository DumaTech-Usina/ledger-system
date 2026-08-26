import { ClearFiltersButton } from "@/components/ClearFiltersButton";
import { DateRangePicker } from "@/components/DateRangePicker";
import { Modal } from "@/components/Modal";
import { MultiSelectDropdown } from "@/components/MultiSelectDropdown";
import { Pagination } from "@/components/Pagination";
import { Select } from "@/components/Select";
import { PositionsTable } from "@/features/dashboard/PositionsTable";
import { OBJECT_TYPES, POSITION_OUTCOMES, POSITION_STATUSES } from "@/features/dashboard/vocabulary";
import type { AdoptedIntent } from "@/features/operations/useConversation";
import { usePartyPositions, type PartyPositionsFilters } from "@/screens-concept/usePartyPositions";
import type { PartySummary } from "@/screens-concept/partiesApi";
import { formatTemplate, useLanguage } from "@/i18n/i18n";

/**
 * Status / type / result / period / sort — the exact same filter set the Positions screen offers,
 * minus the party field itself: this modal already IS that filter, fixed to one counterparty.
 */
function PartyPositionsFilterBar({
  filters,
  updateFilters,
  clearFilters,
}: {
  filters: PartyPositionsFilters;
  updateFilters: (patch: Partial<PartyPositionsFilters>) => void;
  clearFilters: () => void;
}) {
  const { t } = useLanguage();

  const hasActiveFilters =
    filters.status.length > 0 ||
    filters.objectType.length > 0 ||
    filters.outcome !== "" ||
    filters.from !== "" ||
    filters.to !== "";

  return (
    <div className="flex flex-wrap items-end gap-4 border-b border-line px-5 py-4">
      <MultiSelectDropdown
        label={t.filters.status}
        placeholder={t.filters.all}
        selectedLabel={(count) => formatTemplate(t.filters.selectedCount, { count })}
        options={POSITION_STATUSES.map((s) => ({ value: s, label: t.positionStatus[s] ?? s }))}
        selected={filters.status}
        onChange={(values) => updateFilters({ status: values })}
        className="min-w-40"
      />
      <MultiSelectDropdown
        label={t.filters.objectType}
        placeholder={t.filters.all}
        selectedLabel={(count) => formatTemplate(t.filters.selectedCount, { count })}
        options={OBJECT_TYPES.map((o) => ({ value: o, label: t.objectType[o] ?? o }))}
        selected={filters.objectType}
        onChange={(values) => updateFilters({ objectType: values })}
        className="min-w-40"
      />
      <Select
        label={t.filters.outcome}
        value={filters.outcome}
        onChange={(value) => updateFilters({ outcome: value })}
        options={[
          { value: "", label: t.filters.allOutcomes },
          ...POSITION_OUTCOMES.map((o) => ({ value: o, label: t.positionOutcome[o] ?? o })),
        ]}
        className="min-w-40"
      />
      <DateRangePicker
        from={filters.from}
        to={filters.to}
        onChange={({ from, to }) => updateFilters({ from, to })}
      />
      <Select
        label={t.filters.sortBy}
        value={filters.sortBy}
        onChange={(value) => updateFilters({ sortBy: value })}
        options={[
          { value: "createdAt", label: t.filters.sortCreatedAt },
          { value: "dueAt", label: t.filters.sortDueAt },
        ]}
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
        <ClearFiltersButton onClick={clearFilters} />
      )}
    </div>
  );
}

/**
 * Every financial position this one counterparty is involved in. Reuses `PositionsTable` wholesale —
 * including its own "eye" action, which opens the identical Summary/Lifecycle detail modal the
 * Positions screen uses — so a position opened from here looks exactly like one opened from there.
 */
export function CounterpartyPositionsModal({
  party,
  canRectify = false,
  onOperationStarted,
  onClose,
}: {
  party: PartySummary;
  canRectify?: boolean;
  onOperationStarted?: (intent: AdoptedIntent) => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const { page, setPage, filters, updateFilters, clearFilters, result, partyNames, loading } = usePartyPositions(
    party.partyId,
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={formatTemplate(t.counterparties.positionsModalTitle, { name: party.displayName })}
      closeLabel={t.common.close}
      className="max-w-6xl"
    >
      <PartyPositionsFilterBar filters={filters} updateFilters={updateFilters} clearFilters={clearFilters} />
      {loading ? (
        <p className="px-5 py-6 text-sm text-muted">{t.common.loading}</p>
      ) : !result ? (
        <p className="px-5 py-6 text-sm text-muted">{t.positions.listUnavailable}</p>
      ) : (
        <>
          <PositionsTable
            positions={result.data}
            // Only a fallback for a row missing its own `currency` — every position already carries
            // one, so this is reached rarely; there is no book-wide "the" currency to pass instead
            // here the way the Positions screen has one from its own cash-position read.
            currency={result.data[0]?.currency ?? "BRL"}
            canRectify={canRectify}
            onOperationStarted={onOperationStarted}
            paginate={false}
            showParties
            selectedParties={[party.partyId]}
            partyNames={partyNames}
          />
          <Pagination page={page} totalPages={result.totalPages} onPageChange={setPage} />
          <p className="px-5 pb-4 text-[12px] text-muted">
            {formatTemplate(t.positions.total, { count: result.total })}
          </p>
        </>
      )}
    </Modal>
  );
}
