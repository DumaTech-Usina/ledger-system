import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { Bot, MessageSquareMore, MessageSquareOff, Paperclip, Video, VideoOff } from "lucide-react";
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
  /**
   * Present only while a file dropped anywhere on the shell can actually be handled (an active
   * conversation, not mid-request) — hands the dropped file over exactly like the composer's attach
   * button does. Absent disables the drop zone entirely, so this component stays reusable for any
   * phase that has nothing to do with files.
   */
  onDropFile?: (file: File) => void;
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
  onDropFile,
}: OperationsShellProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isDark = useIsDarkMode();
  const videoHidden = useVideoAnimationDisabled();
  const typingHidden = useTypingAnimationDisabled();

  // A drag that enters a child element fires `dragleave` on the parent before `dragenter` on the
  // child — a plain boolean would flicker the overlay off between them. Counting nesting depth
  // instead means only the drag that leaves the LAST element still inside the shell turns it off.
  const [dragActive, setDragActive] = useState(false);
  const dragDepth = useRef(0);

  const isFileDrag = (e: DragEvent): boolean => Array.from(e.dataTransfer.types).includes("Files");

  const handleDragEnter = (e: DragEvent) => {
    if (!onDropFile || !isFileDrag(e)) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragActive(true);
  };
  const handleDragOver = (e: DragEvent) => {
    // A drop is only permitted on an element whose dragover handler calls preventDefault — without
    // this the browser rejects the drop and opens the file instead (its default for a bare page).
    if (!onDropFile || !isFileDrag(e)) return;
    e.preventDefault();
  };
  const handleDragLeave = (e: DragEvent) => {
    if (!onDropFile || !isFileDrag(e)) return;
    e.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragActive(false);
  };
  const handleDrop = (e: DragEvent) => {
    if (!onDropFile || !isFileDrag(e)) return;
    e.preventDefault();
    dragDepth.current = 0;
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) onDropFile(file);
  };

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
    <div
      className="glass relative mx-auto flex h-[calc(100vh-11.5rem)] min-h-[32rem] max-w-6xl flex-col overflow-hidden dark:bg-transparent"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {onDropFile && dragActive && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-30 grid place-items-center rounded-3xl border-2 border-dashed border-accent bg-accent-soft/90 backdrop-blur-sm"
        >
          <div className="flex flex-col items-center gap-2 text-center text-accent">
            <Paperclip className="size-8" strokeWidth={1.5} />
            <p className="text-sm font-semibold">Solte o documento aqui</p>
            <p className="text-xs opacity-80">Vou extrair os dados automaticamente</p>
          </div>
        </div>
      )}
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
            <Bot className="size-[18px] text-accent-ink" strokeWidth={1.4} />
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
            {typingHidden ? (
              <MessageSquareOff className="size-4" strokeWidth={1.5} />
            ) : (
              <MessageSquareMore className="size-4" strokeWidth={1.5} />
            )}
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
              {videoHidden ? (
                <VideoOff className="size-4" strokeWidth={1.5} />
              ) : (
                <Video className="size-4" strokeWidth={1.5} />
              )}
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
