import { useState } from "react";
import { Badge } from "@/components/Badge";
import { Modal } from "@/components/Modal";
import { PartyReveal } from "@/features/dashboard/CommissionBreakdown";
import { useLanguage } from "@/i18n/i18n";
import { formatDate, formatMoney } from "@/utils/format";
import type { CashMovement, PositionItem } from "@/types/dashboard";

function Field({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="tabular mt-0.5 text-[13px] text-ink">{value}</p>
    </div>
  );
}

export function RowDetailModal({
  movement,
  position,
  currency,
  onClose,
}: {
  movement?: CashMovement;
  position?: PositionItem;
  currency: string;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [activePartyId, setActivePartyId] = useState<string | null>(null);
  const origin = movement?.origin ?? position?.origin;
  const installment = origin?.installments.find((i) => i.number === origin.installmentNumber);

  return (
    <Modal open onClose={onClose} title={t.common.viewDetails} closeLabel={t.common.close} className="max-w-lg">
      <div className="space-y-4 p-5">
        <div className="grid grid-cols-2 gap-4">
          {movement && (
            <>
              <Field label={t.dashboard.table.date} value={formatDate(movement.occurredAt)} />
              <Field label={t.dashboard.table.document} value={movement.sourceReference} />
              <Field label={t.dashboard.table.description} value={movement.description ?? "—"} className="col-span-2" />
              <Field
                label={movement.effect === "cash_in" ? t.dashboard.table.cashInColumn : t.dashboard.table.cashOutColumn}
                value={formatMoney(movement.amount, currency)}
                className={movement.effect === "cash_in" ? "text-ok" : "text-bad"}
              />
            </>
          )}
          {position && (
            <>
              <Field label={t.dashboard.table.type} value={t.objectType[position.objectType] ?? position.objectType} />
              <Field label={t.dashboard.table.status} value={t.positionStatus[position.status] ?? position.status} />
              <Field label={t.dashboard.table.openBalance} value={formatMoney(position.openBalance, position.currency || currency)} />
              {position.lastEventAt && <Field label={t.dashboard.table.date} value={formatDate(position.lastEventAt)} />}
            </>
          )}
        </div>

        {origin && (
          <div className="space-y-3 border-t border-line pt-4">
            <h4 className="text-[13px] font-semibold text-ink">{t.dashboard.breakdown.title}</h4>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t.dashboard.breakdown.operator} value={origin.operatorName} />
              <Field label={t.dashboard.breakdown.proposalValue} value={formatMoney(origin.totalValue, currency)} />
              <Field label={t.dashboard.breakdown.plan} value={origin.planDescription} className="col-span-2" />
              <Field label={t.dashboard.breakdown.proposalNumber} value={`#${origin.proposalNumber}`} />
              <Field label={t.dashboard.breakdown.installmentNumber} value={`${origin.installmentNumber}/${origin.installments.length}`} />
              <Field label={t.dashboard.breakdown.lives} value={String(origin.lives)} />
              {installment && (
                <>
                  <Field label={t.dashboard.breakdown.originalValue} value={formatMoney(installment.originalValue, currency)} />
                  {installment.outflowReason === "repasse" && (
                    <Field
                      label={t.dashboard.breakdown.commissionPercent}
                      value={`${installment.brokerCommissionPercent}% (${formatMoney(installment.brokerCommissionValue, currency)})`}
                    />
                  )}
                  {installment.outflowReason === "multa" && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{t.dashboard.breakdown.reason}</p>
                      <Badge variant="bad" className="mt-0.5">
                        {t.dashboard.breakdown.multaLabel}
                      </Badge>
                    </div>
                  )}
                </>
              )}
              <div className="pt-1.5">
                <PartyReveal
                  id="detail-client"
                  label={t.dashboard.breakdown.client}
                  party={origin.client}
                  activeId={activePartyId}
                  setActiveId={setActivePartyId}
                />
              </div>
              <div className="pt-1.5">
                <PartyReveal
                  id="detail-broker"
                  label={t.dashboard.breakdown.broker}
                  party={origin.broker}
                  activeId={activePartyId}
                  setActiveId={setActivePartyId}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
