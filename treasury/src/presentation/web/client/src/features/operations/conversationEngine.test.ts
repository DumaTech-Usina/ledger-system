import { describe, it, expect } from "vitest";
import {
  decideAdvance,
  decideClassification,
  interpretationMessages,
  shouldFallbackToDirectAnswer,
} from "@/features/operations/conversationEngine";
import type { DialogState, InterpretResult, SlotDefinition } from "@/types/operations";

const payeeSlot: SlotDefinition = { key: "payee", type: "party", prompt: "Who is being paid?", required: true };

const readyState: DialogState = { kind: "ready", answered: 5, total: 5 };
const questionState: DialogState = { kind: "question", slot: payeeSlot, answered: 0, total: 5 };

const emptyOutcome = { accepted: [], rejected: [], skipped: [], lowConfidence: [] };

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
