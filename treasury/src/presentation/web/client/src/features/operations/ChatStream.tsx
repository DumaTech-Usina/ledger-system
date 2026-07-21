import { useEffect, useRef } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Banner } from "@/components/Banner";
import { formatDate, formatMoney } from "@/utils/format";
import { cn } from "@/utils/cn";
import type { StreamItem } from "@/features/operations/useConversation";
import type { PreviewIntentResult } from "@/types/operations";

export interface ChatStreamProps {
  stream: StreamItem[];
  scenarioTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}

const bubbleBase = "max-w-[80%] px-4 py-2.5 text-[14.5px] leading-relaxed";

export function ChatStream({ stream, scenarioTitle, onConfirm, onCancel, busy }: ChatStreamProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [stream]);

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
                  {item.text}
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
                <div className={cn(bubbleBase, "rounded-2xl rounded-bl-md bg-bad-soft text-bad")}>{item.text}</div>
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
              />
            );
          case "result":
            return item.status === "accepted" ? (
              <Banner key={item.id} variant="ok">
                ✓ Aceito pelo Ledger — referência {item.ledgerReference}
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
      <div ref={bottomRef} />
    </div>
  );
}

function ConfirmCard({
  preview,
  scenarioTitle,
  busy,
  onConfirm,
  onCancel,
}: {
  preview: PreviewIntentResult;
  scenarioTitle: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { candidate } = preview;
  const counterparty = candidate.parties[1]?.partyId ?? "—";
  const effectPhrase = candidate.economicEffect === "cash_in" ? "entrada de caixa prevista" : "saída de caixa a pagar";

  return (
    <Card>
      <h4 className="font-display text-[15px] font-semibold text-ink">Confirme antes de registrar</h4>
      <p className="mt-0.5 text-[13px] text-muted">
        É exatamente isto que será proposto ao Ledger. Nada é registrado até você confirmar.
      </p>

      <dl className="mt-4 grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-[13.5px]">
        <dt className="text-muted">Operação</dt>
        <dd className="font-semibold text-ink">{scenarioTitle}</dd>
        <dt className="text-muted">Valor</dt>
        <dd className="tabular font-semibold text-ink">{formatMoney(candidate.amount, candidate.currency)}</dd>
        <dt className="text-muted">Contraparte</dt>
        <dd className="font-semibold text-ink">{counterparty}</dd>
        <dt className="text-muted">Data</dt>
        <dd className="tabular font-semibold text-ink">{formatDate(candidate.occurredAt)}</dd>
        {candidate.description && (
          <>
            <dt className="text-muted">Descrição</dt>
            <dd className="font-semibold text-ink">{candidate.description}</dd>
          </>
        )}
      </dl>

      <div className="mt-4 rounded-2xl bg-accent-soft px-3.5 py-2.5 text-[13.5px] text-ink">
        <span className="font-semibold">Efeito financeiro:</span> {effectPhrase} de{" "}
        {formatMoney(candidate.amount, candidate.currency)}, atribuído a você.
      </div>

      <div className="mt-4 flex gap-2.5">
        <Button loading={busy} onClick={onConfirm}>
          Confirmar e enviar
        </Button>
        <Button variant="ghost" disabled={busy} onClick={onCancel}>
          Voltar ao início
        </Button>
      </div>
    </Card>
  );
}
