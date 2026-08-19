import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { Banner } from "@/components/Banner";
import { Input } from "@/components/Input";
import { formatDate, formatDocument, formatMoney } from "@/utils/format";
import { cn } from "@/utils/cn";
import { typingDurationMs } from "@/features/operations/typing";
import { useTypingAnimationDisabled } from "@/hooks/useAnimationsDisabled";
import { useLanguage } from "@/i18n/i18n";
import {
  enrichmentCopy,
  identityCopy,
  partyTypeChoices,
  partyTypeLabels,
  positionCopy,
  rejectionSummary,
  rejectionText,
  statusLabels,
  submitCopy,
} from "@/features/operations/copy";
import {
  editableAnswers,
  type IdentityOption,
  type StreamItem,
} from "@/features/operations/conversationEngine";
import type {
  EnrichmentSuggestion,
  PreviewIntentResult,
  RejectionDetail,
  SettlementCandidate,
  SlotDefinition,
} from "@/types/operations";

export interface SaveEditsResult {
  ok: boolean;
  error?: { key: string; message: string };
}

export interface ChatStreamProps {
  stream: StreamItem[];
  scenarioTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
  /** When this is a "choice" slot (e.g. BRL/USD), its options render inline below, as a live
   * preview of the answer — not in the composer. */
  currentSlot?: SlotDefinition | null;
  onAnswer?: (value: string) => void;
  /** Every slot answered so far, keyed by slot key — lets "Editar" rebuild a proper field per slot. */
  answeredSlots?: Record<string, SlotDefinition>;
  onSaveEdits?: (edits: Record<string, string>) => Promise<SaveEditsResult>;
  /** Sim/Não on a low-confidence extraction suggestion bubble. */
  onResolveSuggestion?: (item: { id: string; proposalKey: string; value: string }, accept: boolean) => void;
  /** Settles an open counterparty question. `justification` is required to declare unidentifiable. */
  onDecideIdentity?: (item: { id: string; slot: string }, option: IdentityOption, justification?: string) => void;
  /** Answers the confirmation card's optional question, or records the refusal (value omitted). */
  onRecordEnrichment?: (partyId: string, key: string, value?: string) => Promise<{ ok: boolean }>;
  /** Re-answers the slots a fixable rejection implicated, then returns to the confirmation card. */
  onApplyCorrection?: (edits: Record<string, string>) => Promise<SaveEditsResult>;
  /** Records which position a settlement is about — asserting continuity and lineage together. */
  onSelectPosition?: (
    item: { id: string; slots: { continuity?: string; lineage?: string } },
    candidate: SettlementCandidate,
  ) => void;
  /** Puts the offer away; the composer still accepts a typed reference. */
  onDismissPositions?: (itemId: string) => void;
}

const bubbleBase = "max-w-[80%] lg:max-w-2xl px-4 py-2.5 text-[14.5px] leading-relaxed";

/** Reveals `text` one character at a time — faster per character the longer it is — over
 * `typingDurationMs(text)`. Shows the full text immediately when animations are disabled.
 *
 * Toggling animations back on must never retroactively replay a message that already finished
 * revealing — `revealedRef` remembers that per message, so only messages that arrive *after* the
 * toggle actually animate; anything already on screen just stays on screen. */
function TypedText({ text, onTick }: { text: string; onTick?: () => void }) {
  const typingHidden = useTypingAnimationDisabled();
  const [count, setCount] = useState(0);
  const revealedRef = useRef(false);
  const lastTextRef = useRef(text);

  if (lastTextRef.current !== text) {
    lastTextRef.current = text;
    revealedRef.current = false;
  }

  useEffect(() => {
    if (revealedRef.current) return;

    if (typingHidden) {
      setCount(text.length);
      revealedRef.current = true;
      return;
    }

    setCount(0);
    if (text.length === 0) {
      revealedRef.current = true;
      return;
    }
    const stepMs = Math.max(8, typingDurationMs(text) / text.length);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setCount(i);
      onTick?.();
      if (i >= text.length) {
        clearInterval(id);
        revealedRef.current = true;
      }
    }, stepMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, typingHidden]);

  return <>{text.slice(0, count)}</>;
}

