import { useCallback, useEffect, useRef, useState } from "react";
import { operationsApi } from "@/features/operations/operationsApi";
import { scenarioCopy, scenarioSlotPrompts, translateMessage } from "@/features/operations/copy";
import { typingDurationMs } from "@/features/operations/typing";
import type {
  AuditEntry,
  DialogState,
  InterpretResult,
  IntentStatus,
  PreviewIntentResult,
  ScenarioSummary,
  SlotDefinition,
  SlotValidationError,
  SubmissionStatus,
} from "@/types/operations";

export type StreamItem =
  | { id: string; kind: "bot"; text: string }
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "error"; text: string }
  | { id: string; kind: "suggestion"; proposalKey: string; value: string; label: string }
  | { id: string; kind: "confirm"; preview: PreviewIntentResult }
  | { id: string; kind: "result"; status: SubmissionStatus; ledgerReference?: string; reason?: string }
  | { id: string; kind: "transport-error" };

export type Phase = "picking" | "conversation" | "confirming" | "done";

const uid = () => crypto.randomUUID();

export const slotPrompt = (scenarioId: string, slot: SlotDefinition): string =>
  scenarioSlotPrompts[scenarioId]?.[slot.key] ?? slot.prompt;

const labelFor = (scenarioId: string, key: string): string => scenarioSlotPrompts[scenarioId]?.[key] ?? key;

export function useConversation() {
  const [scenarios, setScenarios] = useState<ScenarioSummary[] | null>(null);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [scenarioTitle, setScenarioTitle] = useState<string>("");
  const [intentId, setIntentId] = useState<string | null>(null);
  const [stream, setStream] = useState<StreamItem[]>([]);
  const [currentSlot, setCurrentSlot] = useState<SlotDefinition | null>(null);
  const [phase, setPhase] = useState<Phase>("picking");
  const [busy, setBusy] = useState(false);
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
    if (ok) push({ id: uid(), kind: "confirm", preview: data });
  }, [push]);

  /** Shared ready/question branching for any single-state outcome (a direct answer, a suggestion
   * accepted, or a bound interpretation once its rejected/lowConfidence bubbles are already queued). */
  const advance = useCallback(
    (state: DialogState, error: SlotValidationError | undefined, scenarioIdForPrompt?: string) => {
      if (error) {
        push({ id: uid(), kind: "error", text: translateMessage(error.message) });
        return; // stays on the same slot — state below is unchanged (still a question).
      }
      if (state.kind === "ready") {
        setCurrentSlot(null);
        const id = intentIdRef.current;
        if (id) goPreview(id);
        return;
      }
      const sid = scenarioIdForPrompt ?? scenarioId ?? "";
      setCurrentSlot(state.slot);
      recordSlot(state.slot, slotPrompt(sid, state.slot));
      push({ id: uid(), kind: "bot", text: slotPrompt(sid, state.slot) });
    },
    [push, goPreview, scenarioId],
  );

  /** Surfaces what an /interpret call found (validation errors, low-confidence proposals), then —
   * unless the caller is about to fall back to a direct answer — advances via the returned state. */
  const applyInterpretation = useCallback(
    (result: InterpretResult, scenarioIdForPrompt: string, opts?: { skipAdvance?: boolean }) => {
      for (const err of result.rejected) {
        push({ id: uid(), kind: "error", text: translateMessage(err.message) });
      }
      for (const proposal of result.lowConfidence) {
        push({
          id: uid(),
          kind: "suggestion",
          proposalKey: proposal.key,
          value: proposal.value,
          label: labelFor(scenarioIdForPrompt, proposal.key),
        });
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
      clearQueue();
      setStream([]);
      setLifecycle(null);
      setPhase("conversation");
      setBusy(true);
      const { ok, data } = await operationsApi.start(scenario.id);
      setBusy(false);
      if (!ok) {
        push({ id: uid(), kind: "transport-error" });
        return;
      }
      setIntentId(data.intentId);
      answeredSlotsRef.current = {};
      push({ id: uid(), kind: "bot", text: `Vamos lá! ${copy?.description ?? scenario.description}` });
      refreshLifecycle(data.intentId);
      if (data.state.kind === "ready") {
        goPreview(data.intentId);
      } else {
        setCurrentSlot(data.state.slot);
        recordSlot(data.state.slot, slotPrompt(scenario.id, data.state.slot));
        push({ id: uid(), kind: "bot", text: slotPrompt(scenario.id, data.state.slot) });
      }
    },
    [clearQueue, goPreview, push, refreshLifecycle],
  );

  const answer = useCallback(
    async (value: string) => {
      const id = intentIdRef.current;
      const slot = currentSlot;
      if (!id || !slot) return;
      push({ id: uid(), kind: "user", text: value === "" ? "(pulado)" : value });
      setBusy(true);
      // The route replies 422 (not 2xx) for a rejected answer, but still with a well-formed
      // body — that's a normal validation outcome, not a transport failure, so `data.state`
      // (not `ok`) is what tells the two apart here.
      const { data } = await operationsApi.answer(id, slot.key, value);
      setBusy(false);
      if (!data?.state) {
        push({ id: uid(), kind: "transport-error" });
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
      push({ id: uid(), kind: "user", text });

      const id = intentIdRef.current;

      if (!id) {
        setBusy(true);
        const { data } = await operationsApi.interpretNew(text);
        setBusy(false);
        if (!data) {
          push({ id: uid(), kind: "transport-error" });
          return;
        }
        if (!data.intentId || !data.scenarioId) {
          push({
            id: uid(),
            kind: "bot",
            text: data.clarification ?? "Não entendi qual operação você quer — escolha uma das opções abaixo.",
          });
          return;
        }

        const copy = scenarioCopy[data.scenarioId];
        setScenarioId(data.scenarioId);
        setScenarioTitle(copy?.title ?? data.scenarioId);
        setIntentId(data.intentId);
        answeredSlotsRef.current = {};
        setPhase("conversation");
        push({ id: uid(), kind: "bot", text: `Vamos lá! ${copy?.description ?? ""}`.trim() });
        refreshLifecycle(data.intentId);
        applyInterpretation(data, data.scenarioId);
        return;
      }

      const askedSlotKey = currentSlot?.key ?? null;
      setBusy(true);
      const { data } = await operationsApi.interpretBound(id, text);
      setBusy(false);
      if (!data) {
        push({ id: uid(), kind: "transport-error" });
        return;
      }
      refreshLifecycle(id);

      const stillQuestion = data.state?.kind === "question";
      const extractedNothing = data.accepted.length === 0;

      if (askedSlotKey && stillQuestion && extractedNothing) {
        // Nothing usable was extracted from this message at all — treat it as the direct answer
        // to the question on screen (matches the guided flow's old, still-supported behaviour).
        applyInterpretation(data, scenarioId ?? "", { skipAdvance: true });
        setBusy(true);
        const fallback = await operationsApi.answer(id, askedSlotKey, text);
        setBusy(false);
        if (!fallback.data?.state) {
          push({ id: uid(), kind: "transport-error" });
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
        push({ id: uid(), kind: "transport-error" });
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
      push({ id: uid(), kind: "transport-error" });
      return;
    }
    setPhase("done");
    push({ id: uid(), kind: "result", status: data.status, ledgerReference: data.ledgerReference, reason: data.reason });
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
