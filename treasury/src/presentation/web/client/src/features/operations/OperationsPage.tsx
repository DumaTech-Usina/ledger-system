import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/Card";
import { OperationsIntro, type GreetingPhase } from "@/features/operations/OperationsIntro";
import { ScenarioGrid } from "@/features/operations/ScenarioGrid";
import { ChatStream } from "@/features/operations/ChatStream";
import { Composer } from "@/features/operations/Composer";
import { OperationsShell } from "@/features/operations/OperationsShell";
import { useConversation } from "@/features/operations/useConversation";
import { cn } from "@/utils/cn";
import type { User } from "@/types/auth";

export interface OperationsPageProps {
  user: User;
  showIntro: boolean;
  onIntroDone: () => void;
}

// "big" and "hidden" share the same (enlarged, centered) transform — only opacity/blur differ
// between them, so hidden→big is a pure reveal. "docked" only changes the transform, so
// big→docked is a pure move — the question never fades, it just relocates, per the brief.
type QuestionPhase = "hidden" | "big" | "docked";

export function OperationsPage({ user, showIntro, onIntroDone }: OperationsPageProps) {
  const canCreate = user.permissions.includes("intent:create");

  const [greetingPhase, setGreetingPhase] = useState<GreetingPhase>(showIntro ? "in" : "hidden");
  const [questionPhase, setQuestionPhase] = useState<QuestionPhase>(showIntro ? "hidden" : "docked");
  const [shellVisible, setShellVisible] = useState(!showIntro);
  // Flips once the fade-in transition actually finishes (not when it starts) — the ambient
  // chat video should only begin once the chat is fully, 100% on screen.
  const [chatReady, setChatReady] = useState(!showIntro);

  // A ref, not a dependency — an unstable `onIntroDone` identity must never restart these timers.
  const onIntroDoneRef = useRef(onIntroDone);
  onIntroDoneRef.current = onIntroDone;

  const {
    scenarios,
    scenarioId,
    scenarioTitle,
    stream,
    currentSlot,
    phase,
    busy,
    lifecycle,
    selectScenario,
    answer,
    confirmSubmit,
    restart,
  } = useConversation();

  useEffect(() => {
    if (!showIntro) return;
    const timers = [
      setTimeout(() => setGreetingPhase("out"), 1400),
      setTimeout(() => {
        setGreetingPhase("hidden");
        setQuestionPhase("big");
      }, 1900),
      // The chat's fade-in starts the instant the heading begins docking, not after — both run
      // together (1s each) and land at the same time.
      setTimeout(() => {
        setQuestionPhase("docked");
        setShellVisible(true);
      }, 3300),
    ];
    return () => timers.forEach(clearTimeout);
  }, [showIntro]);

  // Viewers never see the shell the intro reveals — consume the flag so it doesn't linger unused.
  useEffect(() => {
    if (!canCreate && showIntro) onIntroDoneRef.current();
  }, [canCreate, showIntro]);

  if (!canCreate) {
    return (
      <Card>
        <p className="text-sm text-muted">Seu perfil tem acesso somente leitura. Operações não estão disponíveis.</p>
      </Card>
    );
  }

  const firstName = user.displayName.trim().split(/\s+/)[0];
  const title = scenarioId ? scenarioTitle : "Escolha uma operação";

  return (
    <div className="relative overflow-x-hidden">
      <OperationsIntro firstName={firstName} phase={greetingPhase} />

      <h1
        className={cn(
          "mb-4 text-center font-display text-xl font-semibold text-ink md:text-2xl",
          "[--q-scale:1.5] [--q-travel:17rem] transition-[opacity,filter,transform] duration-1000 ease-in-out md:[--q-travel:19rem]",
          questionPhase === "hidden" && "opacity-0 blur-md",
          questionPhase === "big" && "opacity-100 blur-none",
          questionPhase === "docked" && "opacity-100 blur-none",
        )}
        style={{
          transform:
            questionPhase === "docked" ? "translateY(0) scale(1)" : "translateY(var(--q-travel)) scale(var(--q-scale))",
        }}
      >
        O que você gostaria de fazer?
      </h1>

      <div
        className={cn(
          "transition-[opacity,filter] duration-1000 ease-out",
          shellVisible ? "opacity-100 blur-none" : "opacity-0 blur-md",
        )}
        onTransitionEnd={(e) => {
          if (e.propertyName === "opacity" && shellVisible) {
            onIntroDoneRef.current();
            setChatReady(true);
          }
        }}
      >
        <OperationsShell
          title={title}
          status={lifecycle?.status ?? null}
          history={lifecycle?.history ?? []}
          ledgerReference={lifecycle?.ledgerReference}
          onRestart={restart}
          ready={chatReady}
          footer={
            phase === "conversation" && currentSlot ? (
              <Composer key={currentSlot.key} slot={currentSlot} onAnswer={answer} busy={busy} />
            ) : undefined
          }
        >
          {phase === "picking" ? (
            scenarios ? (
              <ScenarioGrid scenarios={scenarios} onSelect={selectScenario} />
            ) : (
              <div className="grid h-full place-items-center text-sm text-muted">Carregando operações…</div>
            )
          ) : (
            <ChatStream
              stream={stream}
              scenarioTitle={scenarioTitle}
              onConfirm={confirmSubmit}
              onCancel={restart}
              busy={busy}
            />
          )}
        </OperationsShell>
      </div>
    </div>
  );
}
