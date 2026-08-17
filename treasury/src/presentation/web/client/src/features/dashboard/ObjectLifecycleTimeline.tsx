import { useEffect, useState } from "react";
import { Badge } from "@/components/Badge";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { DatePicker } from "@/components/DatePicker";
import { Input } from "@/components/Input";
import { FactParties, ObjectChip, SourceRef } from "@/features/dashboard/FactContext";
import { useLanguage } from "@/i18n/i18n";
import { CopyableId } from "@/components/CopyableId";
import {
  outcomeTone,
  pendingCorrection,
  rectifiability,
  relatedEventOf,
  relationTone,
  statusTone,
  type Tone,
} from "@/features/dashboard/lifecycleEngine";
import { useObjectLifecycle } from "@/features/dashboard/useObjectLifecycle";
import { operationsApi } from "@/features/operations/operationsApi";
import { formatDate, formatDateTime, formatMoney } from "@/utils/format";
import { cn } from "@/utils/cn";
import type { PositionLifecycleEvent, PositionOriginRef } from "@/types/dashboard";
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
    return <p className="px-6 py-6 text-sm text-muted">{t.common.loading}</p>;
  }
  if (state.kind === "unknown") {
    return <p className="px-6 py-6 text-sm text-muted">{t.dashboard.lifecycle.unknownObject}</p>;
  }
  if (state.kind === "unavailable") {
    return <p className="px-6 py-6 text-sm text-muted">{t.dashboard.lifecycle.unavailable}</p>;
  }

  const { lifecycle } = state;
  // Derived from the chain the Ledger published, never from state treasury kept: a withdrawal that
  // declared a sequel and has not received one.
  const pending = pendingCorrection(lifecycle.events);

  return (
    <div className="px-6 py-6">
      <div className="flex flex-wrap items-center gap-2">
        {/* Same rule as everywhere else: an unrecognised status is named as such, with the Ledger's
            own word kept in the tooltip. */}
        {/* Where it stands, and how it ended — two different questions, so two different tones
            rather than one grey pair the reader has to read word by word. */}
        <Badge variant={statusTone(lifecycle.status)} dot title={lifecycle.status}>
          {t.positionStatus[lifecycle.status] ?? t.common.unrecognizedStatus}
        </Badge>
        <Badge variant={outcomeTone(lifecycle.outcome)} dot>
          {t.positionOutcome[lifecycle.outcome] ?? lifecycle.outcome}
        </Badge>
        <CopyableId value={lifecycle.objectId} className="ml-auto" />
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

      <StandingOrigin
        origin={lifecycle.origin}
        partyNames={lifecycle.partyNames}
        currency={lifecycle.currency}
      />

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
            objectId={lifecycle.objectId}
            partyNames={lifecycle.partyNames}
            relatedEvent={relatedEventOf(lifecycle.events, event.relatedEventId)}
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

/**
 * What this position refers to: the fact that originated it and the documents that fact named.
 *
 * The server selects it from the events with the retracted ones excluded, so a rectification that
 * took an origination back does not keep answering here. Null is a legitimate state — a cash-basis
 * position never had an origination, and a retracted one no longer does — and it is said in words
 * rather than left blank, because a blank block reads as data that failed to load.
 */
function StandingOrigin({
  origin,
  partyNames,
  currency,
}: {
  origin: PositionOriginRef | null;
  partyNames: Record<string, string>;
  currency: string;
}) {
  const { t } = useLanguage();

  if (!origin) {
    return (
      <p className="mt-4 border-t border-line pt-4 text-[13px] text-muted">
        {t.dashboard.lifecycle.noStandingOrigin}
      </p>
    );
  }

  return (
    <section className="mt-4 border-t border-line pt-4">
      <p className="text-[12px] font-bold uppercase tracking-[0.03em] text-muted">
        {t.dashboard.lifecycle.originTitle}
      </p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[13.5px] font-semibold text-ink">
          {t.eventType[origin.eventType] ?? origin.eventType}
        </span>
        <span className="tabular text-[12px] text-muted">{formatDate(origin.occurredAt)}</span>
        {/* Null against a Ledger that publishes no source — then nothing is shown rather than a
            placeholder that would look like an origin nobody can trace. */}
        {origin.source && <SourceRef source={origin.source} />}
      </div>

      {/* The documents the origination named beside this position. Empty means it named none, which
          is not an absence of information — so nothing is said about it. */}
      {origin.relatedObjects.length > 0 && (
        <>
          <p className="mt-3 text-[12px] font-bold uppercase tracking-[0.03em] text-muted">
            {t.dashboard.lifecycle.originReferences}
          </p>
          <ul className="divide-y divide-line">
            {origin.relatedObjects.map((object) => (
              <ObjectChip key={`${object.objectId}-${object.relation}`} object={object} />
            ))}
          </ul>
        </>
      )}

      {/* Who the position is WITH — read from the origination that still stands, so a rectified one
          never keeps answering for it. This is the "from whom, to whom" the cash screen has had all
          along, now on the side of the book that says what is owed. */}
      <FactParties
        parties={origin.parties}
        partyNames={partyNames}
        currency={currency}
        className="mt-4"
      />
    </section>
  );
}

/** The rail marker's fill per tone — the same scale the badges use, as a solid dot. */
const RAIL_DOT: Record<Tone, string> = {
  neutral: "bg-muted",
  accent: "bg-accent dark:bg-secondary",
  ok: "bg-ok",
  bad: "bg-bad",
  warn: "bg-warn",
};

function Figure({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <dt className="text-[12px] font-bold uppercase tracking-[0.03em] text-muted">{label}</dt>
      <dd className={cn("tabular mt-1 text-[14px] font-medium", muted ? "text-muted" : "text-ink")}>{value}</dd>
    </div>
  );
}

function TimelineEvent({
  event,
  objectId,
  partyNames,
  relatedEvent,
  last,
  rectify,
  canRectify,
  onRectified,
  onFailure,
}: {
  event: PositionLifecycleEvent;
  /** The position being read — what tells this event's own object apart from the ones it references. */
  objectId: string;
  /** partyId → display name, resolved once for the whole life and shared by every event in it. */
  partyNames: Record<string, string>;
  /** The event `relatedEventId` names, when this position's history contains it. */
  relatedEvent: PositionLifecycleEvent | null;
  last: boolean;
  rectify: ReturnType<typeof rectifiability>;
  canRectify: boolean;
  onRectified: () => void;
  onFailure: (message: string) => void;
}) {
  const { t } = useLanguage();
  const [rectifying, setRectifying] = useState(false);

  const siblings = event.objects.filter((object) => object.objectId !== objectId);

  return (
    <li className="relative flex gap-3 pb-6 last:pb-0">
      {/* The rail carries the chain's order, which is the one thing this list must never lose. */}
      {!last && <span aria-hidden className="absolute left-[5px] top-3 h-full w-px bg-line" />}
      {/* The marker carries the same tone as the step's badge, so the rail itself reads as a
          progression instead of a column of identical dots. A retracted step goes grey: it stays in
          the sequence, but colouring it as a live step would say it still counts. */}
      <span
        aria-hidden
        className={cn(
          "relative mt-1.5 size-2.5 flex-shrink-0 rounded-full",
          event.retracted ? "bg-muted/50" : RAIL_DOT[relationTone(event.relation)],
        )}
      />

      <div className={cn("min-w-0 flex-1", event.retracted && "opacity-70")}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13.5px] font-semibold text-ink">
            {t.eventType[event.eventType] ?? event.eventType}
          </span>
          {/* The step's own colour, by what it did to this position. A retracted step keeps its
              tone but is dimmed by the wrapper — it still happened, it just no longer counts. */}
          {event.relation && (
            <Badge variant={relationTone(event.relation)} dot>
              {t.eventRelation[event.relation] ?? event.relation}
            </Badge>
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

        {/* The other objects this event named — the proposal, the contract, the installment that say
            what the fact was about. Only the siblings: the position being read is already the
            subject of this screen. Nothing is said when it named none, since naming this one is not
            the same as naming nothing. */}
        {siblings.length > 0 && (
          <ul className="mt-1.5 divide-y divide-line">
            {siblings.map((object) => (
              <ObjectChip key={`${object.objectId}-${object.relation}`} object={object} />
            ))}
          </ul>
        )}

        {/* Who took part in THIS entry. Shown per event, not only on the origination, because they
            are not always the same people: an advance can be originated with one party and settled
            by another, and a history that showed only the first would hide that. Omitted when the
            entry named nobody — there is no absence to report on a list that is simply empty. */}
        {event.parties.length > 0 && (
          <FactParties
            parties={event.parties}
            partyNames={partyNames}
            currency={event.currency}
            className="mt-2.5"
            heading={false}
          />
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
          {/* Where the fact came from. */}
          {event.source && <SourceRef source={event.source} />}
          {/* The event this one speaks about, named rather than pointed at. A bare id says a
              correction happened without saying what it corrected; this says which fact, for how
              much, and when — which is the whole point of publishing the link. */}
          {event.relatedEventId &&
            (relatedEvent ? (
              <span>
                {t.dashboard.lifecycle.relatedEvent}:{" "}
                <span className="font-semibold text-ink">
                  {t.eventType[relatedEvent.eventType] ?? relatedEvent.eventType}
                </span>{" "}
                <span className="tabular">
                  {formatMoney(relatedEvent.amount, relatedEvent.currency)} ·{" "}
                  {formatDate(relatedEvent.occurredAt)}
                </span>
              </span>
            ) : (
              // Outside this position's history, so there is nothing here to resolve it against.
              // Said in words: an unresolved id would read as a lookup that failed.
              <span className="inline-flex items-center gap-1.5">
                {t.dashboard.lifecycle.relatedElsewhere}
                <CopyableId value={event.relatedEventId} widths="max-w-[10ch] sm:max-w-none" />
              </span>
            ))}
          {canRectify &&
            (rectify.available ? (
              <Button type="button" size="sm" onClick={() => setRectifying(true)}>
                {t.dashboard.lifecycle.rectify}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled
                title={
                  rectify.reason === "unsupported"
                    ? t.dashboard.lifecycle.rectifyUnsupported
                    : t.dashboard.lifecycle.rectifyContextual
                }
              >
                {t.dashboard.lifecycle.rectify}
              </Button>
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
            <DatePicker
              label={t.dashboard.lifecycle.rectifyDate}
              value={occurredAt}
              disabled={saving}
              onChange={setOccurredAt}
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
          ? "border-accent bg-accent text-accent-ink"
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
