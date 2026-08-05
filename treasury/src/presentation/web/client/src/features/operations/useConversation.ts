import { useCallback, useEffect, useRef, useState } from "react";
import { operationsApi } from "@/features/operations/operationsApi";
import { positionCopy, scenarioCopy, translateMessage } from "@/features/operations/copy";
import { typingDurationMs } from "@/features/operations/typing";
import { useTypingAnimationDisabled } from "@/hooks/useAnimationsDisabled";
import { formatMoney } from "@/utils/format";
import {
  decideAdvance,
  decideClassification,
  decideSubmitOutcome,
  interpretationMessages,
  offerablePositions,
  pendingIdentity,
  positionAnswers,
  shouldFallbackToDirectAnswer,
  slotPrompt,
  withId,
  type IdentityOption,
  type Phase,
  type StreamItem,
} from "@/features/operations/conversationEngine";
import type {
  AuditEntry,
  DialogState,
  IdentityOutcome,
  IntentStatus,
  ScenarioSummary,
  SettlementCandidate,
  SlotDefinition,
} from "@/types/operations";

export function useConversation() {
  const typingHidden = useTypingAnimationDisabled();
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
    const delay = typingHidden ? 0 : next.kind === "bot" || next.kind === "error" ? typingDurationMs(next.text) : 150;
    revealTimerRef.current = setTimeout(() => {
      revealingRef.current = false;
      revealNext();
    }, delay);
  }, [typingHidden]);

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

  /**
   * Offers the one identity question a turn is worth asking, and reports whether it did. When it
   * did, the caller must NOT advance: the backend recorded nothing for that slot, so advancing
   * would re-push the very question this bubble replaces.
   */
  const offerIdentity = useCallback(
    (outcomes: IdentityOutcome[] | undefined): boolean => {
      const message = pendingIdentity(outcomes, answeredSlotsRef.current);
      if (!message) return false;
      push(withId(message));
      return true;
    },
    [push],
  );

  /** Surfaces what an /interpret call found (validation errors, low-confidence proposals), then —
   * unless the caller is about to fall back to a direct answer — advances via the returned state. */
  const applyInterpretation = useCallback(
    (result: Parameters<typeof interpretationMessages>[0], scenarioIdForPrompt: string, opts?: { skipAdvance?: boolean }) => {
      for (const message of interpretationMessages(result, scenarioIdForPrompt)) {
        push(withId(message));
      }
      if (opts?.skipAdvance || !result.state) return;
      if (offerIdentity(result.identity)) return;
      advance(result.state, undefined, scenarioIdForPrompt);
    },
    [push, advance, offerIdentity],
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
      // An unresolved counterparty was not recorded, so `state` asks this same slot again. Offering
      // the decision replaces that repetition — the slot stays open and the composer still works.
      if (!data.error && offerIdentity(data.identity ? [data.identity] : undefined)) return;
      advance(data.state, data.error);
    },
    [currentSlot, push, refreshLifecycle, advance, offerIdentity],
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
        if (!fallback.data.error && offerIdentity(fallback.data.identity ? [fallback.data.identity] : undefined)) {
          return;
        }
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
   * Settles an open counterparty question. Selecting an existing party is an ordinary answer
   * carrying its PartyId (the cascade resolves it by exact_id); creating one — or declaring the
   * counterparty unidentifiable — goes through the identity route, the only path that mints an id.
   */
  const decideIdentity = useCallback(
    async (item: { id: string; slot: string }, option: IdentityOption, justification?: string) => {
      const id = intentIdRef.current;
      if (!id) return;
      setStream((s) => s.filter((it) => it.id !== item.id));
      setBusy(true);

      if (option.kind === "select") {
        const { data } = await operationsApi.answer(id, item.slot, option.partyId);
        setBusy(false);
        if (!data?.state) {
          push(withId({ kind: "transport-error" }));
          return;
        }
        refreshLifecycle(id);
        advance(data.state, data.error);
        return;
      }

      const { ok, data } = await operationsApi.decideIdentity(id, {
        slot: item.slot,
        kind: option.kind,
        mention: option.mention,
        justification,
      });
      setBusy(false);
      // A refused decision (not admissible, missing justification) comes back 422 with a legible
      // reason. That is the user's to fix, not a transport failure.
      if (!ok) {
        const reason = data && "error" in data ? data.error : undefined;
        push(withId(reason ? { kind: "error", text: translateMessage(reason) } : { kind: "transport-error" }));
        return;
      }
      if (!data || !("state" in data)) {
        push(withId({ kind: "transport-error" }));
        return;
      }
      refreshLifecycle(id);
      advance(data.state, undefined);
    },
    [push, refreshLifecycle, advance],
  );

  /**
   * When the open question asks which position a settlement is about, offer the positions instead
   * of an id field. Runs off the open slot rather than off a reply, because the offer belongs to the
   * question — and it stays silent when there is nothing to offer, which is the ordinary case.
   */
  useEffect(() => {
    const id = intentIdRef.current;
    if (!id || !currentSlot || currentSlot.type !== "event_ref") return;

    let cancelled = false;
    operationsApi.settlementCandidates(id).then(({ ok, data }) => {
      if (cancelled || !ok) return;
      const offerable = offerablePositions(data.candidates, currentSlot);
      if (offerable.length === 0) return;
      push(withId({ kind: "positions", slots: data.slots, candidates: offerable }));
    });

    return () => {
      cancelled = true;
    };
  }, [currentSlot, push]);

  /**
   * Records the position the user pointed at. One selection, two assertions: which position this
   * fact moves and which fact caused it — merged in a single batch so they can never land apart.
   */
  const selectPosition = useCallback(
    async (item: { id: string; slots: { continuity?: string; lineage?: string } }, candidate: SettlementCandidate) => {
      const id = intentIdRef.current;
      if (!id) return;
      setStream((s) => s.filter((it) => it.id !== item.id));
      push(
        withId({
          kind: "user",
          text: positionCopy.picked(candidate.counterparty, formatMoney(candidate.totalOriginated, candidate.currency)),
        }),
      );

      setBusy(true);
      const { data } = await operationsApi.applyAnswers(id, positionAnswers(candidate, item.slots), "fill");
      setBusy(false);
      if (!data?.state) {
        push(withId({ kind: "transport-error" }));
        return;
      }
      refreshLifecycle(id);
      advance(data.state, data.rejected[0]);
    },
    [push, refreshLifecycle, advance],
  );

  /** Puts the offer away. Nothing is recorded: the question stays open and the composer answers it. */
  const dismissPositions = useCallback((itemId: string) => {
    setStream((s) => s.filter((it) => it.id !== itemId));
  }, []);

  /**
   * Records an answer to the confirmation card's optional question, or the refusal to give one.
   * Deliberately does NOT touch `busy` or the preview: nothing here can hold a submission back, and
   * making the confirm button wait on it would be exactly that.
   */
  const recordEnrichment = useCallback(async (partyId: string, key: string, value?: string) => {
    const id = intentIdRef.current;
    if (!id) return { ok: false as const };
    const { ok } = await operationsApi.enrich(id, { partyId, key, value });
    if (ok) refreshLifecycle(id);
    return { ok };
  }, [refreshLifecycle]);

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
    const decision = decideSubmitOutcome(data);
    // A correctable rejection leaves the conversation open — only a settled one ends it.
    if (decision.terminal) setPhase("done");
    push(withId(decision.message));
  }, [push, refreshLifecycle]);

  /**
   * Re-answers the slots a fixable rejection implicated, then shows the confirmation card again.
   *
   * Uses the batch merge with `edit` (the same deterministic validator every other path uses), so a
   * correction is one round-trip that reports every problem at once instead of stopping at the
   * first. It never resubmits by itself: the user confirms again, exactly as the first time.
   */
  const applyCorrection = useCallback(
    async (edits: Record<string, string>) => {
      const id = intentIdRef.current;
      if (!id) return { ok: false as const };
      setBusy(true);
      const answers = Object.entries(edits).map(([key, value]) => ({ key, value }));
      const { data } = await operationsApi.applyAnswers(id, answers, "edit");
      if (!data?.state) {
        setBusy(false);
        return { ok: false as const };
      }
      if (data.rejected.length > 0) {
        setBusy(false);
        const first = data.rejected[0];
        return { ok: false as const, error: { key: first.key, message: translateMessage(first.message) } };
      }
      setBusy(false);
      refreshLifecycle(id);
      if (offerIdentity(data.identity)) return { ok: true as const };
      // Back to confirm-before-commit: nothing is resent without the user seeing it again.
      await goPreview(id);
      return { ok: true as const };
    },
    [refreshLifecycle, offerIdentity, goPreview],
  );

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
    decideIdentity,
    selectPosition,
    dismissPositions,
    recordEnrichment,
    applyCorrection,
    confirmSubmit,
    restart,
    answeredSlots: answeredSlotsRef.current,
    saveEdits,
  };
}
