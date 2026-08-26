import { useCallback, useEffect, useRef, useState } from "react";
import { operationsApi } from "@/features/operations/operationsApi";
import { identityCopy, positionCopy, scenarioCopy, translateMessage } from "@/features/operations/copy";
import { typingDurationMs } from "@/features/operations/typing";
import { useTypingAnimationDisabled } from "@/hooks/useAnimationsDisabled";
import { useLanguage, type Translations } from "@/i18n/i18n";
import { formatDateForLanguage, formatMoney, formatMoneyForLanguage, parseLooseAmount } from "@/utils/format";
import {
  decideAdvance,
  decideClassification,
  decideSubmitOutcome,
  identityWasRecorded,
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

/**
 * What the user's own bubble shows for a slot answer — formatted for the app's chosen language when
 * the raw value is cleanly what the slot claims (a plain ISO date, a plain amount), and left exactly
 * as typed otherwise. A value the extractor still had to interpret (free text, "ontem", a phrase) is
 * not reformatted — this only dresses up the values our own controls already hand back clean.
 *
 * A CHOICE answer is the one case where the stored value is not language at all: the backend keeps
 * the branch key ("waiver", "reversal"), and the chip the operator clicked already showed the
 * catalog's wording. The bubble echoes that same wording, so the transcript never answers a
 * Portuguese question with an English key. A key with no entry falls back to itself.
 */
function formatAnswerBubbleText(
  value: string,
  slot: SlotDefinition | null | undefined,
  language: string,
  t: Translations,
): string {
  if (!slot) return value;
  if (slot.type === "choice") {
    return t.slotChoice[value] ?? value;
  }
  if (slot.type === "date" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return formatDateForLanguage(value, language);
  }
  if (slot.type === "money") {
    const amount = parseLooseAmount(value);
    if (amount !== null) return formatMoneyForLanguage(amount, "BRL", language);
  }
  return value;
}

/**
 * A conversation the operator opened from a position rather than from the action list. The intent
 * already exists — the position answered what it could — so the chat adopts it instead of starting
 * one, and picks up at the first question still unanswered.
 */
export interface AdoptedIntent {
  intentId: string;
  scenarioId: string;
  state: DialogState;
  /** How to name the position on screen, so the operator never loses sight of what this is about. */
  positionLabel: string;
}

export function useConversation(adopt?: AdoptedIntent | null) {
  const typingHidden = useTypingAnimationDisabled();
  const { language, t } = useLanguage();
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

  /**
   * Adopts a conversation opened from a position. Same machine as `selectScenario` — the difference
   * is only that the intent and its first state already exist, because the position supplied every
   * answer it could before the operator was asked anything.
   *
   * Runs once per adoption — `adopt` is the identity, and it only changes when a different
   * conversation is handed over. The body is written to be safe to repeat: it clears the queue and
   * the thread before it writes anything, so a second run rebuilds the same opening rather than
   * doubling it. That matters because StrictMode runs every effect twice in development, and this
   * is the only entry point set up inside an effect — skipping the second pass would leave the
   * reveal loop half-torn-down, with the thread frozen on the greeting.
   */
  useEffect(() => {
    if (!adopt) return;

    const copy = scenarioCopy[adopt.scenarioId];
    setScenarioId(adopt.scenarioId);
    setScenarioTitle(copy?.title ?? adopt.scenarioId);
    setPickingError(null);
    clearQueue();
    setStream([]);
    setLifecycle(null);
    setPhase("conversation");
    setIntentId(adopt.intentId);
    // The ref is normally synced during render, which has not happened yet inside this effect —
    // and `advance` below reads it to open the preview when the position left nothing to ask.
    intentIdRef.current = adopt.intentId;
    answeredSlotsRef.current = {};

    push(withId({ kind: "bot", text: positionCopy.opened(adopt.positionLabel) }));
    refreshLifecycle(adopt.intentId);
    advance(adopt.state, undefined, adopt.scenarioId);
    // Keyed on the intent, not on the object: a caller may rebuild `adopt` on every render, and
    // re-running then would clear a conversation already in progress — or loop. The callbacks are
    // left out for the same reason, since they are re-created as unrelated state moves; everything
    // the opening needs is read from `adopt` itself, so a stale one cannot produce a stale opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adopt?.intentId]);

  const answer = useCallback(
    async (value: string) => {
      const id = intentIdRef.current;
      const slot = currentSlot;
      if (!id || !slot) return;
      push(withId({ kind: "user", text: value === "" ? "(pulado)" : formatAnswerBubbleText(value, slot, language, t) }));
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
    [currentSlot, push, refreshLifecycle, advance, offerIdentity, language, t],
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

      // Reformatted only when the raw text is cleanly what the open slot asks for (a plain amount,
      // a plain ISO date) — free text the extractor still has to interpret is echoed exactly as
      // typed, since guessing a format for it could show something that isn't what was meant.
      // A blank submit only reaches here for an optional slot (Composer blocks it otherwise), so
      // it reads as a skip — same wording as the dedicated `answer()` path uses for the same case.
      push(withId({ kind: "user", text: text === "" ? "(pulado)" : formatAnswerBubbleText(text, currentSlot, language, t) }));
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
    [currentSlot, scenarioId, push, refreshLifecycle, applyInterpretation, advance, language, t],
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
    // Two kinds of question can be answered by pointing at a position: the lineage one (EVENT_REF)
    // and the continuity one, which is carried by a plain string slot. Which string slot that is
    // comes back with the candidates, so the engine — not this effect — decides whether to offer.
    if (!id || !currentSlot || (currentSlot.type !== "event_ref" && currentSlot.type !== "string")) return;

    let cancelled = false;
    operationsApi.settlementCandidates(id).then(({ ok, data }) => {
      if (cancelled || !ok) return;
      const offerable = offerablePositions(data.candidates, currentSlot, data.slots);
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
   * Sends an attached file to the extraction endpoint and applies whatever fields it could read
   * straight into the current scenario's unanswered slots — the same batch-merge path `applyAnswers`
   * already uses, so it advances `currentSlot`/`phase` (or opens the confirm card) exactly the same
   * way a typed answer would. A counterparty the Directory couldn't resolve to exactly one party is
   * offered through the ordinary identity flow, just like any other PARTY answer.
   */
  const extractFromFile = useCallback(
    async (file: File) => {
      const id = intentIdRef.current;
      if (!id) return;
      setBusy(true);
      const { data } = await operationsApi.extract(id, file);
      setBusy(false);
      // A dropped/attached file in an unsupported format (or too large) never reaches extraction at
      // all — multer answers with 400 and an `{ error }` body before this route's own handler runs.
      // That is the user's to fix (pick a different file), not a connectivity failure.
      if (!data || !("extraction" in data)) {
        const reason = data && "error" in data ? data.error : undefined;
        push(withId(reason ? { kind: "error", text: translateMessage(reason) } : { kind: "transport-error" }));
        return;
      }
      refreshLifecycle(id);
      // Neither `applied` nor `skipped` slots ever became `currentSlot` — record them now so the
      // extraction card (and later "Editar") can show a proper label for each, exactly like a slot
      // the guided dialog actually asked about.
      const sid = scenarioId ?? "";
      for (const slot of data.applied) recordSlot(slot, slotPrompt(sid, slot));
      for (const { slot } of data.skipped) recordSlot(slot, slotPrompt(sid, slot));
      push(withId({ kind: "extraction", result: data }));
      if (offerIdentity(data.identity)) return;
      advance(data.state, undefined, sid);
    },
    [advance, offerIdentity, push, refreshLifecycle, scenarioId],
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
        // A retyped counterparty the Directory could not pin to exactly one party was not recorded,
        // leaving the slot blank — the preview below would then fail with nothing to explain it.
        // Naming it on the field is the only place the user can act on it.
        if (data.identity && !identityWasRecorded(data.identity)) {
          setBusy(false);
          return { ok: false as const, error: { key, message: identityCopy.unresolvedEdit } };
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
    extractFromFile,
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
