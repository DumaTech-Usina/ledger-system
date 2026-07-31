import { useEffect, useRef, useState, type ReactNode } from "react";
import { LifecycleMenu } from "@/features/operations/LifecycleMenu";
import { ChatAurora } from "@/features/operations/ChatAurora";
import { statusLabels } from "@/features/operations/copy";
import {
  useVideoAnimationDisabled,
  setVideoAnimationDisabled,
  useTypingAnimationDisabled,
  setTypingAnimationDisabled,
} from "@/hooks/useAnimationsDisabled";
import { cn } from "@/utils/cn";
import chatAnimation from "@/assets/chat animation.mp4";
import type { AuditEntry, IntentStatus } from "@/types/operations";

/** useTheme() only reflects the instance that toggled it — watch the <html class> directly
    so this reacts to theme changes made elsewhere (e.g. the topbar toggle). */
function useIsDarkMode(): boolean {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    const sync = () => setIsDark(document.documentElement.classList.contains("dark"));
    // Effects run after every component has rendered, so the toggle that owns the class
    // (mounted anywhere in the tree) may have already applied it by the time this attaches.
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

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
  const isDark = useIsDarkMode();
  const videoHidden = useVideoAnimationDisabled();
  const typingHidden = useTypingAnimationDisabled();

  // The video stays mounted and playing through the fade-out (so the motion behind it feels
  // alive) and only actually pauses once fully transparent. Revealing it always restarts
  // playback from the first frame, in step with the fade-in.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isDark || !ready) {
      video?.pause();
      return;
    }

    if (videoHidden) {
      const handleTransitionEnd = (e: TransitionEvent) => {
        if (e.propertyName === "opacity") video.pause();
      };
      video.addEventListener("transitionend", handleTransitionEnd);
      return () => video.removeEventListener("transitionend", handleTransitionEnd);
    }

    video.currentTime = 0;
    video.play().catch(() => {});
  }, [isDark, ready, videoHidden]);

  return (
    <div className="glass relative mx-auto flex h-[calc(100vh-11.5rem)] min-h-[32rem] max-w-6xl flex-col overflow-hidden dark:bg-transparent">
      <ChatAurora />
      {/* Dark theme (default): the mp4 loop fills the panel's full height — behind the header and
          composer too, not just a bottom strip — so it never gets capped short on tall viewports.
          A top mask fades it to transparent over its upper third instead of cutting it off hard,
          dissolving into the aurora/glass behind it for a soft, luxurious blend under the header.
          Light theme: the aurora waves instead. Starts only once `ready` (shell fully faded in). */}
      <video
        ref={videoRef}
        aria-hidden
        loop
        muted
        playsInline
        className={cn(
          "pointer-events-none absolute inset-0 hidden h-full w-full object-cover transition-opacity duration-700 ease-out",
          isDark && "dark:block",
          videoHidden ? "opacity-0" : "opacity-100",
        )}
        style={{
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 32%)",
          maskImage: "linear-gradient(to bottom, transparent 0%, black 32%)",
        }}
      >
        <source src={chatAnimation} type="video/mp4" />
      </video>
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 left-1/4 h-72 w-72 rounded-full bg-accent/10 blur-[100px] dark:hidden"
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

        <div className="relative flex items-center gap-1">
          {/* Typing reveal — runs in both themes, so always shown. */}
          <button
            type="button"
            onClick={() => setTypingAnimationDisabled(!typingHidden)}
            aria-label={typingHidden ? "Ativar animação de digitação" : "Desativar animação de digitação"}
            title={typingHidden ? "Ativar animação de digitação" : "Desativar animação de digitação"}
            className="inline-flex size-8 items-center justify-center rounded-full text-muted transition hover:bg-ink/6 hover:text-ink dark:hover:bg-white/8"
          >
            <svg viewBox="0 0 20 20" fill="none" className="size-4">
              <path
                d="M4 5h12a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 16 14H9.5L6 17v-3H4A1.5 1.5 0 0 1 2.5 12.5v-6A1.5 1.5 0 0 1 4 5Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <circle cx="6.7" cy="9.5" r="0.9" fill="currentColor" />
              <circle cx="10" cy="9.5" r="0.9" fill="currentColor" />
              <circle cx="13.3" cy="9.5" r="0.9" fill="currentColor" />
              {typingHidden && (
                <path d="M3 3l14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              )}
            </svg>
          </button>
          {/* Ambient video — dark theme only, so only shown there. */}
          {isDark && (
            <button
              type="button"
              onClick={() => setVideoAnimationDisabled(!videoHidden)}
              aria-label={videoHidden ? "Mostrar animação do chat" : "Ocultar animação do chat"}
              title={videoHidden ? "Mostrar animação" : "Ocultar animação"}
              className="inline-flex size-8 items-center justify-center rounded-full text-muted transition hover:bg-ink/6 hover:text-ink dark:hover:bg-white/8"
            >
              <svg viewBox="0 0 20 20" fill="none" className="size-4">
                <rect x="2.5" y="5.5" width="10" height="9" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M12.5 8.5 17 6v8l-4.5-2.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                {videoHidden && (
                  <path d="M3 3l14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                )}
              </svg>
            </button>
          )}
          <LifecycleMenu status={status} history={history} ledgerReference={ledgerReference} onRestart={onRestart} />
        </div>
      </header>

      <div className="relative flex-1 overflow-y-auto p-5">{children}</div>

      {footer && (
        <div className="relative border-t border-line bg-canvas/25 p-4 backdrop-blur-md dark:bg-canvas/35">{footer}</div>
      )}
    </div>
  );
}
