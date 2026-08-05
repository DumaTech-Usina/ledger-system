import { useState } from "react";
import { Modal } from "@/components/Modal";
import { ObjectLifecycleTimeline } from "@/features/dashboard/ObjectLifecycleTimeline";
import { useLanguage } from "@/i18n/i18n";
import { cn } from "@/utils/cn";
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

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition",
        active ? "bg-accent text-accent-ink" : "text-muted hover:bg-ink/6 hover:text-ink dark:hover:bg-white/8",
      )}
    >
      {children}
    </button>
  );
}

export function RowDetailModal({
  movement,
  position,
  currency,
  partyNames = {},
  canRectify = false,
  onClose,
}: {
  movement?: CashMovement;
  position?: PositionItem;
  currency: string;
  /** partyId → display name. Absent means the Directory doesn't know it; the id then stands. */
  partyNames?: Record<string, string>;
  /** Rectifying writes to the Ledger — gated on `intent:submit`, like every other write. */
  canRectify?: boolean;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  // The lifecycle is only fetched once its tab is opened — a detail view shouldn't cost a Ledger
  // read nobody asked for.
  const [tab, setTab] = useState<"summary" | "lifecycle">("summary");

  return (
    <Modal
      open
      onClose={onClose}
      title={t.common.viewDetails}
      closeLabel={t.common.close}
      className="max-w-lg"
      tabs={
        position && (
          <div className="flex gap-1">
            <Tab active={tab === "summary"} onClick={() => setTab("summary")}>
              {t.dashboard.lifecycle.tabSummary}
            </Tab>
            <Tab active={tab === "lifecycle"} onClick={() => setTab("lifecycle")}>
              {t.dashboard.lifecycle.tabLifecycle}
            </Tab>
          </div>
        )
      }
    >
      {position && tab === "lifecycle" ? (
        <ObjectLifecycleTimeline
          objectId={position.objectId}
          objectType={position.objectType}
          canRectify={canRectify}
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 p-5">
          {movement && (
            <>
              <Field label={t.dashboard.table.date} value={formatDate(movement.occurredAt)} />
              <Field
                label={t.dashboard.table.counterparty}
                value={
                  movement.counterparty ? partyNames[movement.counterparty] ?? movement.counterparty : "—"
                }
              />
              <Field label={t.dashboard.table.description} value={movement.description ?? "—"} className="col-span-2" />
              <Field
                label={t.cashEffect[movement.effect] ?? movement.effect}
                value={formatMoney(movement.amount, currency)}
                className={
                  movement.effect === "cash_in" ? "text-ok" : movement.effect === "cash_out" ? "text-bad" : undefined
                }
              />
              {/* The producer's own reference. Technical, and kept here rather than in the grid —
                  it identifies the record for support, it doesn't help read the movement. */}
              <Field label={t.dashboard.table.document} value={movement.sourceReference} />
            </>
          )}
          {position && (
            <>
              <Field label={t.dashboard.table.type} value={t.objectType[position.objectType] ?? position.objectType} />
              <Field label={t.dashboard.table.status} value={t.positionStatus[position.status] ?? position.status} />
              <Field
                label={t.dashboard.table.openBalance}
                value={
                  position.openBalance === null
                    ? t.common.unknown
                    : formatMoney(position.openBalance, position.currency || currency)
                }
              />
              {position.lastEventAt && <Field label={t.dashboard.table.date} value={formatDate(position.lastEventAt)} />}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
