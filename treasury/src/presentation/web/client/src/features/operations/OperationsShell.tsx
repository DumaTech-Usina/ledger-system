import { useEffect, useRef, useState, type ReactNode } from "react";
import { LifecycleMenu } from "@/features/operations/LifecycleMenu";
import { ChatAurora } from "@/features/operations/ChatAurora";
import { statusLabels } from "@/features/operations/copy";
import { cn } from "@/utils/cn";
import chatAnimation from "@/assets/chat animation.mp4";
import type { AuditEntry, IntentStatus } from "@/types/operations";

const HIDE_ANIMATION_KEY = "treasury.hideChatAnimation";

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
  const [animationHidden, setAnimationHidden] = useState(() => localStorage.getItem(HIDE_ANIMATION_KEY) === "1");

  useEffect(() => {
    localStorage.setItem(HIDE_ANIMATION_KEY, animationHidden ? "1" : "0");
  }, [animationHidden]);

  // The video stays mounted and playing through the fade-out (so the motion behind it feels
  // alive) and only actually pauses once fully transparent. Revealing it always restarts
  // playback from the first frame, in step with the fade-in.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isDark || !ready) {
      video?.pause();
      return;
    }

    if (animationHidden) {
      const handleTransitionEnd = (e: TransitionEvent) => {
        if (e.propertyName === "opacity") video.pause();
      };
      video.addEventListener("transitionend", handleTransitionEnd);
      return () => video.removeEventListener("transitionend", handleTransitionEnd);
    }

    video.currentTime = 0;
    video.play().catch(() => {});
  }, [isDark, ready, animationHidden]);

  return (
    <div className="glass relative mx-auto flex h-[calc(100vh-11.5rem)] min-h-[32rem] max-w-6xl flex-col overflow-hidden dark:bg-transparent">
      <ChatAurora />
      {/* Dark theme: fades the transparent chat panel down to black well before the video's own
          top edge, so the (uncropped) video's already-dark top meets it as black-on-black instead
          of a visible seam. Static — stays put regardless of the hide/show toggle below. */}
      <div
        aria-hidden
        className={cn(
          // Twice the video's own height (16rem/20rem), with black held through exactly the first
          // half — so it's still solid black precisely where the video's top edge lands, then
          // fades out over the second half, above the video, into the transparent chat panel.
          "pointer-events-none absolute bottom-0 left-0 hidden h-[32rem] w-full md:h-[40rem]",
          "[background:linear-gradient(to_top,black_0%,black_50%,transparent_100%)]",
          isDark && "dark:block",
        )}
      />
      {/* Dark theme (default): the mp4 loop, full strength, anchored to the panel's own bottom edge —
          behind the composer too, not just the message list — so it stays put for the whole session,
          starting only once `ready` (the shell has fully faded in). Light theme: the aurora waves instead.
          Height matches the source's own 16:10 aspect closely enough at these widths that object-cover
          no longer has to crop into the frame the way a shorter box did. */}
      <video
        ref={videoRef}
        aria-hidden
        loop
        muted
        playsInline
        className={cn(
          "pointer-events-none absolute bottom-0 left-0 hidden h-64 w-full object-cover transition-opacity duration-700 ease-out md:h-80",
          isDark && "dark:block",
          animationHidden ? "opacity-0" : "opacity-100",
        )}
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
          {isDark && (
            <button
              type="button"
              onClick={() => setAnimationHidden((v) => !v)}
              aria-label={animationHidden ? "Mostrar animação do chat" : "Ocultar animação do chat"}
              title={animationHidden ? "Mostrar animação" : "Ocultar animação"}
              className="inline-flex size-8 items-center justify-center rounded-full text-muted transition hover:bg-ink/6 hover:text-ink dark:hover:bg-white/8"
            >
              <svg viewBox="0 0 20 20" fill="none" className="size-4">
                <rect x="2.5" y="5.5" width="10" height="9" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M12.5 8.5 17 6v8l-4.5-2.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                {animationHidden && (
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
