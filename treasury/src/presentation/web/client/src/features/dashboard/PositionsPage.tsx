import type { AdoptedIntent } from "@/features/operations/useConversation";
import { useState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ClearFiltersButton } from "@/components/ClearFiltersButton";
import { DateRangePicker } from "@/components/DateRangePicker";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { MultiSelectDropdown } from "@/components/MultiSelectDropdown";
import { Select } from "@/components/Select";
import { CompositionList } from "@/features/dashboard/CompositionList";
import { ObjectLifecycleTimeline } from "@/features/dashboard/ObjectLifecycleTimeline";
import { PositionsTable } from "@/features/dashboard/PositionsTable";
import { hasOutstandingBalance } from "@/features/dashboard/lifecycleEngine";
import { Pagination } from "@/components/Pagination";
import { useBookExposure } from "@/features/dashboard/useBookExposure";
import { usePayablePositions } from "@/features/dashboard/usePayablePositions";
import { usePositionsPage } from "@/features/dashboard/usePositionsPage";
import { useDashboard } from "@/features/dashboard/useDashboard";
import { OBJECT_TYPES, POSITION_OUTCOMES, POSITION_STATUSES } from "@/features/dashboard/vocabulary";
import { formatTemplate, useLanguage } from "@/i18n/i18n";
import { formatDate, formatMoney } from "@/utils/format";

/**
 * Opens any position by its id. The overview publishes only the most recent handful, so an object
 * outside that slice is otherwise unreachable — this is the way in until the read API offers a
 * filterable listing.
 */
function OpenPositionById({ canRectify }: { canRectify: boolean }) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState("");
  const [opened, setOpened] = useState<string | null>(null);

  return (
    <>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const objectId = draft.trim();
          if (objectId !== "") setOpened(objectId);
        }}
      >
        <Input
          label={t.dashboard.lifecycle.openByIdLabel}
          placeholder={t.dashboard.lifecycle.openByIdPlaceholder}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="min-w-0 flex-1 sm:min-w-64"
        />
        <Button type="submit" variant="ghost" disabled={draft.trim() === ""}>
          {t.dashboard.lifecycle.openByIdAction}
        </Button>
      </form>

      {opened && (
        <Modal
          open
          onClose={() => setOpened(null)}
          title={t.dashboard.lifecycle.tabLifecycle}
          closeLabel={t.common.close}
          className="max-w-lg"
        >
          {/* No row supplied a type here, so rectifiability is left to the backend to answer. */}
          <ObjectLifecycleTimeline objectId={opened} canRectify={canRectify} />
        </Modal>
      )}
    </>
  );
}

/**
 * The filters and sort behind the "Todas as posições" listing. Every control writes straight into
 * `updateFilters`, which the hook resets to page 1 — the page a previous selection was on may not
 * exist in the new one. The party field is the one exception: it commits on blur/Enter rather than
 * per keystroke, since the Ledger has no name search to narrow it as the caller types.
 */
function PositionsFilterBar({
  filters,
  updateFilters,
  clearFilters,
}: {
  filters: ReturnType<typeof usePositionsPage>["filters"];
  updateFilters: ReturnType<typeof usePositionsPage>["updateFilters"];
  clearFilters: ReturnType<typeof usePositionsPage>["clearFilters"];
}) {
  const { t } = useLanguage();
  const [partyDraft, setPartyDraft] = useState(filters.partyId);

  const commitParty = () => {
    if (partyDraft.trim() !== filters.partyId) updateFilters({ partyId: partyDraft.trim() });
  };

  const hasActiveFilters =
    filters.status.length > 0 ||
    filters.objectType.length > 0 ||
    filters.partyId !== "" ||
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
        <ClearFiltersButton
          onClick={() => {
            setPartyDraft("");
            clearFilters();
          }}
        />
      )}
    </div>
  );
}