export function ChatStream({
  stream,
  scenarioTitle,
  onConfirm,
  onCancel,
  busy,
  currentSlot,
  onAnswer,
  answeredSlots,
  onSaveEdits,
  onResolveSuggestion,
  onDecideIdentity,
  onRecordEnrichment,
  onApplyCorrection,
  onSelectPosition,
  onDismissPositions,
}: ChatStreamProps) {
  const { t } = useLanguage();
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = () => bottomRef.current?.scrollIntoView({ block: "end" });
  const showInlineChoices = currentSlot?.type === "choice" && !!currentSlot.choices?.length;

  useEffect(() => {
    scrollToBottom();
  }, [stream, showInlineChoices]);

  return (
    <div className="flex flex-col gap-4">
      {stream.map((item) => {
        switch (item.kind) {
          case "bot":
            return (
              <div key={item.id} className="flex justify-start">
                <div
                  className={cn(
                    bubbleBase,
                    "rounded-2xl rounded-bl-md border border-white/40 bg-panel-solid/85 text-ink shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-panel-solid/80",
                  )}
                >
                  <TypedText text={item.text} onTick={scrollToBottom} />
                </div>
              </div>
            );
          case "user":
            return (
              <div key={item.id} className="flex justify-end">
                <div className={cn(bubbleBase, "rounded-2xl rounded-br-md bg-accent text-accent-ink")}>{item.text}</div>
              </div>
            );
          case "error":
            return (
              <div key={item.id} className="flex justify-start">
                <div className={cn(bubbleBase, "rounded-2xl rounded-bl-md bg-bad-soft text-bad")}>
                  <TypedText text={item.text} onTick={scrollToBottom} />
                </div>
              </div>
            );
          case "suggestion":
            return (
              <div key={item.id} className="flex justify-start">
                <div
                  className={cn(
                    bubbleBase,
                    "flex flex-col gap-2 rounded-2xl rounded-bl-md border border-white/40 bg-panel-solid/85 text-ink shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-panel-solid/80",
                  )}
                >
                  <span>
                    Achei <strong>"{item.value}"</strong> para {item.label.toLowerCase()} — confirma?
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onResolveSuggestion?.(item, true)}
                      className="rounded-full border border-accent/40 bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink transition hover:opacity-90"
                    >
                      Sim
                    </button>
                    <button
                      type="button"
                      onClick={() => onResolveSuggestion?.(item, false)}
                      className="rounded-full border border-line bg-panel-solid px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-accent"
                    >
                      Não
                    </button>
                  </div>
                </div>
              </div>
            );
          case "identity":
            return (
              <IdentityBubble
                key={item.id}
                text={item.text}
                options={item.options}
                busy={busy}
                onDecide={(option, justification) =>
                  onDecideIdentity?.({ id: item.id, slot: item.slot }, option, justification)
                }
                onReveal={scrollToBottom}
              />
            );
          case "positions":
            return (
              <PositionPicker
                key={item.id}
                candidates={item.candidates}
                busy={busy}
                onPick={(candidate) => onSelectPosition?.({ id: item.id, slots: item.slots }, candidate)}
                onDismiss={() => onDismissPositions?.(item.id)}
              />
            );
          case "transport-error":
            return (
              <Banner key={item.id} variant="bad">
                Não foi possível falar com o Ledger agora. Tente novamente.
              </Banner>
            );
          case "confirm":
            return (
              <ConfirmCard
                key={item.id}
                preview={item.preview}
                scenarioTitle={scenarioTitle}
                busy={busy}
                onConfirm={onConfirm}
                onCancel={onCancel}
                answeredSlots={answeredSlots ?? {}}
                onSaveEdits={onSaveEdits ?? (async () => ({ ok: false }))}
                onRecordEnrichment={onRecordEnrichment}
              />
            );
          case "result":
            // A fixable rejection is not an ending — it names what to change and offers the way to.
            if (item.intentStatus === "awaiting_correction") {
              return (
                <CorrectionCard
                  key={item.id}
                  rejections={item.rejections ?? []}
                  slots={(item.correctionSlots ?? [])
                    .map((key) => (answeredSlots ?? {})[key])
                    .filter((slot): slot is SlotDefinition => Boolean(slot))}
                  busy={busy}
                  onApply={onApplyCorrection ?? (async () => ({ ok: false }))}
                />
              );
            }
            return item.status === "accepted" ? (
              <Banner key={item.id} variant="ok">
                ✓ Aceito pelo Ledger — referência {item.ledgerReference}
              </Banner>
            ) : (
              <Banner key={item.id} variant="bad">
                ✕ Rejeitado — {rejectionSummary(item.rejections ?? [], t)}
              </Banner>
            );
          default:
            return null;
        }
      })}

      {showInlineChoices && (
        <div className="flex flex-wrap justify-start gap-2 pl-1">
          {currentSlot!.choices!.map((choice) => (
            <button
              key={choice}
              type="button"
              disabled={busy}
              onClick={() => onAnswer?.(choice)}
              className="rounded-full border border-line bg-panel-solid px-4 py-2 text-sm font-semibold text-ink shadow-sm transition hover:border-accent hover:bg-accent hover:text-accent-ink disabled:opacity-50 disabled:pointer-events-none"
            >
              {t.slotChoice[choice] ?? choice}
            </button>
          ))}
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}

/**
 * Which position this settlement is about, answered by recognising a fact rather than by typing an
 * id: who it involved, how much it was, and when it started.
 *
 * "Não está na lista" only dismisses the offer — the composer underneath still accepts a typed
 * reference, so the list can never become the sole way through.
 */
function PositionPicker({
  candidates,
  busy,
  onPick,
  onDismiss,
}: {
  candidates: SettlementCandidate[];
  busy: boolean;
  onPick: (candidate: SettlementCandidate) => void;
  onDismiss: () => void;
}) {
  return (
    <div className="flex justify-start">
      <div className="flex w-full max-w-md flex-col gap-2">
        <p className="px-1 text-[13px] text-muted">{positionCopy.prompt}</p>

        {candidates.map((candidate) => (
          <button
            key={candidate.objectId}
            type="button"
            disabled={busy}
            onClick={() => onPick(candidate)}
            className={cn(
              "rounded-2xl border border-white/40 bg-panel-solid/85 p-3.5 text-left shadow-sm backdrop-blur-md transition",
              "hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-glow",
              "disabled:opacity-50 disabled:pointer-events-none dark:border-white/10 dark:bg-panel-solid/80",
            )}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[14px] font-semibold text-ink">
                {candidate.counterparty ?? positionCopy.unknownCounterparty}
              </span>
              <span className="tabular text-[14px] font-semibold text-ink">
                {formatMoney(candidate.totalOriginated, candidate.currency)}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 text-[12px] text-muted">
              <span>
                {candidate.originatedAt
                  ? `${positionCopy.originatedOn} ${formatDate(candidate.originatedAt)}`
                  : positionCopy.unknownDate}
              </span>
              {/* Only when part of it came back already — otherwise the figure would just repeat. */}
              {candidate.openBalance && (
                <span className="tabular">
                  {positionCopy.stillOpen} {formatMoney(candidate.openBalance, candidate.currency)}
                </span>
              )}
            </div>
          </button>
        ))}

        <button
          type="button"
          disabled={busy}
          onClick={onDismiss}
          className="self-start px-1 text-[12px] font-semibold text-muted underline underline-offset-2 transition hover:text-ink disabled:opacity-50 disabled:pointer-events-none"
        >
          {positionCopy.notListed}
        </button>
      </div>
    </div>
  );
}

/**
 * A rejection the Ledger classified as fixable. It shows what the Ledger objected to, in the
 * Ledger's own words, and re-opens only the slots that complaint maps back to — re-asking the whole
 * conversation would treat a precise objection as a general failure.
 *
 * Saving does not resubmit. It returns to the confirmation card, so nothing is sent again without
 * the user seeing exactly what will go.
 */
function CorrectionCard({
  rejections,
  slots,
  busy,
  onApply,
}: {
  rejections: RejectionDetail[];
  slots: SlotDefinition[];
  busy: boolean;
  onApply: (edits: Record<string, string>) => Promise<SaveEditsResult>;
}) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [fieldError, setFieldError] = useState<{ key: string; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const result = await onApply(values);
    setSaving(false);
    if (!result.ok) {
      setFieldError(result.error ?? null);
      return;
    }
    setEditing(false);
  };

  return (
    <Card padding="lg" className="max-w-md bg-panel-solid/75 backdrop-blur-2xl">
      <div className="flex items-start justify-between gap-3">
        <h4 className="font-display text-lg font-bold text-ink">{submitCopy.correctionTitle}</h4>
        <Badge variant="warn">{statusLabels.awaiting_correction}</Badge>
      </div>

      {rejections.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-line pt-3 text-[13px]">
          {rejections.map((rejection) => (
            <li key={rejection.code}>
              <span className="text-ink">{rejectionText(rejection, t)}</span>
              <span className="tabular ml-1.5 text-[11px] text-muted">{rejection.code}</span>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <>
          <div className="mt-4 flex flex-col gap-4">
            {slots.map((slot) => (
              <EditField
                key={slot.key}
                slot={slot}
                value={values[slot.key] ?? ""}
                onChange={(value) => setValues((s) => ({ ...s, [slot.key]: value }))}
                disabled={saving}
                error={fieldError?.key === slot.key ? fieldError.message : undefined}
              />
            ))}
          </div>
          <div className="mt-5 flex gap-2.5">
            <Button loading={saving} onClick={save} className="flex-1">
              {submitCopy.correctionSave}
            </Button>
            <Button variant="ghost" disabled={saving} onClick={() => setEditing(false)}>
              {submitCopy.correctionCancel}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-3 text-[13px] text-muted">{submitCopy.correctionHint}</p>
          <Button
            variant="warn"
            disabled={busy || slots.length === 0}
            onClick={() => {
              setValues({});
              setFieldError(null);
              setEditing(true);
            }}
            className="mt-4 w-full"
          >
            {submitCopy.correctionAction}
          </Button>
        </>
      )}
    </Card>
  );
}

/**
 * The counterparty question. Its options are ordered so the first one is the likely move — a
 * candidate when there are candidates, creating when there are none — and declaring the
 * counterparty unidentifiable stays a quiet escape rather than an equal choice.
 *
 * That last option asks for a justification before it commits, because the backend requires one and
 * discovering that through a 422 would be a worse way to learn it.
 */
function IdentityBubble({
  text,
  options,
  busy,
  onDecide,
  onReveal,
}: {
  text: string;
  options: IdentityOption[];
  busy: boolean;
  onDecide: (option: IdentityOption, justification?: string) => void;
  onReveal?: () => void;
}) {
  const [justifying, setJustifying] = useState<IdentityOption | null>(null);
  const [justification, setJustification] = useState("");

  const decidable = options.filter((o) => o.kind !== "unidentifiable");
  const escape = options.find((o) => o.kind === "unidentifiable");

  return (
    <div className="flex justify-start">
      <div
        className={cn(
          bubbleBase,
          "flex flex-col gap-3 rounded-2xl rounded-bl-md border border-white/40 bg-panel-solid/85 text-ink shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-panel-solid/80",
        )}
      >
        <span>
          <TypedText text={text} onTick={onReveal} />
        </span>

        {justifying ? (
          <div className="flex flex-col gap-2.5">
            <Input
              label={identityCopy.justificationLabel}
              value={justification}
              disabled={busy}
              autoFocus
              onChange={(e) => setJustification(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || justification.trim() === ""}
                onClick={() => onDecide(justifying, justification.trim())}
                className="rounded-full border border-accent/40 bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink transition hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none"
              >
                {identityCopy.justificationConfirm}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setJustifying(null)}
                className="rounded-full border border-line bg-panel-solid px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-accent"
              >
                {identityCopy.justificationCancel}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {decidable.map((option, index) => (
                <button
                  key={option.kind === "select" ? option.partyId : option.kind}
                  type="button"
                  disabled={busy}
                  onClick={() => onDecide(option)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 disabled:pointer-events-none",
                    index === 0
                      ? "border border-accent/40 bg-accent text-accent-ink hover:opacity-90"
                      : "border border-line bg-panel-solid text-ink hover:border-accent",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
              <span>{identityCopy.retype}</span>
              {escape && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setJustification("");
                    setJustifying(escape);
                  }}
                  className="font-semibold text-muted underline underline-offset-2 transition hover:text-ink disabled:opacity-50 disabled:pointer-events-none"
                >
                  {escape.label}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className={cn("text-right font-semibold text-ink", mono && "tabular")}>{value}</dd>
    </div>
  );
}

function EditField({
  slot,
  value,
  onChange,
  disabled,
  error,
}: {
  slot: SlotDefinition;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  error?: string;
}) {
  const { t } = useLanguage();

  if (slot.type === "choice" && slot.choices) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-muted">{slot.prompt}</span>
        <div className="flex flex-wrap gap-2">
          {slot.choices.map((choice) => (
            <button
              key={choice}
              type="button"
              disabled={disabled}
              onClick={() => onChange(choice)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-semibold transition disabled:opacity-50 disabled:pointer-events-none",
                choice === value
                  ? "border-accent bg-accent text-accent-ink"
                  : "border-line bg-panel-solid text-ink hover:border-accent",
              )}
            >
              {t.slotChoice[choice] ?? choice}
            </button>
          ))}
        </div>
        {error && <span className="text-xs font-medium text-bad">{error}</span>}
      </div>
    );
  }

  return (
    <Input
      label={slot.prompt}
      type={slot.type === "money" ? "number" : slot.type === "date" ? "date" : "text"}
      step={slot.type === "money" ? "0.01" : undefined}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      error={error}
    />
  );
}

/**
 * The one optional question, offered beside the confirmation — never in front of it. It cannot
 * block the submit, so it owns no `busy` state of its own and its outcome changes nothing about
 * what will be recorded.
 */
function EnrichmentOffer({
  suggestion,
  disabled,
  onRecord,
}: {
  suggestion: EnrichmentSuggestion;
  disabled: boolean;
  onRecord: (value?: string) => Promise<{ ok: boolean }>;
}) {
  const [value, setValue] = useState("");
  const [settled, setSettled] = useState<"saved" | "declined" | null>(null);
  const [saving, setSaving] = useState(false);

  const record = async (given?: string) => {
    setSaving(true);
    const { ok } = await onRecord(given);
    setSaving(false);
    if (ok) setSettled(given ? "saved" : "declined");
  };

  if (settled) {
    return (
      <p className="mt-4 border-t border-line pt-4 text-[13px] text-muted">
        {settled === "saved" ? enrichmentCopy.saved : enrichmentCopy.declined}
      </p>
    );
  }

  const isType = suggestion.attribute === "type";
  // CPF/CNPJ is the one attribute with a shape worth showing while it's typed — the separators tell
  // the operator which of the two they're entering, and where they are in it.
  const isDocument = suggestion.attribute === "document";
  const question = enrichmentCopy.question(suggestion.displayName, suggestion.attribute);

  return (
    <div className="mt-4 border-t border-line pt-4">
      <p className="text-[13px] text-muted">{question}</p>

      {isType ? (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {partyTypeChoices.map((choice) => (
            <button
              key={choice}
              type="button"
              disabled={disabled || saving}
              onClick={() => record(choice)}
              className="rounded-full border border-line bg-panel-solid px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-accent disabled:opacity-50 disabled:pointer-events-none"
            >
              {partyTypeLabels[choice] ?? choice}
            </button>
          ))}
        </div>
      ) : (
        // `Input` renders its own wrapper, so the growing flex child has to be that wrapper — sizing
        // the inner field alone leaves it at its intrinsic width and strands the button mid-row.
        <div className="mt-2.5 flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <Input
              value={value}
              disabled={disabled || saving}
              aria-label={question}
              inputMode={isDocument ? "numeric" : undefined}
              placeholder={isDocument ? "000.000.000-00" : undefined}
              onChange={(e) => setValue(isDocument ? formatDocument(e.target.value) : e.target.value)}
              className={cn("w-full", isDocument && "tabular")}
            />
          </div>
          <button
            type="button"
            disabled={disabled || saving || value.trim() === ""}
            onClick={() => record(value.trim())}
            className="h-10 shrink-0 rounded-full border border-line bg-panel-solid px-3.5 text-[13px] font-semibold text-ink transition hover:border-accent disabled:opacity-50 disabled:pointer-events-none"
          >
            {enrichmentCopy.save}
          </button>
        </div>
      )}

      <button
        type="button"
        disabled={disabled || saving}
        onClick={() => record(undefined)}
        className="mt-2 text-[12px] font-semibold text-muted underline underline-offset-2 transition hover:text-ink disabled:opacity-50 disabled:pointer-events-none"
      >
        {enrichmentCopy.decline}
      </button>
    </div>
  );
}

function ConfirmCard({
  preview,
  scenarioTitle,
  busy,
  onConfirm,
  onCancel,
  answeredSlots,
  onSaveEdits,
  onRecordEnrichment,
}: {
  preview: PreviewIntentResult;
  scenarioTitle: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  answeredSlots: Record<string, SlotDefinition>;
  onSaveEdits: (edits: Record<string, string>) => Promise<SaveEditsResult>;
  onRecordEnrichment?: (partyId: string, key: string, value?: string) => Promise<{ ok: boolean }>;
}) {
  const { candidate } = preview;
  const counterpartyId = candidate.parties[1]?.partyId;
  // A party the Directory doesn't know keeps its id on screen. Unknown is shown as unknown — an
  // invented label would be a claim the system cannot support.
  const counterparty = counterpartyId ? preview.partyNames[counterpartyId] ?? counterpartyId : "—";
  // Only `cash_in`/`cash_out` move cash. Everything else the Ledger can say here — `non_cash`,
  // `cash_internal`, `contingent` — books a position without a movement, and must read as neither an
  // inflow nor an outflow: labelling it "Saída" would claim money left when none did.
  const cashEffect =
    candidate.economicEffect === "cash_in"
      ? { label: "Entrada", badgeVariant: "ok" as const, phrase: "entrada de caixa prevista" }
      : candidate.economicEffect === "cash_out"
        ? { label: "Saída", badgeVariant: "bad" as const, phrase: "saída de caixa a pagar" }
        : { label: "Sem movimento de caixa", badgeVariant: "neutral" as const, phrase: null as string | null };
  const [showDetails, setShowDetails] = useState(false);
  const [editing, setEditing] = useState(false);
  // Locked in as soon as "Confirmar e enviar" is clicked — `busy` alone is not enough, since it
  // clears again once the request settles, and this card must stay locked either way (accepted,
  // rejected, or a correction to make): the same card is never submitted twice.
  const [sent, setSent] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  // What the form was seeded with, which is not the same as `preview.answers` — a PARTY slot shows a
  // name where the answer holds an id. Diffing against what was on screen is what keeps an untouched
  // field untouched; diffing against the raw answers would read every party field as edited.
  const [baseline, setBaseline] = useState<Record<string, string>>({});
  const [fieldError, setFieldError] = useState<{ key: string; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const slots = Object.values(answeredSlots);

  const startEditing = () => {
    const seeded = editableAnswers(preview.answers, answeredSlots, preview.partyNames);
    setBaseline(seeded);
    setValues(seeded);
    setFieldError(null);
    setEditing(true);
  };

  const saveEdits = async () => {
    const changed = Object.fromEntries(Object.entries(values).filter(([key, value]) => baseline[key] !== value));
    if (Object.keys(changed).length === 0) {
      setEditing(false);
      return;
    }
    setSaving(true);
    const result = await onSaveEdits(changed);
    setSaving(false);
    if (!result.ok) {
      setFieldError(result.error ?? null);
      return;
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <Card glow padding="lg" className="max-w-md bg-panel-solid/75 backdrop-blur-2xl">
        <h4 className="font-display text-lg font-bold text-ink">Editar informações</h4>
        <p className="mt-0.5 text-[13px] text-muted">Altere o que quiser — nada é enviado até você salvar.</p>

        <div className="mt-5 flex flex-col gap-4">
          {slots.map((slot) => (
            <EditField
              key={slot.key}
              slot={slot}
              value={values[slot.key] ?? ""}
              onChange={(value) => setValues((s) => ({ ...s, [slot.key]: value }))}
              disabled={saving}
              error={fieldError?.key === slot.key ? fieldError.message : undefined}
            />
          ))}
        </div>

        <div className="mt-5 flex gap-2.5">
          <Button loading={saving} onClick={saveEdits} className="flex-1">
            Salvar alterações
          </Button>
          <Button variant="ghost" disabled={saving} onClick={() => setEditing(false)}>
            Cancelar edição
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card glow padding="lg" className="max-w-md bg-panel-solid/75 backdrop-blur-2xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-display text-lg font-bold text-ink">Confirme antes de registrar</h4>
          <p className="mt-0.5 text-[13px] text-muted">{scenarioTitle}</p>
        </div>
        <Badge variant={cashEffect.badgeVariant}>{cashEffect.label}</Badge>
      </div>

      <p className="tabular mt-5 text-3xl font-bold text-ink">{formatMoney(candidate.amount, candidate.currency)}</p>
      <p className="mt-1 text-[13px] text-muted">Nada é enviado ao Ledger até você confirmar.</p>

      <dl className="mt-5 space-y-3 border-t border-line pt-4 text-[13.5px]">
        <SummaryRow label="Contraparte" value={counterparty} />
        <SummaryRow label="Data" value={formatDate(candidate.occurredAt)} mono />
        {candidate.description && <SummaryRow label="Descrição" value={candidate.description} />}
      </dl>

      <button
        type="button"
        onClick={() => setShowDetails((v) => !v)}
        className="mt-3 text-[13px] font-semibold text-accent transition hover:underline"
      >
        {showDetails ? "Ocultar detalhes" : "Detalhes"}
      </button>

      {showDetails && (
        <div className="mt-3 space-y-3 rounded-2xl bg-accent-soft px-3.5 py-3 text-[13.5px] text-ink">
          <SummaryRow label="Operação" value={scenarioTitle} />
          <SummaryRow label="Valor" value={formatMoney(candidate.amount, candidate.currency)} mono />
          <p>
            <span className="font-semibold">Efeito financeiro:</span>{" "}
            {cashEffect.phrase ? (
              <>
                {cashEffect.phrase} de {formatMoney(candidate.amount, candidate.currency)}, atribuído a você.
              </>
            ) : (
              <>
                nenhuma movimentação de caixa — apenas o registro de uma posição de{" "}
                {formatMoney(candidate.amount, candidate.currency)}.
              </>
            )}
          </p>
        </div>
      )}

      {preview.enrichment && onRecordEnrichment && (
        <EnrichmentOffer
          suggestion={preview.enrichment}
          disabled={busy}
          onRecord={(value) => onRecordEnrichment(preview.enrichment!.partyId, preview.enrichment!.attribute, value)}
        />
      )}

      <div className="mt-5 flex flex-col gap-2.5">
        <Button
          loading={busy}
          disabled={sent}
          onClick={() => {
            setSent(true);
            onConfirm();
          }}
        >
          {sent ? "Enviado" : "Confirmar e enviar"}
        </Button>
        {sent ? (
          <Button variant="ghost" onClick={onCancel}>
            Voltar
          </Button>
        ) : (
          <div className="flex gap-2.5">
            <Button variant="warn" disabled={busy} onClick={startEditing} className="flex-1">
              Editar
            </Button>
            <Button variant="ghost" disabled={busy} onClick={onCancel} className="flex-1">
              Cancelar
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
