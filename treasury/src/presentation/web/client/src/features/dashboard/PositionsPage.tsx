import type { AdoptedIntent } from "@/features/operations/useConversation";
import { useState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { ClassificationAgingCard } from "@/features/dashboard/ClassificationAgingCard";
import { ClassificationHealthCard } from "@/features/dashboard/ClassificationHealthCard";
import { ObjectLifecycleTimeline } from "@/features/dashboard/ObjectLifecycleTimeline";
import { PositionsTable } from "@/features/dashboard/PositionsTable";
import { hasOutstandingBalance } from "@/features/dashboard/lifecycleEngine";
import { Pagination } from "@/components/Pagination";
import { useBookExposure } from "@/features/dashboard/useBookExposure";
import { usePositionsPage } from "@/features/dashboard/usePositionsPage";
import { useDashboard } from "@/features/dashboard/useDashboard";
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
  const { page, setPage, result: positionsPage, loading: listLoading } = usePositionsPage();
  const { t } = useLanguage();
  const [showOutstanding, setShowOutstanding] = useState(false);

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
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

                  <Card>
                    <p className="text-[13px] font-semibold text-muted">{t.positions.bookHealth}</p>
                    <p className="tabular mt-1.5 text-2xl font-semibold text-ink">
                      {exposure ? `${exposure.healthScore.score}` : t.common.unknown}
                    </p>
                    {exposure && (
                      <p className="mt-1 text-[11px] text-muted">
                        {t.positions.closureQuality} {Math.round(exposure.healthScore.closureQuality * 100)}% ·{" "}
                        {exposure.healthScore.windowDays}d
                      </p>
                    )}
                  </Card>
                </div>

                {data.classificationHealth && (
                  <div className="mt-4">
                    <ClassificationHealthCard health={data.classificationHealth} />
                  </div>
                )}

                <p className="mt-3 text-[13px] text-muted">
                  {formatTemplate(t.dashboard.positionAsOf, { date: formatDate(cashPosition.asOf) })}
                </p>

                {data.classificationHealth && (
                  <div className="mt-4">
                    <ClassificationAgingCard health={data.classificationHealth} />
                  </div>
                )}
              </section>

              <Modal
                open={showOutstanding}
                onClose={() => setShowOutstanding(false)}
                title={t.dashboard.openPositions}
                closeLabel={t.common.close}
                className="max-w-6xl"
              >
                <PositionsTable
                  positions={outstanding}
                  currency={cashPosition.currency}
                  canRectify={canRectify}
                  onOperationStarted={onOperationStarted}
                />
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
                  {listLoading ? (
                    <p className="px-5 py-6 text-sm text-muted">{t.common.loading}</p>
                  ) : !positionsPage ? (
                    <p className="px-5 py-6 text-sm text-muted">{t.positions.listUnavailable}</p>
                  ) : (
                    <>
                      {/* Paged by the Ledger — the table must not slice a page again. */}
                      <PositionsTable
                        positions={positionsPage.data}
                        currency={cashPosition.currency}
                        canRectify={canRectify}
                        onOperationStarted={onOperationStarted}
                        paginate={false}
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
