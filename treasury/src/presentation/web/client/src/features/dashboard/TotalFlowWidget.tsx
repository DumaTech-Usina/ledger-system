import { useState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Modal } from "@/components/Modal";
import { CashFlowChart } from "@/features/dashboard/CashFlowChart";
import { MovementsTable } from "@/features/dashboard/MovementsTable";
import { formatTemplate, useLanguage } from "@/i18n/i18n";
import { formatDate, formatMoney } from "@/utils/format";
import type { CashPosition, CashMovement } from "@/types/dashboard";

export function TotalFlowWidget({
  movements,
  cashPosition,
  partyNames,
  onNavigateToOperations,
}: {
  movements: CashMovement[];
  cashPosition: CashPosition;
  /** Passed straight through to the movement tables this widget opens. */
  partyNames?: Record<string, string>;
  onNavigateToOperations?: () => void;
}) {
  const { t } = useLanguage();
  const h = t.dashboard.hero;
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const totalCashIn = Number(cashPosition.totalCashIn);
  const netIsPositive = !cashPosition.netCashFlow.trim().startsWith("-");

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

      <p className="mt-5 text-4xl font-semibold text-accent">{formatMoney(totalCashIn, cashPosition.currency)}</p>

      <p className={`mt-1.5 flex items-center gap-1.5 text-[13px] font-medium ${netIsPositive ? "text-ok" : "text-bad"}`}>
        <svg viewBox="0 0 12 12" fill="none" className={`size-3 ${netIsPositive ? "" : "rotate-180"}`} aria-hidden>
          <path d="M6 10V2M6 2 2.5 5.5M6 2l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-muted">{h.netLabel}:</span> {formatMoney(cashPosition.netCashFlow, cashPosition.currency)}
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
              <svg viewBox="0 0 12 12" fill="none" className="size-3">
                <path d="M4 2.5 8 6l-4 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <div className="mt-3">
            <CashFlowChart movements={movements} currency={cashPosition.currency} onSelectDay={setSelectedDay} />
          </div>
        </div>
      )}

      <Modal
        open={selectedDay !== null}
        onClose={() => setSelectedDay(null)}
        title={selectedDay ? formatTemplate(h.dayDetailTitle, { date: formatDate(selectedDay) }) : ""}
        closeLabel={t.common.close}
      >
        <MovementsTable movements={dayMovements} currency={cashPosition.currency} partyNames={partyNames} />
      </Modal>

      <Modal open={showAll} onClose={() => setShowAll(false)} title={h.allMovementsTitle} closeLabel={t.common.close}>
        <MovementsTable movements={movements} currency={cashPosition.currency} partyNames={partyNames} />
      </Modal>
    </Card>
  );
}
