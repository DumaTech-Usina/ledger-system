import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/Card";
import { Banner } from "@/components/Banner";
import { OperationsIntro, type GreetingPhase } from "@/features/operations/OperationsIntro";
import { ScenarioGrid } from "@/features/operations/ScenarioGrid";
import { ChatStream } from "@/features/operations/ChatStream";
import { Composer } from "@/features/operations/Composer";
import { OperationsShell } from "@/features/operations/OperationsShell";
import { useConversation, type AdoptedIntent } from "@/features/operations/useConversation";
import { slotPrompt } from "@/features/operations/conversationEngine";
import { suggestScenarios } from "@/features/operations/scenarioSuggestions";
import { cn } from "@/utils/cn";
import type { User } from "@/types/auth";

export interface OperationsPageProps {
  user: User;
  showIntro: boolean;
  onIntroDone: () => void;
  /** A conversation opened from a position, to be adopted instead of started here. */
  adopt?: AdoptedIntent | null;
  /** Called once the adoption has been taken up, so it is never replayed. */
  onAdopted?: () => void;
}

// "big" and "hidden" share the same (enlarged, centered) transform — only opacity/blur differ
// between them, so hidden→big is a pure reveal. "docked" only changes the transform, so
// big→docked is a pure move — the question never fades, it just relocates, per the brief.
type QuestionPhase = "hidden" | "big" | "docked";

const SKIP_INTRO_KEY = "treasury.skipLoginIntro";

