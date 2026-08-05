import { describe, it, expect } from "vitest";
import {
  decideAdvance,
  decideClassification,
  decideSubmitOutcome,
  identityDecision,
  interpretationMessages,
  offerablePositions,
  pendingIdentity,
  positionAnswers,
  shouldFallbackToDirectAnswer,
} from "@/features/operations/conversationEngine";
import type {
  DialogState,
  IdentityOutcome,
  InterpretResult,
  Mention,
  SettlementCandidate,
  SlotDefinition,
  SubmitIntentResult,
} from "@/types/operations";

const payeeSlot: SlotDefinition = { key: "payee", type: "party", prompt: "Who is being paid?", required: true };

const readyState: DialogState = { kind: "ready", answered: 5, total: 5 };
const questionState: DialogState = { kind: "question", slot: payeeSlot, answered: 0, total: 5 };

const emptyOutcome = { accepted: [], rejected: [], skipped: [], lowConfidence: [], identity: [] };

describe("decideAdvance", () => {
  it("stays put with a translated error message when the answer was rejected", () => {
    const decision = decideAdvance(questionState, { key: "amount", message: "Amount must be greater than zero." }, "register_payment");
    expect(decision).toEqual({ kind: "error", message: { kind: "error", text: "O valor deve ser maior que zero." } });
  });

  it("signals ready when the dialog state is ready", () => {
    const decision = decideAdvance(readyState, undefined, "register_payment");
    expect(decision).toEqual({ kind: "ready" });
  });

  it("asks the next question in the scenario's own language", () => {
    const decision = decideAdvance(questionState, undefined, "register_payment");
    expect(decision.kind).toBe("question");
    if (decision.kind !== "question") return;
    expect(decision.slot).toBe(payeeSlot);
    expect(decision.message).toEqual({ kind: "bot", text: "Para quem é o pagamento?" });
  });

  it("falls back to the slot's own prompt for a scenario with no translated copy", () => {
    const decision = decideAdvance(questionState, undefined, "some_unknown_scenario");
    expect(decision.kind).toBe("question");
    if (decision.kind !== "question") return;
    expect(decision.message).toEqual({ kind: "bot", text: "Who is being paid?" });
  });
});

describe("interpretationMessages", () => {
  it("returns nothing when the result found nothing to say", () => {
    const result: InterpretResult = { ...emptyOutcome };
    expect(interpretationMessages(result, "register_payment")).toEqual([]);
  });

  it("turns each rejected proposal into a translated error bubble", () => {
    const result: InterpretResult = {
      ...emptyOutcome,
      rejected: [{ key: "amount", message: "Enter a valid amount, e.g. 1500.00." }],
    };
    expect(interpretationMessages(result, "register_payment")).toEqual([
      { kind: "error", text: "Informe um valor válido, ex.: 1500.00." },
    ]);
  });

  it("turns each low-confidence proposal into a suggestion bubble labeled in pt-BR", () => {
    const result: InterpretResult = {
      ...emptyOutcome,
      lowConfidence: [{ key: "amount", value: "500.00", confidence: 0.4 }],
    };
    expect(interpretationMessages(result, "register_payment")).toEqual([
      { kind: "suggestion", proposalKey: "amount", value: "500.00", label: "Qual é o valor do pagamento?" },
    ]);
  });

  it("orders errors before suggestions, regardless of how the result listed them", () => {
    const result: InterpretResult = {
      ...emptyOutcome,
      rejected: [{ key: "amount", message: "Enter a valid date." }],
      lowConfidence: [{ key: "currency", value: "BRL", confidence: 0.4 }],
    };
    const messages = interpretationMessages(result, "register_payment");
    expect(messages.map((m) => m.kind)).toEqual(["error", "suggestion"]);
  });
});

describe("shouldFallbackToDirectAnswer", () => {
  it("is false when there is no open question to fall back to", () => {
    const result: InterpretResult = { ...emptyOutcome, state: questionState };
    expect(shouldFallbackToDirectAnswer(null, result)).toBe(false);
  });

  it("is false once the dialog reached ready, even with nothing accepted", () => {
    const result: InterpretResult = { ...emptyOutcome, state: readyState };
    expect(shouldFallbackToDirectAnswer("payee", result)).toBe(false);
  });

  it("is false when the extraction accepted something, even if the question didn't move", () => {
    const result: InterpretResult = { ...emptyOutcome, accepted: ["currency"], state: questionState };
    expect(shouldFallbackToDirectAnswer("payee", result)).toBe(false);
  });

  it("is true when nothing was extracted at all and a question is still open", () => {
    const result: InterpretResult = { ...emptyOutcome, state: questionState };
    expect(shouldFallbackToDirectAnswer("payee", result)).toBe(true);
  });
});

