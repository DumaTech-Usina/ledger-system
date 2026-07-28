import { useCallback, useEffect, useRef, useState } from "react";
import { operationsApi } from "@/features/operations/operationsApi";
import { scenarioCopy, scenarioSlotPrompts, translateMessage } from "@/features/operations/copy";
import { typingDurationMs } from "@/features/operations/typing";
import type {
  AuditEntry,
  IntentStatus,
  PreviewIntentResult,
  ScenarioSummary,
  SlotDefinition,
  SubmissionStatus,
} from "@/types/operations";

export type StreamItem =
  | { id: string; kind: "bot"; text: string }
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "error"; text: string }
  | { id: string; kind: "confirm"; preview: PreviewIntentResult }
  | { id: string; kind: "result"; status: SubmissionStatus; ledgerReference?: string; reason?: string }
  | { id: string; kind: "transport-error" };

export type Phase = "picking" | "conversation" | "confirming" | "done";

const uid = () => crypto.randomUUID();

const slotPrompt = (scenarioId: string, slot: SlotDefinition): string =>
  scenarioSlotPrompts[scenarioId]?.[slot.key] ?? slot.prompt;

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
      if (data.error) {
        push({ id: uid(), kind: "error", text: translateMessage(data.error.message) });
        return; // stays on the same slot — state below is unchanged (still a question).
      }
      if (data.state.kind === "ready") {
        setCurrentSlot(null);
        goPreview(id);
      } else {
        setCurrentSlot(data.state.slot);
        recordSlot(data.state.slot, slotPrompt(scenarioId ?? "", data.state.slot));
        push({ id: uid(), kind: "bot", text: slotPrompt(scenarioId ?? "", data.state.slot) });
      }
    },
    [currentSlot, goPreview, push, refreshLifecycle, scenarioId],
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
    confirmSubmit,
    restart,
    answeredSlots: answeredSlotsRef.current,
    saveEdits,
  };
}
