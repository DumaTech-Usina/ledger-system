import { useEffect, useState } from "react";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { ObjectLifecycleTimeline } from "@/features/dashboard/ObjectLifecycleTimeline";
import { useLanguage } from "@/i18n/i18n";
import { cn } from "@/utils/cn";
import { formatDate, formatMoney } from "@/utils/format";
import { operationsApi } from "@/features/operations/operationsApi";
import { scenarioCopy } from "@/features/operations/copy";
import type { AdoptedIntent } from "@/features/operations/useConversation";
import type { CashMovement, PositionItem } from "@/types/dashboard";
import type { PositionAction } from "@/types/operations";

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
  onOperationStarted,
  onClose,
}: {
  movement?: CashMovement;
  position?: PositionItem;
  currency: string;
  /** partyId → display name. Absent means the Directory doesn't know it; the id then stands. */
  partyNames?: Record<string, string>;
  /** Rectifying writes to the Ledger — gated on `intent:submit`, like every other write. */
  canRectify?: boolean;
  /** Hands a conversation opened from this position over to the operations page. */
  onOperationStarted?: (intent: AdoptedIntent) => void;
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
        <ObjectLifecycleTimeline objectId={position.objectId} canRectify={canRectify} />
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
              {canRectify && onOperationStarted && (
                <PositionActions
                  position={position}
                  currency={currency}
                  onStarted={(intent) => {
                    onClose();
                    onOperationStarted(intent);
                  }}
                />
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

/**
 * What can be recorded about this position, offered as the way into the conversation.
 *
 * The list is not kept here and is not kept anywhere: the server derives it by inverting the
 * Ledger's own algebra and crossing it with what treasury can produce. Adding a position type that
 * reuses existing events changes nothing in this file.
 *
 * Ordering is by likelihood and NOTHING is hidden for being unlikely — the operator may know a fact
 * the book does not hold yet, and the Ledger is what decides. An action that reaches beyond this
 * position says so, because "evolve this position" is not true of all of them: a split opens what
 * the usina now owes someone else.
 */
function PositionActions({
  position,
  currency,
  onStarted,
}: {
  position: PositionItem;
  currency: string;
  onStarted: (intent: AdoptedIntent) => void;
}) {
  const { t } = useLanguage();
  const [actions, setActions] = useState<PositionAction[] | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    operationsApi.positionActions(position.objectId).then(({ ok, data }) => {
      if (!cancelled && ok) setActions(data.actions);
    });
    return () => {
      cancelled = true;
    };
  }, [position.objectId]);

  // Nothing to offer is a legitimate answer and the common one for a closed position — it says
  // nothing, rather than showing an empty panel that looks like a failure.
  if (!actions || actions.length === 0) return null;

  const label = `${t.objectType[position.objectType] ?? position.objectType} · ${
    position.openBalance === null
      ? t.common.unknown
      : formatMoney(position.openBalance, position.currency || currency)
  }`;

  const start = async (action: PositionAction) => {
    setStarting(action.scenarioId + (action.variantChoice ?? ""));
    const { ok, data } = await operationsApi.startPositionAction(
      position.objectId,
      action.scenarioId,
      action.variantChoice,
    );
    setStarting(null);
    if (!ok || !data || "error" in data) {
      setFailure(data && "error" in data ? data.error : t.dashboard.lifecycle.unavailable);
      return;
    }
    onStarted({
      intentId: data.intentId,
      scenarioId: action.scenarioId,
      state: data.state,
      positionLabel: label,
    });
  };

  return (
    <div className="col-span-2 border-t border-line pt-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
        {t.dashboard.lifecycle.actionsTitle}
      </p>
      {failure && (
        <Banner variant="bad" className="mt-2">
          {failure}
        </Banner>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {actions.map((action) => {
          const key = action.scenarioId + (action.variantChoice ?? "");
          return (
            <Button
              key={key}
              variant={action.likely ? "primary" : "ghost"}
              loading={starting === key}
              disabled={starting !== null && starting !== key}
              onClick={() => start(action)}
            >
              {scenarioCopy[action.scenarioId]?.title ?? action.scenarioId}
              {action.touchesOtherPositions && ` ${t.dashboard.lifecycle.actionOpensAnother}`}
            </Button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-muted">{t.dashboard.lifecycle.actionsHint}</p>
    </div>
  );
}
