import { useEffect, useState } from "react";
import { Badge } from "@/components/Badge";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useLanguage } from "@/i18n/i18n";
import { pendingCorrection, rectifiability } from "@/features/dashboard/lifecycleEngine";
import { useObjectLifecycle } from "@/features/dashboard/useObjectLifecycle";
import { operationsApi } from "@/features/operations/operationsApi";
import { formatDate, formatDateTime, formatMoney } from "@/utils/format";
import { cn } from "@/utils/cn";
import type { PositionLifecycleEvent } from "@/types/dashboard";
import type { RectifyResult } from "@/types/operations";

/**
 * The life of one economic object, as the Ledger projects it. The order on screen is the Ledger's
 * own (recordedAt ascending) and is never re-sorted here — the sequence IS the information.
 *
 * A retracted event stays in the list. Nothing is rewritten: it is marked as no longer counting,
 * which is a different statement from having never been recorded.
 */
export function ObjectLifecycleTimeline({
  objectId,
  canRectify = false,
}: {
  objectId: string;
  canRectify?: boolean;
}) {
  const { t } = useLanguage();
  const state = useObjectLifecycle(objectId);
  const [failure, setFailure] = useState<string | null>(null);
  // What the Ledger's algebra admits here, fetched once. Undefined while in flight — and that is
  // deliberately not "nothing": the correction stays offered until the server says otherwise.
  const [actions, setActions] = useState<readonly { relation: string }[] | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    operationsApi.positionActions(objectId).then(({ ok, data }) => {
      if (!cancelled && ok) setActions(data.actions);
    });
    return () => {
      cancelled = true;
    };
  }, [objectId]);

  if (state.kind === "loading") {
    return <p className="px-5 py-6 text-sm text-muted">{t.common.loading}</p>;
  }
  if (state.kind === "unknown") {
    return <p className="px-5 py-6 text-sm text-muted">{t.dashboard.lifecycle.unknownObject}</p>;
  }
  if (state.kind === "unavailable") {
    return <p className="px-5 py-6 text-sm text-muted">{t.dashboard.lifecycle.unavailable}</p>;
  }

  const { lifecycle } = state;
  // Derived from the chain the Ledger published, never from state treasury kept: a withdrawal that
  // declared a sequel and has not received one.
  const pending = pendingCorrection(lifecycle.events);

  return (
    <div className="px-5 py-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="neutral">{t.positionStatus[lifecycle.status] ?? lifecycle.status}</Badge>
        <Badge variant="neutral">{t.positionOutcome[lifecycle.outcome] ?? lifecycle.outcome}</Badge>
        <span className="tabular text-[11px] text-muted">{lifecycle.objectId}</span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4 sm:grid-cols-4">
        <Figure label={t.dashboard.lifecycle.originated} value={formatMoney(lifecycle.totalOriginated, lifecycle.currency)} />
        <Figure label={t.dashboard.lifecycle.settled} value={formatMoney(lifecycle.totalSettled, lifecycle.currency)} />
        <Figure
          label={t.dashboard.table.openBalance}
          value={
            lifecycle.openBalance === null
              ? t.common.unknown
              : formatMoney(lifecycle.openBalance, lifecycle.currency)
          }
          muted={lifecycle.openBalance === null}
        />
        <Figure label={t.dashboard.lifecycle.events} value={String(lifecycle.eventCount)} />
      </dl>

      {failure && (
        <Banner variant="bad" className="mt-4">
          {failure}
        </Banner>
      )}

      {pending && canRectify && (
        <PendingCorrectionNotice
          targetEventId={pending.targetEventId}
          onDone={() => {
            setFailure(null);
            state.reload();
          }}
          onFailure={setFailure}
        />
      )}

      <ol className="mt-5 border-t border-line pt-4">
        {lifecycle.events.map((event, index) => (
          <TimelineEvent
            key={event.eventId}
            event={event}
            last={index === lifecycle.events.length - 1}
            rectify={rectifiability(event, actions)}
            canRectify={canRectify}
            onRectified={() => {
              setFailure(null);
              state.reload();
            }}
            onFailure={setFailure}
          />
        ))}
      </ol>
    </div>
  );
}

function Figure({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className={cn("tabular mt-0.5 text-[13px]", muted ? "text-muted" : "text-ink")}>{value}</dd>
    </div>
  );
}

