import { useState } from "react";
import { Badge } from "@/components/Badge";
import { eventLabels, statusLabels } from "@/features/operations/copy";
import { formatDateTime } from "@/utils/format";
import type { AuditEntry, IntentStatus } from "@/types/operations";

const badgeVariant = (status: IntentStatus): "neutral" | "ok" | "bad" | "warn" => {
  if (status === "accepted") return "ok";
  if (status === "rejected") return "bad";
  if (status === "draft") return "neutral";
  return "warn";
};

const isSettled = (status: IntentStatus) => status === "accepted" || status === "rejected";

export interface LifecycleMenuProps {
  status: IntentStatus | null;
  history: AuditEntry[];
  ledgerReference?: string;
  onRestart: () => void;
}

export function LifecycleMenu({ status, history, ledgerReference, onRestart }: LifecycleMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Mais opções"
        className="inline-flex size-8 items-center justify-center rounded-full text-muted transition hover:bg-ink/6 hover:text-ink dark:hover:bg-white/8"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-4">
          <circle cx="10" cy="4" r="1.6" />
          <circle cx="10" cy="10" r="1.6" />
          <circle cx="10" cy="16" r="1.6" />
        </svg>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="glass absolute right-0 top-10 z-40 w-72 p-4">
            {status ? (
              <div className="mb-3">
                <Badge variant={badgeVariant(status)} dot={isSettled(status) ? true : "pulse"}>
                  {statusLabels[status]}
                </Badge>
                {ledgerReference && <div className="tabular mt-2 text-xs text-muted">ref: {ledgerReference}</div>}
              </div>
            ) : (
              <p className="text-[13px] text-muted">Nenhuma atividade ainda.</p>
            )}

            {history.length > 0 && (
              <ul className="mb-3 max-h-48 space-y-2.5 overflow-y-auto border-t border-line pt-3">
                {history.map((h) => (
                  <li key={h.id} className="text-[13px]">
                    <div className="font-medium text-ink">{eventLabels[h.type] ?? h.type}</div>
                    <div className="tabular text-[11px] text-muted">{formatDateTime(h.at)}</div>
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onRestart();
              }}
              className="w-full rounded-xl px-3 py-2 text-left text-[13px] font-medium text-bad transition hover:bg-bad-soft"
            >
              Recomeçar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
