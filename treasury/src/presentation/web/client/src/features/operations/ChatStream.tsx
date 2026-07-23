import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { Banner } from "@/components/Banner";
import { Input } from "@/components/Input";
import { formatDate, formatMoney } from "@/utils/format";
import { cn } from "@/utils/cn";
import { typingDurationMs } from "@/features/operations/typing";
import type { StreamItem } from "@/features/operations/useConversation";
import type { PreviewIntentResult, SlotDefinition } from "@/types/operations";

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
}

const bubbleBase = "max-w-[80%] lg:max-w-2xl px-4 py-2.5 text-[14.5px] leading-relaxed";

/** Reveals `text` one character at a time — faster per character the longer it is — over `typingDurationMs(text)`. */
function TypedText({ text, onTick }: { text: string; onTick?: () => void }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(0);
    if (text.length === 0) return;
    const stepMs = Math.max(8, typingDurationMs(text) / text.length);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setCount(i);
      onTick?.();
      if (i >= text.length) clearInterval(id);
    }, stepMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

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
}: ChatStreamProps) {
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
              />
            );
          case "result":
            return item.status === "accepted" ? (
              <Banner key={item.id} variant="ok" className="flex flex-wrap items-center justify-between gap-3">
                <span>✓ Aceito pelo Ledger — referência {item.ledgerReference}</span>
                <button
                  type="button"
                  onClick={onCancel}
                  className="inline-flex items-center gap-1.5 rounded-full bg-ok/15 px-3 py-1.5 text-xs font-semibold text-ok transition hover:bg-ok/25"
                >
                  <svg viewBox="0 0 20 20" fill="none" className="size-3.5">
                    <path
                      d="M12 4.5 6.5 10l5.5 5.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Voltar para operações
                </button>
              </Banner>
            ) : (
              <Banner key={item.id} variant="bad">
                ✕ Rejeitado — {item.reason}
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
              {choice}
            </button>
          ))}
        </div>
      )}

      <div ref={bottomRef} />
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
              {choice}
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

function ConfirmCard({
  preview,
  scenarioTitle,
  busy,
  onConfirm,
  onCancel,
  answeredSlots,
  onSaveEdits,
}: {
  preview: PreviewIntentResult;
  scenarioTitle: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  answeredSlots: Record<string, SlotDefinition>;
  onSaveEdits: (edits: Record<string, string>) => Promise<SaveEditsResult>;
}) {
  const { candidate } = preview;
  const counterparty = candidate.parties[1]?.partyId ?? "—";
  const isCashIn = candidate.economicEffect === "cash_in";
  const effectPhrase = isCashIn ? "entrada de caixa prevista" : "saída de caixa a pagar";
  const [showDetails, setShowDetails] = useState(false);
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [fieldError, setFieldError] = useState<{ key: string; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const slots = Object.values(answeredSlots);

  const startEditing = () => {
    setValues({ ...preview.answers });
    setFieldError(null);
    setEditing(true);
  };

  const saveEdits = async () => {
    const changed = Object.fromEntries(Object.entries(values).filter(([key, value]) => preview.answers[key] !== value));
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
        <Badge variant={isCashIn ? "ok" : "bad"}>{isCashIn ? "Entrada" : "Saída"}</Badge>
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
            <span className="font-semibold">Efeito financeiro:</span> {effectPhrase} de{" "}
            {formatMoney(candidate.amount, candidate.currency)}, atribuído a você.
          </p>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-2.5">
        <Button loading={busy} onClick={onConfirm}>
          Confirmar e enviar
        </Button>
        <div className="flex gap-2.5">
          <Button variant="warn" disabled={busy} onClick={startEditing} className="flex-1">
            Editar
          </Button>
          <Button variant="ghost" disabled={busy} onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
        </div>
      </div>
    </Card>
  );
}
