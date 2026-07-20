import type { ReactNode } from "react";
import { LifecycleMenu } from "@/features/operations/LifecycleMenu";
import { statusLabels } from "@/features/operations/copy";
import { cn } from "@/utils/cn";
import type { AuditEntry, IntentStatus } from "@/types/operations";

const dotClass = (status: IntentStatus | null): string => {
  if (!status) return "bg-muted";
  if (status === "accepted") return "bg-ok";
  if (status === "rejected") return "bg-bad";
  return "bg-warn";
};

const isSettled = (status: IntentStatus) => status === "accepted" || status === "rejected";

export interface OperationsShellProps {
  title: string;
  status: IntentStatus | null;
  history: AuditEntry[];
  ledgerReference?: string;
  onRestart: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function OperationsShell({
  title,
  status,
  history,
  ledgerReference,
  onRestart,
  children,
  footer,
}: OperationsShellProps) {
  return (
    <div className="glass mx-auto flex h-[32rem] max-w-3xl flex-col overflow-hidden md:h-[36rem]">
      <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 flex-shrink-0 place-items-center rounded-full bg-accent" aria-hidden>
            <svg viewBox="0 0 20 20" fill="none" className="size-[18px] text-accent-ink">
              <rect x="4" y="6.5" width="12" height="8.5" rx="3" stroke="currentColor" strokeWidth="1.4" />
              <path d="M10 3.2v3.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              <circle cx="10" cy="2.4" r="1" fill="currentColor" />
              <circle cx="7.4" cy="10.6" r="1" fill="currentColor" />
              <circle cx="12.6" cy="10.6" r="1" fill="currentColor" />
            </svg>
          </span>
          <div className="min-w-0">
            <div className="truncate font-display text-[15px] font-semibold text-ink">{title}</div>
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  dotClass(status),
                  status && !isSettled(status) && "animate-[pulse-dot_1.8s_ease-in-out_infinite]",
                )}
                aria-hidden
              />
              {status ? statusLabels[status] : "Pronto para ajudar"}
            </div>
          </div>
        </div>

        <LifecycleMenu status={status} history={history} ledgerReference={ledgerReference} onRestart={onRestart} />
      </header>

      <div className="relative flex-1 overflow-y-auto">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-10 left-1/4 h-72 w-72 rounded-full bg-accent/10 blur-[100px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-10 right-1/4 h-72 w-72 rounded-full bg-ok/10 blur-[100px]"
        />
        <div className="relative h-full p-5">{children}</div>
      </div>

      {footer && <div className="border-t border-line p-4">{footer}</div>}
    </div>
  );
}
