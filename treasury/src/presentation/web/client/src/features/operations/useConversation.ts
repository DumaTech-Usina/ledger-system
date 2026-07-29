import { useCallback, useEffect, useRef, useState } from "react";
import { operationsApi } from "@/features/operations/operationsApi";
import { scenarioCopy, translateMessage } from "@/features/operations/copy";
import { typingDurationMs } from "@/features/operations/typing";
import {
  decideAdvance,
  decideClassification,
  interpretationMessages,
  shouldFallbackToDirectAnswer,
  slotPrompt,
  withId,
  type Phase,
  type StreamItem,
} from "@/features/operations/conversationEngine";
import type { AuditEntry, DialogState, IntentStatus, ScenarioSummary, SlotDefinition } from "@/types/operations";

export function useConversation() {
  const [scenarios, setScenarios] = useState<ScenarioSummary[] | null>(null);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [scenarioTitle, setScenarioTitle] = useState<string>("");
  const [intentId, setIntentId] = useState<string | null>(null);
  const [stream, setStream] = useState<StreamItem[]>([]);
  const [currentSlot, setCurrentSlot] = useState<SlotDefinition | null>(null);
  const [phase, setPhase] = useState<Phase>("picking");
  const [busy, setBusy] = useState(false);
  // Picking-phase-only feedback (no scenario/intent exists yet, so there is no chat stream to show
  // it in). Deliberately NOT pushed into `stream` — that history is what the conversation opens
  // with once a scenario is resolved, and a failed guess from the picking screen has no business
  // showing up there.
  const [pickingError, setPickingError] = useState<string | null>(null);
  const [lifecycle, setLifecycle] = useState<{
    status: IntentStatus;
    history: AuditEntry[];
    ledgerReference?: string;
  } | null>(null);

  const intentIdRef = useRef<string | null>(null);
  intentIdRef.current = intentId;

  // Every slot the guided dialog has ever asked, keyed by slot key — captured as it's asked so
  // "Editar" can later rebuild a proper input (type, choices, prompt) for each answered field
  // without a dedicated endpoint: the answer route already accepts any known slot key.
  const answeredSlotsRef = useRef<Record<string, SlotDefinition>>({});
  const recordSlot = (slot: SlotDefinition, label: string) => {
    answeredSlotsRef.current = { ...answeredSlotsRef.current, [slot.key]: { ...slot, prompt: label } };
  };

  useEffect(() => {
    operationsApi.scenarios().then(({ ok, data }) => {
      if (ok) setScenarios(data.scenarios);
    });
  }, []);

  // Items reveal one at a time — never two at once — so replies read as a fluid conversation
  // instead of dumping several bubbles on screen in the same instant.
  const queueRef = useRef<StreamItem[]>([]);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealingRef = useRef(false);

  const revealNext = useCallback(() => {
    if (revealingRef.current) return;
    const next = queueRef.current.shift();
    if (!next) return;
    revealingRef.current = true;
    setStream((s) => [...s, next]);
    const delay = next.kind === "bot" || next.kind === "error" ? typingDurationMs(next.text) : 150;
    revealTimerRef.current = setTimeout(() => {
      revealingRef.current = false;
      revealNext();
    }, delay);
  }, []);

  useEffect(
    () => () => {
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    },
    [],
  );

  const clearQueue = useCallback(() => {
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    queueRef.current = [];
    revealingRef.current = false;
  }, []);

  const push = useCallback(
    (item: StreamItem) => {
      queueRef.current.push(item);
      revealNext();
    },
    [revealNext],
  );

  const refreshLifecycle = useCallback(async (id: string) => {
    const { ok, data } = await operationsApi.getIntent(id);
    if (ok) {
      setLifecycle({ status: data.intent.status, history: data.history, ledgerReference: data.intent.ledgerReference });
    }
  }, []);

  const goPreview = useCallback(async (id: string) => {
    setPhase("confirming");
    const { ok, data } = await operationsApi.preview(id);
    if (ok) push(withId({ kind: "confirm", preview: data }));
  }, [push]);

  /** Applies a `decideAdvance` outcome — the shared ready/question branching for any single-answer
   * result (a direct answer, a suggestion accepted, or a bound interpretation once its
   * `interpretationMessages` are already queued). All the actual deciding happens in the engine;
   * this just carries out what it decided (push a message, move to preview, or open the next slot). */
  const advance = useCallback(
    (state: DialogState, error: Parameters<typeof decideAdvance>[1], scenarioIdForPrompt?: string) => {
      const sid = scenarioIdForPrompt ?? scenarioId ?? "";
      const decision = decideAdvance(state, error, sid);
      if (decision.kind === "error") {
        push(withId(decision.message));
        return;
      }
      if (decision.kind === "ready") {
        setCurrentSlot(null);
        const id = intentIdRef.current;
        if (id) goPreview(id);
        return;
      }
      setCurrentSlot(decision.slot);
      recordSlot(decision.slot, slotPrompt(sid, decision.slot));
      push(withId(decision.message));
    },
    [push, goPreview, scenarioId],
  );

  /** Surfaces what an /interpret call found (validation errors, low-confidence proposals), then —
   * unless the caller is about to fall back to a direct answer — advances via the returned state. */
  const applyInterpretation = useCallback(
    (result: Parameters<typeof interpretationMessages>[0], scenarioIdForPrompt: string, opts?: { skipAdvance?: boolean }) => {
      for (const message of interpretationMessages(result, scenarioIdForPrompt)) {
        push(withId(message));
      }
      if (opts?.skipAdvance || !result.state) return;
      advance(result.state, undefined, scenarioIdForPrompt);
    },
    [push, advance],
  );

  const selectScenario = useCallback(
    async (scenario: ScenarioSummary) => {
      const copy = scenarioCopy[scenario.id];
      setScenarioId(scenario.id);
      setScenarioTitle(copy?.title ?? scenario.title);
      setPickingError(null);
      clearQueue();
      setStream([]);
      setLifecycle(null);
      setPhase("conversation");
      setBusy(true);
      const { ok, data } = await operationsApi.start(scenario.id);
      setBusy(false);
      if (!ok) {
        push(withId({ kind: "transport-error" }));
        return;
      }
      setIntentId(data.intentId);
      answeredSlotsRef.current = {};
      push(withId({ kind: "bot", text: `Vamos lá! ${copy?.description ?? scenario.description}` }));
      refreshLifecycle(data.intentId);
      advance(data.state, undefined, scenario.id);
    },
    [clearQueue, push, refreshLifecycle, advance],
  );

  const answer = useCallback(
    async (value: string) => {
      const id = intentIdRef.current;
      const slot = currentSlot;
      if (!id || !slot) return;
      push(withId({ kind: "user", text: value === "" ? "(pulado)" : value }));
      setBusy(true);
      // The route replies 422 (not 2xx) for a rejected answer, but still with a well-formed
      // body — that's a normal validation outcome, not a transport failure, so `data.state`
      // (not `ok`) is what tells the two apart here.
      const { data } = await operationsApi.answer(id, slot.key, value);
      setBusy(false);
      if (!data?.state) {
        push(withId({ kind: "transport-error" }));
        return;
      }
      refreshLifecycle(id);
      advance(data.state, data.error);
    },
    [currentSlot, push, refreshLifecycle, advance],
  );

  /**
   * The chat's free-text entry point: interprets what the user typed instead of treating it as a
   * literal answer to whichever slot happens to be open. Picking phase classifies a scenario (or
   * asks to clarify); conversation phase extracts values for whatever slots aren't filled yet. When
   * extraction genuinely finds nothing usable (a free-text/party field, a non-ISO date, plain
   * gibberish) it falls back to the old guided behaviour — the raw text answers the open question
   * directly — so nothing regresses for slot types the stub extractor can't parse.
   */
  const sendUtterance = useCallback(
    async (text: string) => {
      const id = intentIdRef.current;

      if (!id) {
        setPickingError(null);
        setBusy(true);
        const { data } = await operationsApi.interpretNew(text);
        setBusy(false);
        if (!data) {
          setPickingError("Não foi possível falar com o Ledger agora. Tente novamente.");
          return;
        }

        const decision = decideClassification(data);
        if (decision.kind === "error") {
          setPickingError(decision.message);
          return;
        }

        setScenarioId(decision.scenarioId);
        setScenarioTitle(decision.scenarioTitle);
        setIntentId(decision.intentId);
        answeredSlotsRef.current = {};
        setPhase("conversation");
        push(withId({ kind: "user", text }));
        push(withId(decision.greeting));
        refreshLifecycle(decision.intentId);
        applyInterpretation(data, decision.scenarioId);
        return;
      }

      push(withId({ kind: "user", text }));
      const askedSlotKey = currentSlot?.key ?? null;
      setBusy(true);
      const { data } = await operationsApi.interpretBound(id, text);
      setBusy(false);
      if (!data) {
        push(withId({ kind: "transport-error" }));
        return;
      }
      refreshLifecycle(id);

      if (askedSlotKey && shouldFallbackToDirectAnswer(askedSlotKey, data)) {
        // Nothing usable was extracted from this message at all — treat it as the direct answer
        // to the question on screen (matches the guided flow's old, still-supported behaviour).
        applyInterpretation(data, scenarioId ?? "", { skipAdvance: true });
        setBusy(true);
        const fallback = await operationsApi.answer(id, askedSlotKey, text);
        setBusy(false);
        if (!fallback.data?.state) {
          push(withId({ kind: "transport-error" }));
          return;
        }
        refreshLifecycle(id);
        advance(fallback.data.state, fallback.data.error);
        return;
      }

      applyInterpretation(data, scenarioId ?? "");
    },
    [currentSlot, scenarioId, push, refreshLifecycle, applyInterpretation, advance],
  );

  /** Sim/Não on a low-confidence suggestion bubble — Sim applies it via the same edit path as
   * saveEdits below; Não just dismisses the bubble, proposing nothing further. */
  const resolveSuggestion = useCallback(
    async (item: { id: string; proposalKey: string; value: string }, accept: boolean) => {
      setStream((s) => s.filter((it) => it.id !== item.id));
      if (!accept) return;
      const id = intentIdRef.current;
      if (!id) return;
      setBusy(true);
      const { data } = await operationsApi.answer(id, item.proposalKey, item.value);
      setBusy(false);
      if (!data?.state) {
        push(withId({ kind: "transport-error" }));
        return;
      }
      refreshLifecycle(id);
      advance(data.state, data.error);
    },
    [push, refreshLifecycle, advance],
  );

  /**
   * Applies edits to already-answered slots (any key the scenario knows, not just the "next"
   * one — the same `/answer` route the guided dialog uses already allows this) and refreshes the
   * confirm card in place, without restarting the conversation or re-asking anything.
   */
  const saveEdits = useCallback(
    async (edits: Record<string, string>) => {
      const id = intentIdRef.current;
      if (!id) return { ok: false as const };
      setBusy(true);
      for (const [key, value] of Object.entries(edits)) {
        const { data } = await operationsApi.answer(id, key, value);
        if (!data?.state) {
          setBusy(false);
          return { ok: false as const };
        }
        if (data.error) {
          setBusy(false);
          return { ok: false as const, error: { key, message: translateMessage(data.error.message) } };
        }
      }
      const { ok, data: preview } = await operationsApi.preview(id);
      setBusy(false);
      if (!ok) return { ok: false as const };
      refreshLifecycle(id);
      setStream((s) => {
        const lastConfirmIdx = s.map((it) => it.kind).lastIndexOf("confirm");
        if (lastConfirmIdx === -1) return s;
        const next = [...s];
        next[lastConfirmIdx] = { ...next[lastConfirmIdx], preview } as StreamItem;
        return next;
      });
      return { ok: true as const };
    },
    [refreshLifecycle],
  );

  const confirmSubmit = useCallback(async () => {
    const id = intentIdRef.current;
    if (!id) return;
    setBusy(true);
    const { ok, data } = await operationsApi.submit(id);
    setBusy(false);
    refreshLifecycle(id);
    if (!ok || !data.status) {
      push(withId({ kind: "transport-error" }));
      return;
    }
    setPhase("done");
    push(withId({ kind: "result", status: data.status, ledgerReference: data.ledgerReference, reason: data.reason }));
  }, [push, refreshLifecycle]);

  const restart = useCallback(() => {
    clearQueue();
    setScenarioId(null);
    setScenarioTitle("");
    setIntentId(null);
    answeredSlotsRef.current = {};
    setStream([]);
    setCurrentSlot(null);
    setLifecycle(null);
    setPickingError(null);
    setPhase("picking");
  }, [clearQueue]);

  return {
    scenarios,
    scenarioId,
    scenarioTitle,
    intentId,
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
    confirmSubmit,
    restart,
    answeredSlots: answeredSlotsRef.current,
    saveEdits,
  };
}