/**
 * Economic positions: what a fact left outstanding, not what it moved in cash.
 *
 * Everything here comes from the Ledger's position math — `relation` × `amount`, grouped by object
 * id — which is a different fold over the same events than the one behind the cash screen. The two
 * are not meant to reconcile: a recovered advance moves cash AND closes a position, a payroll moves
 * cash and closes nothing, an accrued commission opens a position and moves no cash at all.
 */
export function PositionsPage({
  canRectify = false,
  onOperationStarted,
}: {
  canRectify?: boolean;
  /** Hands a conversation opened from a position over to the operations page. */
  onOperationStarted?: (intent: AdoptedIntent) => void;
}) {
  const { data, loading } = useDashboard();
  const { exposure } = useBookExposure();
  const { payables } = usePayablePositions();
  const {
    page,
    setPage,
    filters,
    updateFilters,
    clearFilters,
    result: positionsPage,
    selectedParties,
    selfPartyId,
    partyNames,
    loading: listLoading,
  } = usePositionsPage();
  const { t } = useLanguage();
  const [showOutstanding, setShowOutstanding] = useState(false);
  /** Which payable drill-down is open, if any. The three lists share one modal. */
  const [openPayables, setOpenPayables] = useState<"upcoming" | "overdue" | "undated" | null>(null);
  /** Whether the commitments card's composition is open. */
  const [showCommitments, setShowCommitments] = useState(false);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl font-semibold text-ink">{t.positions.heading}</h2>
        <p className="mt-1 text-sm text-muted">{t.positions.subheading}</p>
      </div>

      {loading ? (
        <Card>
          <p className="text-sm text-muted">{t.common.loading}</p>
        </Card>
      ) : !data?.available || !data.cashPosition ? (
        <Card>
          <p className="text-sm text-muted">{t.dashboard.unavailable}</p>
        </Card>
      ) : (
        (() => {
          const cashPosition = data.cashPosition;
          const positions = data.positions ?? [];
          // By balance, not by status — the same measure the figure above this list is computed
          // from. See hasOutstandingBalance for why the two disagree on a cash-basis position.
          const outstanding = positions.filter(hasOutstandingBalance);

          return (
            <>
              <section>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  <Card
                    role="button"
                    tabIndex={0}
                    onClick={() => setShowOutstanding(true)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setShowOutstanding(true);
                      }
                    }}
                    className="transition hover:bg-ink/6 dark:hover:bg-white/8"
                  >
                    <p className="text-[13px] font-semibold text-muted">{t.dashboard.openPositions}</p>
                    <p className="tabular mt-1.5 text-2xl font-semibold text-ink">
                      {formatMoney(cashPosition.openReceivables, cashPosition.currency)}
                    </p>
                  </Card>

                  {/* The Ledger's own reading of the whole book. Absent means it could not be
                      read — shown as such, never as zero, which would read as a healthy book. */}
                  <Card>
                    <p className="text-[13px] font-semibold text-muted">{t.positions.exposure}</p>
                    <p className="tabular mt-1.5 text-2xl font-semibold text-ink">
                      {exposure
                        ? formatMoney(exposure.openExposure, exposure.currency)
                        : t.common.unknown}
                    </p>
                  </Card>

                  <Card>
                    <p className="text-[13px] font-semibold text-muted">{t.positions.capitalAtRisk}</p>
                    <p
                      className={`tabular mt-1.5 text-2xl font-semibold ${
                        exposure && Number(exposure.capitalAtRisk) > 0 ? "text-warn" : "text-ink"
                      }`}
                    >
                      {exposure
                        ? formatMoney(exposure.capitalAtRisk, exposure.currency)
                        : t.common.unknown}
                    </p>
                    <p className="mt-1 text-[11px] text-muted">{t.positions.capitalAtRiskNote}</p>
                  </Card>

                  {/* The total the three cards beside this one split by timing — read here by
                      NATURE instead: how much of what is committed is payroll, tax, service. The
                      two axes are published separately and never crossed, so neither answer can be
                      mistaken for the other. */}
                  <Card
                    role="button"
                    tabIndex={0}
                    onClick={() => setShowCommitments(true)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setShowCommitments(true);
                      }
                    }}
                    className="transition hover:bg-ink/6 dark:hover:bg-white/8"
                  >
                    <p className="text-[13px] font-semibold text-muted">{t.positions.commitments}</p>
                    <p className="tabular mt-1.5 text-2xl font-semibold text-ink">
                      {/* Absent against a Ledger that does not publish it — shown as unknown, never
                          as zero, which would state that nothing is owed. */}
                      {cashPosition.openPayables
                        ? formatMoney(cashPosition.openPayables, cashPosition.currency)
                        : t.common.unknown}
                    </p>
                    <p className="mt-1 text-[11px] text-muted">{t.positions.commitmentsNote}</p>
                  </Card>

                  {/* What is expected to LEAVE the company, split by what the book knows about
                      timing. The figures are the Ledger's own fold over every aggregate; the lists
                      behind them are a separate read, which is why a capped list says so instead of
                      quietly disagreeing with the number above it. */}
                  <Card
                    role="button"
                    tabIndex={0}
                    onClick={() => setOpenPayables("upcoming")}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setOpenPayables("upcoming");
                      }
                    }}
                    className="transition hover:bg-ink/6 dark:hover:bg-white/8"
                  >
                    <p className="text-[13px] font-semibold text-muted">{t.positions.upcomingEntries}</p>
                    <p className="tabular mt-1.5 text-2xl font-semibold text-ink">
                      {exposure
                        ? formatMoney(exposure.upcomingPayable, exposure.currency)
                        : t.common.unknown}
                    </p>
                    <p className="mt-1 text-[11px] text-muted">{t.positions.upcomingEntriesNote}</p>
                  </Card>

                  <Card
                    role="button"
                    tabIndex={0}
                    onClick={() => setOpenPayables("overdue")}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setOpenPayables("overdue");
                      }
                    }}
                    className="transition hover:bg-ink/6 dark:hover:bg-white/8"
                  >
                    <p className="text-[13px] font-semibold text-muted">{t.positions.overdueEntries}</p>
                    <p
                      className={`tabular mt-1.5 text-2xl font-semibold ${
                        exposure && Number(exposure.overduePayable) > 0 ? "text-warn" : "text-ink"
                      }`}
                    >
                      {exposure
                        ? formatMoney(exposure.overduePayable, exposure.currency)
                        : t.common.unknown}
                    </p>
                    <p className="mt-1 text-[11px] text-muted">{t.positions.overdueEntriesNote}</p>
                  </Card>

                  {/* Only shown when there is something in it. An obligation whose document stated no
                      terms belongs to neither card above, and hiding it there would let one of them
                      absorb it silently; showing an empty third card every time would be noise. */}
                  {exposure && Number(exposure.undatedPayable) > 0 && (
                    <Card
                      role="button"
                      tabIndex={0}
                      onClick={() => setOpenPayables("undated")}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setOpenPayables("undated");
                        }
                      }}
                      className="transition hover:bg-ink/6 dark:hover:bg-white/8"
                    >
                      <p className="text-[13px] font-semibold text-muted">{t.positions.undatedEntries}</p>
                      <p className="tabular mt-1.5 text-2xl font-semibold text-ink">
                        {formatMoney(exposure.undatedPayable, exposure.currency)}
                      </p>
                      <p className="mt-1 text-[11px] text-muted">{t.positions.undatedEntriesNote}</p>
                    </Card>
                  )}
                </div>

                <p className="mt-3 text-[13px] text-muted">
                  {formatTemplate(t.dashboard.positionAsOf, { date: formatDate(cashPosition.asOf) })}
                </p>
              </section>

              {/* The composition of what is committed. Its own modal rather than a section inside
                  the timing drill-downs: those answer "when", this answers "of what", and the whole
                  point of publishing the two axes apart is that neither absorbs the other. */}
              <Modal
                open={showCommitments}
                onClose={() => setShowCommitments(false)}
                title={t.positions.commitments}
                closeLabel={t.common.close}
                className="max-w-lg"
              >
                <div className="px-1">
                  <p className="pb-1 text-[12px] font-semibold text-muted">{t.positions.composition}</p>
                  <CompositionList
                    lines={cashPosition.openPayablesByType}
                    currency={cashPosition.currency}
                  />
                </div>
              </Modal>

              <Modal
                open={showOutstanding}
                onClose={() => setShowOutstanding(false)}
                title={t.dashboard.openPositions}
                closeLabel={t.common.close}
                className="max-w-6xl"
              >
                {/* The composition covers the WHOLE book; the table below is the overview's slice.
                    They answer different questions, so the composition is not derived from the rows
                    beneath it — it comes from the Ledger's own fold, like the figure on the card. */}
                <div className="border-b border-line px-1 pb-3">
                  <p className="pb-1 text-[12px] font-semibold text-muted">{t.positions.composition}</p>
                  <CompositionList
                    lines={cashPosition.openReceivablesByType}
                    currency={cashPosition.currency}
                  />
                </div>
                <PositionsTable
                  positions={outstanding}
                  currency={cashPosition.currency}
                  canRectify={canRectify}
                  onOperationStarted={onOperationStarted}
                />
              </Modal>

              {/* One modal for the three payable drill-downs — same table, same affordances as the
                  open-positions one above, with the due-date column that gives these three lists
                  their meaning. */}
              <Modal
                open={openPayables !== null}
                onClose={() => setOpenPayables(null)}
                title={
                  openPayables === "overdue"
                    ? t.positions.overdueEntries
                    : openPayables === "undated"
                      ? t.positions.undatedEntries
                      : t.positions.upcomingEntries
                }
                closeLabel={t.common.close}
                className="max-w-6xl"
              >
                {!payables ? (
                  <p className="px-1 py-4 text-sm text-muted">{t.positions.listUnavailable}</p>
                ) : (
                  <>
                    {payables.truncated && (
                      <p className="px-1 pb-3 text-[12px] text-muted">{t.positions.truncatedList}</p>
                    )}
                    <PositionsTable
                      positions={
                        openPayables === "overdue"
                          ? payables.overdue
                          : openPayables === "undated"
                            ? payables.undated
                            : payables.upcoming
                      }
                      currency={cashPosition.currency}
                      canRectify={canRectify}
                      onOperationStarted={onOperationStarted}
                      showDueDate
                    />
                  </>
                )}
              </Modal>

              {/* Every position the overview returns, including the ones with nothing outstanding —
                  a paid payroll has a position, and hiding it would lose a record. The heading says
                  so; "open positions" is reserved for the figure and the list that matches it. */}
              <section className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <h3 className="font-display text-[15px] font-semibold text-ink">{t.dashboard.allPositions}</h3>
                  <OpenPositionById canRectify={canRectify} />
                </div>
                <Card padding="none">
                  <PositionsFilterBar filters={filters} updateFilters={updateFilters} clearFilters={clearFilters} />
                  {listLoading ? (
                    <p className="px-5 py-6 text-sm text-muted">{t.common.loading}</p>
                  ) : !positionsPage ? (
                    <p className="px-5 py-6 text-sm text-muted">{t.positions.listUnavailable}</p>
                  ) : (
                    <>
                      {/* Paged and filtered by the Ledger — the table must not slice a page again. */}
                      <PositionsTable
                        positions={positionsPage.data}
                        currency={cashPosition.currency}
                        canRectify={canRectify}
                        onOperationStarted={onOperationStarted}
                        paginate={false}
                        showParties
                        selectedParties={selectedParties}
                        selfPartyId={selfPartyId}
                        partyNames={partyNames}
                      />
                      <Pagination page={page} totalPages={positionsPage.totalPages} onPageChange={setPage} />
                      <p className="px-5 pb-4 text-[12px] text-muted">
                        {formatTemplate(t.positions.total, { count: positionsPage.total })}
                      </p>
                    </>
                  )}
                </Card>
              </section>
            </>
          );
        })()
      )}
    </div>
  );
}
