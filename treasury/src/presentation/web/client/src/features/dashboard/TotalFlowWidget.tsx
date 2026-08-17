import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Modal } from "@/components/Modal";
import { CashFlowChart } from "@/features/dashboard/CashFlowChart";
import { MovementsTable } from "@/features/dashboard/MovementsTable";
import { formatTemplate, useLanguage } from "@/i18n/i18n";
import { formatDate, formatSignedMoney } from "@/utils/format";
import type { CashMovement } from "@/types/dashboard";

export function TotalFlowWidget({
  movements,
  currency,
  /** The Ledger's own fold over `period` — `null` when the Ledger could not be reached for it. */
  netCash,
  netCashNegative,
  /** The `movements` block stopped at the page cap before the period did — the chart is a prefix. */
  movementsHasMore,
  partyNames,
  onNavigateToOperations,
}: {
  movements: CashMovement[];
  currency: string;
  netCash: string | null;
  netCashNegative: boolean;
  movementsHasMore: boolean;
  /** Passed straight through to the movement tables this widget opens. */
  partyNames?: Record<string, string>;
  onNavigateToOperations?: () => void;
}) {
  const { t } = useLanguage();
  const h = t.dashboard.hero;
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const netIsPositive = !netCashNegative;

  const hasFlow = movements.some((m) => m.effect === "cash_in" || m.effect === "cash_out");
  const dayMovements = selectedDay ? movements.filter((m) => m.occurredAt.slice(0, 10) === selectedDay) : [];

  return (
    <Card className="relative flex h-full flex-col bg-gradient-to-br from-accent-soft via-white to-white dark:from-accent-soft dark:via-panel-solid dark:to-panel-solid">
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex items-center rounded-full bg-accent-soft px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-accent">
          {h.badge}
        </span>
        {onNavigateToOperations && (
          <Button variant="primary" size="sm" onClick={onNavigateToOperations}>
            <span aria-hidden>+</span> {h.cta}
          </Button>
        )}
      </div>

      {/* The Ledger's own fold over the period, never a sum of the (possibly capped) list below —
          see GetBookExposureUseCase for why this must not be derived from the movements list. */}
      <p className="mt-5 text-[13px] font-semibold text-muted">{h.netLabel}</p>
      <p
        className={`mt-1.5 text-4xl font-semibold ${
          netCash === null ? "text-muted" : netIsPositive ? "text-ok" : "text-bad"
        }`}
      >
        {netCash !== null ? formatSignedMoney(netCash, netCashNegative, currency) : t.common.unknown}
      </p>

      {hasFlow && (
        <div className="mt-auto pt-6">
          <div className="flex items-end justify-between gap-3">
            <p className="text-[13px] font-semibold text-muted">{h.chartTitle}</p>
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-muted transition hover:text-accent"
            >
              {h.viewAll}
              <ChevronRight className="size-3" strokeWidth={1.4} />
            </button>
          </div>
          <div className="mt-3">
            <CashFlowChart movements={movements} currency={currency} onSelectDay={setSelectedDay} />
          </div>
        </div>
      )}

      <Modal
        open={selectedDay !== null}
        onClose={() => setSelectedDay(null)}
        title={selectedDay ? formatTemplate(h.dayDetailTitle, { date: formatDate(selectedDay) }) : ""}
        closeLabel={t.common.close}
      >
        <MovementsTable movements={dayMovements} currency={currency} partyNames={partyNames} />
      </Modal>

      <Modal open={showAll} onClose={() => setShowAll(false)} title={h.allMovementsTitle} closeLabel={t.common.close}>
        {/* The chart above reads the same capped block — this is the honest statement that both are
            a prefix of the period, not the whole of it, whenever the Ledger says there is more. */}
        {movementsHasMore && <p className="px-1 pb-3 text-[12px] text-muted">{h.truncatedNote}</p>}
        <MovementsTable movements={movements} currency={currency} partyNames={partyNames} />
      </Modal>
    </Card>
  );
}
