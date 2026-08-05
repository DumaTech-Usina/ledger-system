import { useState } from "react";
import { Badge } from "@/components/Badge";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useLanguage } from "@/i18n/i18n";
import { rectifiability } from "@/features/dashboard/lifecycleEngine";
import { useObjectLifecycle } from "@/features/dashboard/useObjectLifecycle";
import { operationsApi } from "@/features/operations/operationsApi";
import { formatDate, formatDateTime, formatMoney } from "@/utils/format";
import { cn } from "@/utils/cn";
import type { PositionLifecycleEvent } from "@/types/dashboard";

/**
 * The life of one economic object, as the Ledger projects it. The order on screen is the Ledger's
 * own (recordedAt ascending) and is never re-sorted here — the sequence IS the information.
 *
 * A retracted event stays in the list. Nothing is rewritten: it is marked as no longer counting,
 * which is a different statement from having never been recorded.
 */
export function ObjectLifecycleTimeline({
  objectId,
  objectType,
  canRectify = false,
}: {
  objectId: string;
  /** Undefined when the position was opened by id: no row supplied its type. */
  objectType?: string;
  canRectify?: boolean;
}) {
  const { t } = useLanguage();
  const state = useObjectLifecycle(objectId);
  const [failure, setFailure] = useState<string | null>(null);

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

      <ol className="mt-5 border-t border-line pt-4">
        {lifecycle.events.map((event, index) => (
          <TimelineEvent
            key={event.eventId}
            event={event}
            last={index === lifecycle.events.length - 1}
            rectify={rectifiability(event, objectType)}
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
 * Confirms one rectification. It asks for a single thing — what established the error — because
 * everything else about the correction is read from the Ledger's record of the entry being
 * corrected, never from a second typing.
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
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    const { ok, data } = await operationsApi.rectify({
      targetEventId: eventId,
      description: description.trim() || undefined,
    });
    setSaving(false);
    if (!ok) {
      onFailure(data && "error" in data ? data.error : t.dashboard.lifecycle.unavailable);
      return;
    }
    onDone();
  };

  return (
    <div className="mt-3 rounded-2xl border border-line bg-ink/[0.03] p-3.5 dark:bg-white/5">
      <p className="text-[13px] font-semibold text-ink">{t.dashboard.lifecycle.rectifyTitle}</p>
      <p className="mt-1 text-[12px] text-muted">{t.dashboard.lifecycle.rectifyExplain}</p>
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