export function OperationsPage({ user, showIntro, onIntroDone, adopt, onAdopted }: OperationsPageProps) {
  const canCreate = user.permissions.includes("intent:create");

  // Read once, at mount — a preference set mid-animation shouldn't retroactively cancel a play
  // already in progress; it only takes effect the *next* time the intro would run.
  const [introDisabled, setIntroDisabled] = useState(() => localStorage.getItem(SKIP_INTRO_KEY) === "1");
  const effectiveShowIntro = showIntro && !introDisabled;

  const [greetingPhase, setGreetingPhase] = useState<GreetingPhase>(effectiveShowIntro ? "in" : "hidden");
  const [questionPhase, setQuestionPhase] = useState<QuestionPhase>(effectiveShowIntro ? "hidden" : "docked");
  const [shellVisible, setShellVisible] = useState(!effectiveShowIntro);
  // Flips once the fade-in transition actually finishes (not when it starts) — the ambient
  // chat video should only begin once the chat is fully, 100% on screen. Also gates whether the
  // chat underneath is clickable at all — nothing here should be selectable mid-animation.
  const [chatReady, setChatReady] = useState(!effectiveShowIntro);
  // True once the user (or a stored preference) cuts the animation short — from then on every
  // remaining transition is instant instead of animating to its final state.
  const [skipped, setSkipped] = useState(false);

  const introActive = effectiveShowIntro && !chatReady;

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
    pickingError,
    lifecycle,
    selectScenario,
    answer,
    sendUtterance,
    resolveSuggestion,
    decideIdentity,
    selectPosition,
    dismissPositions,
    recordEnrichment,
    applyCorrection,
    confirmSubmit,
    restart,
    answeredSlots,
    saveEdits,
  } = useConversation(adopt);

  // Hand-off is one-way: once the conversation has taken the intent, the app forgets it, so coming
  // back to this page later opens the ordinary picker rather than an operation already dealt with.
  useEffect(() => {
    if (adopt && onAdopted) onAdopted();
  }, [adopt, onAdopted]);

  const introTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!effectiveShowIntro) return;
    introTimersRef.current = [
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
    return () => introTimersRef.current.forEach(clearTimeout);
  }, [effectiveShowIntro]);

  /** Jumps straight to the fully-revealed chat — triggered by a click/tap/Enter anywhere on the
   * intro, or immediately when the "don't show again" preference is already on. */
  const skipIntro = useCallback(() => {
    introTimersRef.current.forEach(clearTimeout);
    setSkipped(true);
    setGreetingPhase("hidden");
    setQuestionPhase("docked");
    setShellVisible(true);
    setChatReady(true);
    onIntroDoneRef.current();
  }, []);

  // Viewers never see the shell the intro reveals — consume the flag so it doesn't linger unused.
  useEffect(() => {
    if (!canCreate && showIntro) onIntroDoneRef.current();
  }, [canCreate, showIntro]);

  // The preference was already on when this page mounted — there is no animation to play, but the
  // "just logged in" flag still needs consuming so a later remount doesn't try again from scratch.
  useEffect(() => {
    if (introDisabled && showIntro) onIntroDoneRef.current();
  }, [introDisabled, showIntro]);

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
          "[--q-scale:1.5] [--q-travel:17rem] transition-[opacity,filter,transform] ease-in-out md:[--q-travel:19rem]",
          skipped ? "duration-0" : "duration-1000",
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
          "transition-[opacity,filter] ease-out",
          skipped ? "duration-0" : "duration-1000",
          shellVisible ? "opacity-100 blur-none" : "opacity-0 blur-md",
          // Invisible/fading-in is not the same as interactive — nothing underneath can be
          // clicked, tapped, or tabbed to until the chat has fully arrived.
          !chatReady && "pointer-events-none",
        )}
        aria-hidden={!chatReady}
        onTransitionEnd={(e) => {
          if (e.propertyName === "opacity" && shellVisible && !chatReady) {
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
            phase === "picking" ? (
              <Composer
                key="picking"
                placeholder="Descreva o que você quer fazer…"
                onSend={sendUtterance}
                busy={busy}
                suggest={(query) => suggestScenarios(query, scenarios ?? [])}
                onPickSuggestion={selectScenario}
              />
            ) : // Choice slots (e.g. BRL/USD) answer inline in the chat instead — see ChatStream.
            phase === "conversation" && currentSlot && currentSlot.type !== "choice" ? (
              <Composer
                key={currentSlot.key}
                placeholder={slotPrompt(scenarioId ?? "", currentSlot)}
                required={currentSlot.required}
                onSend={sendUtterance}
                busy={busy}
              />
            ) : undefined
          }
        >
          {phase === "picking" ? (
            scenarios ? (
              <>
                {pickingError && (
                  <Banner variant="bad" className="mx-auto mb-3 max-w-2xl">
                    {pickingError}
                  </Banner>
                )}
                <ScenarioGrid scenarios={scenarios} onSelect={selectScenario} />
              </>
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
              currentSlot={currentSlot}
              onAnswer={answer}
              answeredSlots={answeredSlots}
              onSaveEdits={saveEdits}
              onResolveSuggestion={resolveSuggestion}
              onDecideIdentity={decideIdentity}
              onRecordEnrichment={recordEnrichment}
              onApplyCorrection={applyCorrection}
              onSelectPosition={selectPosition}
              onDismissPositions={dismissPositions}
            />
          )}
        </OperationsShell>
      </div>

      {introActive && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Pular animação de boas-vindas"
          onClick={skipIntro}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              skipIntro();
            }
          }}
          className="fixed inset-0 z-30 cursor-pointer outline-none"
        />
      )}

      {/* Only once the intro is actually done — not during it, and not so early it competes with
          the header's own dropdowns (LanguageSwitcher/UserMenu are z-40; this stays well under
          that so they always paint on top when they overlap). `absolute` within this page's own
          (relative) root, not `fixed` to the viewport, which used to land it under the sidebar. */}
      {chatReady && (
        <label className="absolute top-3 right-0 z-10 flex cursor-pointer select-none items-center gap-1.5 rounded-full border border-line bg-panel-solid/90 px-3 py-1.5 text-[13px] text-muted shadow-sm backdrop-blur-md">
          <input
            type="checkbox"
            checked={introDisabled}
            onChange={(event) => {
              const next = event.target.checked;
              setIntroDisabled(next);
              localStorage.setItem(SKIP_INTRO_KEY, next ? "1" : "0");
            }}
            className="size-3.5 accent-accent"
          />
          Desativar introdução
        </label>
      )}
    </div>
  );
}