describe("decideClassification", () => {
  it("asks in pt-BR to try again when no scenario was resolved — never the backend's raw English list", () => {
    const result: InterpretResult = { ...emptyOutcome, clarification: "Which operation do you mean? A · B · C" };
    const decision = decideClassification(result);
    expect(decision).toEqual({
      kind: "error",
      message: "Não consegui encontrar a operação desejada. Tente descrever de outro jeito, ou escolha uma abaixo.",
    });
  });

  it("starts the conversation with the scenario's translated title and greeting", () => {
    const result: InterpretResult = {
      ...emptyOutcome,
      intentId: "intent-1",
      scenarioId: "register_payment",
    };
    const decision = decideClassification(result);
    expect(decision.kind).toBe("classified");
    if (decision.kind !== "classified") return;
    expect(decision.intentId).toBe("intent-1");
    expect(decision.scenarioId).toBe("register_payment");
    expect(decision.scenarioTitle).toBe("Registrar pagamento geral");
    expect(decision.greeting.kind).toBe("bot");
    expect(decision.greeting).toEqual({
      kind: "bot",
      text: "Vamos lá! Registrar uma saída de caixa geral, não coberta por uma operação específica. Use uma operação específica quando existir (ex.: Folha de pagamento).",
    });
  });

  it("falls back to the raw scenario id as the title when there is no translated copy for it", () => {
    const result: InterpretResult = { ...emptyOutcome, intentId: "intent-1", scenarioId: "some_unknown_scenario" };
    const decision = decideClassification(result);
    expect(decision.kind).toBe("classified");
    if (decision.kind !== "classified") return;
    expect(decision.scenarioTitle).toBe("some_unknown_scenario");
    expect(decision.greeting).toEqual({ kind: "bot", text: "Vamos lá!" });
  });
});

describe("identityDecision", () => {
  const mention = (text: string): Mention => ({ text, normalized: text.toLowerCase() });
  const unidentifiableSlot: SlotDefinition = { ...payeeSlot, allowUnidentifiable: true };

  it("asks nothing when the mention resolved exactly — the answer is already recorded", () => {
    const outcome: IdentityOutcome = {
      slot: "payee",
      resolution: {
        kind: "resolved",
        mention: mention("Fornecedor Sul"),
        partyId: "party-1",
        rule: "exact_name",
        score: 1,
        needsConfirmation: false,
      },
    };
    expect(identityDecision(outcome, payeeSlot)).toBeNull();
  });

  it("asks to confirm a similarity hit, showing the id it would use", () => {
    const outcome: IdentityOutcome = {
      slot: "payee",
      resolution: {
        kind: "resolved",
        mention: mention("Fornec. Sul"),
        partyId: "party-1",
        rule: "similarity",
        score: 0.9,
        needsConfirmation: true,
      },
    };
    const message = identityDecision(outcome, payeeSlot);
    expect(message).not.toBeNull();
    if (message?.kind !== "identity") return;
    expect(message.text).toBe('"Fornec. Sul" parece ser a contraparte party-1. É essa mesma?');
    expect(message.options).toEqual([
      { kind: "select", partyId: "party-1", label: "party-1" },
      { kind: "create", mention: "Fornec. Sul", label: 'Cadastrar "Fornec. Sul"' },
    ]);
  });

  it("offers every candidate by name when the mention was ambiguous, in the order received", () => {
    const outcome: IdentityOutcome = {
      slot: "payee",
      resolution: {
        kind: "ambiguous",
        mention: mention("Sul"),
        candidates: [
          { partyId: "party-1", displayName: "Fornecedor Sul", score: 0.92 },
          { partyId: "party-2", displayName: "Sul Distribuidora", score: 0.88 },
        ],
      },
    };
    const message = identityDecision(outcome, payeeSlot);
    if (message?.kind !== "identity") return;
    expect(message.options.map((o) => o.label)).toEqual([
      "Fornecedor Sul",
      "Sul Distribuidora",
      'Cadastrar "Sul"',
    ]);
  });

  it("offers creation for a mention no party matches", () => {
    const outcome: IdentityOutcome = { slot: "payee", resolution: { kind: "new", mention: mention("Padaria Aurora") } };
    const message = identityDecision(outcome, payeeSlot);
    if (message?.kind !== "identity") return;
    expect(message.text).toBe('Ainda não conheço "Padaria Aurora". Quer cadastrar?');
    expect(message.options).toEqual([
      { kind: "create", mention: "Padaria Aurora", label: 'Cadastrar "Padaria Aurora"' },
    ]);
  });

  it("offers 'unidentifiable' only where the slot admits it", () => {
    const outcome: IdentityOutcome = { slot: "payee", resolution: { kind: "new", mention: mention("alguém") } };
    const admitted = identityDecision(outcome, unidentifiableSlot);
    if (admitted?.kind !== "identity") return;
    expect(admitted.options.map((o) => o.kind)).toEqual(["create", "unidentifiable"]);
  });

  it("treats an unknown slot as not admitting 'unidentifiable' — absence is never an escape", () => {
    const outcome: IdentityOutcome = { slot: "payee", resolution: { kind: "new", mention: mention("alguém") } };
    const message = identityDecision(outcome, undefined);
    if (message?.kind !== "identity") return;
    expect(message.options.map((o) => o.kind)).toEqual(["create"]);
  });
});

