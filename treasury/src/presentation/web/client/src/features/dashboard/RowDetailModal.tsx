import { Modal } from "@/components/Modal";
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

  return (
    <Modal open onClose={onClose} title={t.common.viewDetails} closeLabel={t.common.close} className="max-w-lg">
      <div className="grid grid-cols-2 gap-4 p-5">
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
    </Modal>
  );
}
