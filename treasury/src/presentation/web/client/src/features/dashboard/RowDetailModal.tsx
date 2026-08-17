import { useEffect, useState } from "react";
import { Badge } from "@/components/Badge";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { FactObjects, FactParties } from "@/features/dashboard/FactContext";
import { ObjectLifecycleTimeline } from "@/features/dashboard/ObjectLifecycleTimeline";
import { useLanguage } from "@/i18n/i18n";
import { cn } from "@/utils/cn";
import { formatDate, formatMoney } from "@/utils/format";
import { operationsApi } from "@/features/operations/operationsApi";
import { scenarioCopy } from "@/features/operations/copy";
import type { AdoptedIntent } from "@/features/operations/useConversation";
import type { CashMovement, PositionItem } from "@/types/dashboard";
import type { PositionAction } from "@/types/operations";

/**
 * One labelled value. The label carries the design system's `label-sm` (12px / 700 / wide tracking)
 * so a field heading reads the same here as a column heading does in the tables beside it.
 */
function Field({
  label,
  value,
  className,
  tone,
}: {
  label: string;
  value: string;
  className?: string;
  tone?: "ok" | "bad";
}) {
  return (
    <div className={className}>
      <p className="text-[12px] font-bold uppercase tracking-[0.03em] text-muted">{label}</p>
      <p
        className={cn(
          "tabular mt-1 text-[14px] font-medium",
          tone === "ok" ? "text-ok" : tone === "bad" ? "text-bad" : "text-ink",
        )}
      >
        {value}
      </p>
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
  /**
   * A position opened from one of the movement's objects. This is the only path from the cash screen
   * to a position's history — the timeline is otherwise reachable only from the positions screen.
   * The same self-contained component the lifecycle tab renders, given a different id.
   */
  const [openedObject, setOpenedObject] = useState<string | null>(null);

  if (openedObject) {
    return (
      <Modal
        open
        onClose={onClose}
        title={t.dashboard.lifecycle.tabLifecycle}
        closeLabel={t.common.close}
        className="max-w-2xl"
      >
        <div className="border-b border-line px-6 py-3">
          <button
            type="button"
            onClick={() => setOpenedObject(null)}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold text-muted transition hover:bg-ink/6 hover:text-ink dark:hover:bg-white/8"
          >
            <span aria-hidden>‹</span>
            {t.dashboard.fact.backToMovement}
          </button>
        </div>
        {/* No row supplied a type here, so rectifiability is left to the backend to answer. */}
        <ObjectLifecycleTimeline objectId={openedObject} canRectify={canRectify} />
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t.common.viewDetails}
      closeLabel={t.common.close}
      className="max-w-2xl"
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
      ) : movement ? (
        <div className="space-y-6 p-6">
          {/* The amount leads: it is the one thing a reader came to this row for, and the effect
              names it rather than sitting in a column of its own. Which fact it was — eventType —
              rides above it; `effect` states the economic nature and never said that. It is absent
              against a Ledger that does not publish it, and then simply not shown. */}
          <div>
            {movement.eventType && (
              <Badge variant="neutral" className="mb-2">
                {t.eventType[movement.eventType] ?? movement.eventType}
              </Badge>
            )}
            <p className="text-[12px] font-bold uppercase tracking-[0.03em] text-muted">
              {t.cashEffect[movement.effect] ?? movement.effect}
            </p>
            <p
              className={cn(
                "tabular mt-1 font-display text-3xl font-bold tracking-[-0.01em]",
                movement.effect === "cash_in" && "text-ok",
                movement.effect === "cash_out" && "text-bad",
                movement.effect !== "cash_in" && movement.effect !== "cash_out" && "text-ink",
              )}
            >
              {formatMoney(movement.amount, currency)}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 border-t border-line pt-5 sm:grid-cols-2">
            <Field label={t.dashboard.table.date} value={formatDate(movement.occurredAt)} />
            <Field
              label={t.dashboard.table.counterparty}
              value={movement.counterparty ? partyNames[movement.counterparty] ?? movement.counterparty : "—"}
            />
            {/* The producer's own reference, with the system it belongs to. Kept together in one
                field because neither identifies the fact without the other. */}
            <Field
              label={t.dashboard.table.document}
              value={
                movement.sourceSystem
                  ? `${movement.sourceSystem} · ${movement.sourceReference}`
                  : movement.sourceReference
              }
            />
            <Field
              label={t.dashboard.table.description}
              value={movement.description ?? "—"}
              className="sm:col-span-2"
            />
          </div>

          {/* What the movement was about, and who was on each side of it. Both come straight from
              the Ledger's record of the fact. */}
          <FactObjects
            objects={movement.objects}
            onOpenObject={setOpenedObject}
            className="border-t border-line pt-5"
          />
          <FactParties
            parties={movement.parties}
            partyNames={partyNames}
            counterparty={movement.counterparty}
            currency={currency}
            className="border-t border-line pt-5"
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-5 p-6">
          {position && (
            <>
              <Field label={t.dashboard.table.type} value={t.objectType[position.objectType] ?? position.objectType} />
              {/* Same rule as the positions table: a status this app has no name for is named as
                  unrecognised rather than printed raw. */}
              <Field
                label={t.dashboard.table.status}
                value={t.positionStatus[position.status] ?? t.common.unrecognizedStatus}
              />
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
  // Open by default while the position still has something to act on; a settled position's
  // recommendations are no longer the point of looking at it, so they start tucked away.
  const [expanded, setExpanded] = useState(position.status !== "fully_settled");

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
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
          {t.dashboard.lifecycle.actionsTitle}
        </span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          className={cn(
            "size-4 flex-shrink-0 text-muted transition-transform duration-300",
            !expanded && "-rotate-90",
          )}
        >
          <path d="M5 7.5 10 12l5-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {expanded && (
        <>
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
        </>
      )}
    </div>
  );
}