describe("pendingIdentity", () => {
  const slots: Record<string, SlotDefinition> = { payee: payeeSlot };

  it("returns nothing when there is no outcome to act on", () => {
    expect(pendingIdentity(undefined, slots)).toBeNull();
    expect(pendingIdentity([], slots)).toBeNull();
  });

  it("asks about the first unresolved mention only — never several at once", () => {
    const resolved: IdentityOutcome = {
      slot: "payee",
      resolution: {
        kind: "resolved",
        mention: { text: "Fornecedor Sul", normalized: "fornecedor sul" },
        partyId: "party-1",
        rule: "exact_name",
        score: 1,
        needsConfirmation: false,
      },
    };
    const unresolved: IdentityOutcome = {
      slot: "payee",
      resolution: { kind: "new", mention: { text: "Padaria Aurora", normalized: "padaria aurora" } },
    };
    const message = pendingIdentity([resolved, unresolved, unresolved], slots);
    if (message?.kind !== "identity") return;
    expect(message.text).toContain("Padaria Aurora");
  });
});

describe("decideSubmitOutcome", () => {
  const candidate = {} as SubmitIntentResult["candidate"];

  it("ends the conversation when the Ledger accepted the fact", () => {
    const decision = decideSubmitOutcome({
      intentId: "intent-1",
      status: "accepted",
      intentStatus: "accepted",
      ledgerReference: "evt-9",
      candidate,
    });
    expect(decision.terminal).toBe(true);
    if (decision.message.kind !== "result") return;
    expect(decision.message.ledgerReference).toBe("evt-9");
    expect(decision.message.correctionSlots).toBeUndefined();
  });

  it("keeps the conversation open on a fixable rejection, carrying the slots to re-answer", () => {
    const decision = decideSubmitOutcome({
      intentId: "intent-1",
      status: "rejected",
      intentStatus: "awaiting_correction",
      reason: "Amount exceeds the origin.",
      rejections: [{ code: "OVER_SETTLEMENT", category: "lineage", detail: "Amount exceeds the origin." }],
      correction: { slots: ["amount"] },
      candidate,
    });
    expect(decision.terminal).toBe(false);
    if (decision.message.kind !== "result") return;
    expect(decision.message.correctionSlots).toEqual(["amount"]);
    expect(decision.message.rejections).toHaveLength(1);
  });

  it("branches on intentStatus, not status — a fixable rejection reports 'rejected' too", () => {
    const fixable = decideSubmitOutcome({
      intentId: "intent-1",
      status: "rejected",
      intentStatus: "awaiting_correction",
      candidate,
    });
    const terminal = decideSubmitOutcome({
      intentId: "intent-1",
      status: "rejected",
      intentStatus: "rejected",
      candidate,
    });
    expect([fixable.terminal, terminal.terminal]).toEqual([false, true]);
  });

  it("offers an empty slot list rather than none when the Ledger named no field", () => {
    const decision = decideSubmitOutcome({
      intentId: "intent-1",
      status: "rejected",
      intentStatus: "awaiting_correction",
      candidate,
    });
    if (decision.message.kind !== "result") return;
    expect(decision.message.correctionSlots).toEqual([]);
  });
});

describe("offerablePositions", () => {
  const eventRef: SlotDefinition = { key: "origin", type: "event_ref", prompt: "Which advance?", required: true };
  const withOrigin: SettlementCandidate = {
    objectId: "intent:adv-1",
    originEventId: "evt-1",
    counterparty: "Corretor Parceiro",
    totalOriginated: "500.00",
    openBalance: null,
    currency: "BRL",
    originatedAt: "2026-07-02T00:00:00.000Z",
  };
  const withoutOrigin: SettlementCandidate = { ...withOrigin, objectId: "intent:adv-2", originEventId: null };

  it("offers nothing when the open question is not about a position", () => {
    expect(offerablePositions([withOrigin], payeeSlot)).toEqual([]);
    expect(offerablePositions([withOrigin], null)).toEqual([]);
  });

  it("hides a position that cannot answer a required origin — it would leave the question open", () => {
    expect(offerablePositions([withOrigin, withoutOrigin], eventRef)).toEqual([withOrigin]);
  });

  it("offers a position with no origin when the question does not require one", () => {
    const optional: SlotDefinition = { ...eventRef, required: false };
    expect(offerablePositions([withOrigin, withoutOrigin], optional)).toEqual([withOrigin, withoutOrigin]);
  });

  it("offers nothing when the Ledger holds no open position", () => {
    expect(offerablePositions([], eventRef)).toEqual([]);
  });

  describe("positionAnswers", () => {
    it("asserts both axes from one selection", () => {
      expect(positionAnswers(withOrigin, { continuity: "objectRef", lineage: "origin" })).toEqual([
        { key: "origin", value: "evt-1" },
        { key: "objectRef", value: "intent:adv-1" },
      ]);
    });

    it("asserts continuity alone when the position has no origin to point at", () => {
      expect(positionAnswers(withoutOrigin, { continuity: "objectRef", lineage: "origin" })).toEqual([
        { key: "objectRef", value: "intent:adv-2" },
      ]);
    });

    it("sends nothing for a scenario that declares neither key", () => {
      expect(positionAnswers(withOrigin, {})).toEqual([]);
    });
  });
});