function TimelineEvent({
  event,
  last,
  rectify,
  canRectify,
  onRectified,
  onFailure,
}: {
  event: PositionLifecycleEvent;
  last: boolean;
  rectify: ReturnType<typeof rectifiability>;
  canRectify: boolean;
  onRectified: () => void;
  onFailure: (message: string) => void;
}) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [rectifying, setRectifying] = useState(false);

  const copyId = async () => {
    await navigator.clipboard.writeText(event.eventId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <li className="relative flex gap-3 pb-6 last:pb-0">
      {/* The rail carries the chain's order, which is the one thing this list must never lose. */}
      {!last && <span aria-hidden className="absolute left-[5px] top-3 h-full w-px bg-line" />}
      <span
        aria-hidden
        className={cn(
          "relative mt-1.5 size-2.5 flex-shrink-0 rounded-full",
          event.retracted ? "bg-muted/50" : "bg-accent",
        )}
      />

      <div className={cn("min-w-0 flex-1", event.retracted && "opacity-70")}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13.5px] font-semibold text-ink">
            {t.eventType[event.eventType] ?? event.eventType}
          </span>
          {event.relation && (
            <Badge variant="neutral">{t.eventRelation[event.relation] ?? event.relation}</Badge>
          )}
          {event.retracted && <Badge variant="warn">{t.dashboard.lifecycle.retracted}</Badge>}
          <span className="tabular ml-auto text-[13px] font-semibold text-ink">
            {formatMoney(event.amount, event.currency)}
          </span>
        </div>

        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] text-muted">
          <span>
            {t.dashboard.lifecycle.occurredOn} <span className="tabular">{formatDate(event.occurredAt)}</span>
          </span>
          <span>
            {t.dashboard.lifecycle.recordedOn} <span className="tabular">{formatDateTime(event.recordedAt)}</span>
          </span>
        </div>

        {event.description && <p className="mt-1 text-[13px] text-ink">{event.description}</p>}

        {event.retracted && (
          <p className="mt-1.5 text-[12px] text-muted">{t.dashboard.lifecycle.retractedNote}</p>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
          <button
            type="button"
            onClick={copyId}
            title={t.dashboard.lifecycle.copyEventId}
            className="tabular inline-flex items-center gap-1.5 rounded-full bg-ink/6 px-2 py-1 transition hover:text-ink dark:bg-white/8"
          >
            {copied ? t.dashboard.lifecycle.copied : event.eventId}
          </button>
          {event.relatedEventId && (
            <span className="tabular">
              {t.dashboard.lifecycle.relatedEvent}: {event.relatedEventId}
            </span>
          )}
          {canRectify &&
            (rectify.available ? (
              <button
                type="button"
                onClick={() => setRectifying(true)}
                className="font-semibold text-muted underline underline-offset-2 transition hover:text-ink"
              >
                {t.dashboard.lifecycle.rectify}
              </button>
            ) : (
              <span
                title={
                  rectify.reason === "unsupported"
                    ? t.dashboard.lifecycle.rectifyUnsupported
                    : t.dashboard.lifecycle.rectifyContextual
                }
                className="cursor-not-allowed font-semibold text-muted/50 underline underline-offset-2"
              >
                {t.dashboard.lifecycle.rectify}
              </span>
            ))}
        </div>

        {rectifying && (
          <RectifyForm
            eventId={event.eventId}
            onClose={() => setRectifying(false)}
            onDone={() => {
              setRectifying(false);
              onRectified();
            }}
            onFailure={onFailure}
          />
        )}
      </div>
    </li>
  );
}

/**
 * Reports what a correction produced, in the caller's language. Returns null when it went through.
 *
 * A half-done correction is not an error and is not phrased as one: the withdrawal is recorded and
 * true, and what is missing is the entry that replaces it. The position keeps offering to finish.
 */
function correctionProblem(result: RectifyResult, t: ReturnType<typeof useLanguage>["t"]): string | null {
  if (result.notReissuable) return t.dashboard.lifecycle.pendingNotReissuable;
  if (result.reissueIncomplete) {
    return t.dashboard.lifecycle.pendingIncomplete.replace("{slot}", result.reissueIncomplete.missingSlot);
  }
  return null;
}

/**
 * Confirms one correction.
 *
 * Two things can be wrong with a recorded entry, and they are different facts. Either it never
 * happened — it is withdrawn and that is the end of it — or it happened and was mis-measured, in
 * which case the true figure has to be recorded as its own entry. The Ledger has no relation that
 * restates an amount, so the second is always two events, and the form says so rather than looking
 * like an edit.
 *
 * Counterparty and kind are deliberately absent: changing who took part changes WHICH fact it is,
 * not how it was measured, and that is a new operation rather than a correction.
 */
