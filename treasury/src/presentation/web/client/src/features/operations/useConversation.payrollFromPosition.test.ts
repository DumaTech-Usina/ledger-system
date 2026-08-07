// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { setTypingAnimationDisabled } from "@/hooks/useAnimationsDisabled";

/**
 * Registering a payment against a position that was recognized first.
 *
 * A payable is recognized, its position is opened, and the payment is started from there. The
 * position supplies what it knows, so the conversation asks only what the operator can answer: the
 * amount, then the date. Answering the last one completes the operation, and what has to happen
 * next is the thing that ends every other operation in this app — the confirmation appears.
 *
 * The symptom this guards against is the conversation going quiet instead: no card, no question, no
 * error, and nothing left to click. Written against what the user sees, so it survives any change to
 * how the hook paces or stores its messages.
 */

const preview = vi.fn();
const interpretBound = vi.fn();

vi.mock("@/features/operations/operationsApi", () => ({
  operationsApi: {
    scenarios: vi.fn(async () => ({ ok: true, status: 200, data: { scenarios: [] } })),
    getIntent: vi.fn(async () => ({
      ok: true,
      status: 200,
      data: { intent: { id: "intent-payment", status: "gathering" }, history: [] },
    })),
    preview: (...args: unknown[]) => preview(...args),
    interpretBound: (...args: unknown[]) => interpretBound(...args),
    answer: vi.fn(),
  },
}));

const { useConversation } = await import("@/features/operations/useConversation");

const dateSlot = { key: "occurredAt", type: "date" as const, prompt: "Em que data?", required: true };

/** What the server replies as each answer lands: first the date is still missing, then nothing is. */
const serverReplies = (state: unknown, accepted: string[]) => ({
  ok: true,
  status: 200,
  data: {
    intentId: "intent-payment",
    scenarioId: "register_payment",
    state,
    accepted,
    rejected: [],
    skipped: [],
    lowConfidence: [],
    identity: [],
  },
});

const previewPayload = {
  intentId: "intent-payment",
  scenarioTitle: "Registrar pagamento",
  answers: {},
  candidate: {
    sourceReference: "intent:payment",
    eventType: "outbound_payment",
    economicEffect: "cash_out",
    occurredAt: "2026-08-06T00:00:00.000Z",
    amount: "1000.00",
    currency: "BRL",
    parties: [],
    objects: [{ objectId: "intent:pay-1", objectType: "payable", relation: "settles" }],
    reason: { type: "ordinary_settlement", description: "", confidence: "high", requiresFollowup: false },
    reporter: { reporterType: "user", reporterId: "cfo", channel: "web" },
  },
  partyNames: {},
};

/** The conversation as it opens from the position: only the amount is still to be answered. */
const openedFromPosition = {
  intentId: "intent-payment",
  scenarioId: "register_payment",
  state: {
    kind: "question" as const,
    slot: { key: "amount", type: "money" as const, prompt: "Qual é o valor?", required: true },
    answered: 3,
    total: 6,
  },
  positionLabel: "A pagar · R$ 1.000,00",
};

beforeEach(() => {
  preview.mockReset();
  interpretBound.mockReset();
  preview.mockResolvedValue({ ok: true, status: 200, data: previewPayload });
  // The typing reveal is pacing, not behaviour; this test is about whether the flow arrives.
  setTypingAnimationDisabled(true);
});

describe("registering a payment from a recognized position", () => {
  it("shows the confirmation once the date is answered", async () => {
    interpretBound
      .mockResolvedValueOnce(serverReplies({ kind: "question", slot: dateSlot, answered: 4, total: 6 }, ["amount"]))
      .mockResolvedValueOnce(serverReplies({ kind: "ready", answered: 5, total: 6 }, ["occurredAt"]));

    const { result } = renderHook(() => useConversation(openedFromPosition));
    await waitFor(() => expect(result.current.currentSlot?.key).toBe("amount"));

    await act(async () => {
      await result.current.sendUtterance("1000.00");
    });
    await waitFor(() => expect(result.current.currentSlot?.key).toBe("occurredAt"));

    await act(async () => {
      await result.current.sendUtterance("2026-08-06");
    });

    // The operation is complete, so the confirmation is what comes next — and the user must be able
    // to act on it. Without it the conversation simply stops with nothing on screen to use.
    await waitFor(() => {
      expect(result.current.stream.some((item) => item.kind === "confirm")).toBe(true);
    });
  });

  it("leaves the conversation usable — the confirmation carries the operation to confirm", async () => {
    interpretBound
      .mockResolvedValueOnce(serverReplies({ kind: "question", slot: dateSlot, answered: 4, total: 6 }, ["amount"]))
      .mockResolvedValueOnce(serverReplies({ kind: "ready", answered: 5, total: 6 }, ["occurredAt"]));

    const { result } = renderHook(() => useConversation(openedFromPosition));
    await waitFor(() => expect(result.current.currentSlot?.key).toBe("amount"));

    await act(async () => {
      await result.current.sendUtterance("1000.00");
    });
    await waitFor(() => expect(result.current.currentSlot?.key).toBe("occurredAt"));
    await act(async () => {
      await result.current.sendUtterance("2026-08-06");
    });

    await waitFor(() => {
      const card = result.current.stream.find((item) => item.kind === "confirm");
      expect(card).toBeDefined();
      // The card the user confirms is the operation they just described, not an empty shell.
      expect((card as unknown as { preview: typeof previewPayload }).preview.candidate.amount).toBe("1000.00");
    });
  });
});
