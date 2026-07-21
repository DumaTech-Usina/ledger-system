import { useEffect, useRef, type ReactNode } from "react";
import { LifecycleMenu } from "@/features/operations/LifecycleMenu";
import { ChatAurora } from "@/features/operations/ChatAurora";
import { statusLabels } from "@/features/operations/copy";
import { cn } from "@/utils/cn";
import chatAnimation from "@/assets/chat animation.mp4";
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
  /** The shell has fully faded in — only then does the ambient video start playing. */
  ready?: boolean;
}

export function OperationsShell({
  title,
  status,
  history,
  ledgerReference,
  onRestart,
  children,
  footer,
  ready = true,
}: OperationsShellProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (ready) video.play().catch(() => {});
    else video.pause();
  }, [ready]);

  return (
    <div className="glass relative mx-auto flex h-[calc(100vh-14rem)] min-h-[30rem] max-w-3xl flex-col overflow-hidden">
      <ChatAurora />
      {/* Dark theme (default): the mp4 loop, full strength, anchored to the panel's own bottom edge —
          behind the composer too, not just the message list — so it stays put for the whole session,
          starting only once `ready` (the shell has fully faded in). Light theme: the aurora waves instead. */}
      <video
        ref={videoRef}
        aria-hidden
        loop
        muted
        playsInline
        className="pointer-events-none absolute bottom-0 left-0 hidden h-64 w-full object-cover [mask-image:linear-gradient(to_top,black_70%,transparent)] dark:block md:h-72"
      >
        <source src={chatAnimation} type="video/mp4" />
      </video>
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 left-1/4 h-72 w-72 rounded-full bg-accent/10 blur-[100px]"
      />

      <header className="relative flex items-center justify-between gap-3 border-b border-line px-5 py-4">
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

      <div className="relative flex-1 overflow-y-auto p-5">{children}</div>

      {footer && (
        <div className="relative border-t border-line bg-canvas/25 p-4 backdrop-blur-md dark:bg-canvas/35">{footer}</div>
      )}
    </div>
  );
}