function RectifyForm({
  eventId,
  onClose,
  onDone,
  onFailure,
}: {
  eventId: string;
  onClose: () => void;
  onDone: () => void;
  onFailure: (message: string) => void;
}) {
  const { t } = useLanguage();
  const [restating, setRestating] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    const corrected = restating
      ? {
          // Only what was actually filled is sent. A blank field is not a restatement of the field
          // to nothing — it means the operator left that one alone.
          ...(amount.trim() ? { amount: amount.trim() } : {}),
          ...(occurredAt.trim() ? { occurredAt: new Date(occurredAt).toISOString() } : {}),
        }
      : undefined;

    const { ok, data } = await operationsApi.rectify({
      targetEventId: eventId,
      description: description.trim() || undefined,
      ...(corrected && Object.keys(corrected).length > 0 ? { corrected } : {}),
    });
    setSaving(false);

    if (!ok) {
      onFailure(data && "error" in data ? data.error : t.dashboard.lifecycle.unavailable);
      return;
    }

    const problem = data && !("error" in data) ? correctionProblem(data, t) : null;
    if (problem) onFailure(problem);
    onDone();
  };

  return (
    <div className="mt-3 rounded-2xl border border-line bg-ink/[0.03] p-3.5 dark:bg-white/5">
      <p className="text-[13px] font-semibold text-ink">{t.dashboard.lifecycle.rectifyTitle}</p>
      <p className="mt-1 text-[12px] text-muted">{t.dashboard.lifecycle.rectifyExplain}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <ModeButton active={!restating} disabled={saving} onClick={() => setRestating(false)}>
          {t.dashboard.lifecycle.rectifyModeWithdraw}
        </ModeButton>
        <ModeButton active={restating} disabled={saving} onClick={() => setRestating(true)}>
          {t.dashboard.lifecycle.rectifyModeRestate}
        </ModeButton>
      </div>

      {restating && (
        <>
          <p className="mt-3 text-[12px] text-muted">{t.dashboard.lifecycle.rectifyRestateHint}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Input
              label={t.dashboard.lifecycle.rectifyAmount}
              value={amount}
              inputMode="decimal"
              placeholder="450.00"
              disabled={saving}
              onChange={(event) => setAmount(event.target.value)}
            />
            <Input
              label={t.dashboard.lifecycle.rectifyDate}
              type="date"
              value={occurredAt}
              disabled={saving}
              onChange={(event) => setOccurredAt(event.target.value)}
            />
          </div>
          <p className="mt-2 text-[11px] text-muted">{t.dashboard.lifecycle.rectifyLockedNote}</p>
        </>
      )}

      <div className="mt-3">
        <Input
          label={t.dashboard.lifecycle.rectifyDescription}
          value={description}
          disabled={saving}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="warn" loading={saving} onClick={submit}>
          {t.dashboard.lifecycle.rectifyConfirm}
        </Button>
        <Button variant="ghost" disabled={saving} onClick={onClose}>
          {t.dashboard.lifecycle.rectifyCancel}
        </Button>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1.5 text-[12px] font-semibold transition",
        active
          ? "border-ink bg-ink text-paper"
          : "border-line text-muted hover:border-ink/40 hover:text-ink",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Says that a correction was interrupted, and offers to finish it.
 *
 * Deliberately not a badge, a counter or a blocker: the withdrawal on record is true, and the book
 * is honest — it is simply incomplete. Resuming reopens the same correction on the entry that was
 * withdrawn, which is the one the corrected figure belongs to.
 */
function PendingCorrectionNotice({
  targetEventId,
  onDone,
  onFailure,
}: {
  targetEventId: string;
  onDone: () => void;
  onFailure: (message: string) => void;
}) {
  const { t } = useLanguage();
  const [resuming, setResuming] = useState(false);

  return (
    <div className="mt-4 rounded-2xl border border-warn/40 bg-warn/[0.06] p-3.5">
      <p className="text-[13px] font-semibold text-ink">{t.dashboard.lifecycle.pendingTitle}</p>
      <p className="mt-1 text-[12px] text-muted">{t.dashboard.lifecycle.pendingExplain}</p>

      {resuming ? (
        <RectifyForm
          eventId={targetEventId}
          onClose={() => setResuming(false)}
          onDone={() => {
            setResuming(false);
            onDone();
          }}
          onFailure={onFailure}
        />
      ) : (
        <div className="mt-3">
          <Button variant="warn" onClick={() => setResuming(true)}>
            {t.dashboard.lifecycle.pendingResume}
          </Button>
        </div>
      )}
    </div>
  );
}
