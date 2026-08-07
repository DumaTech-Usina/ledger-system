// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { StrictMode } from "react";
import { renderHook, waitFor, act } from "@testing-library/react";
import { setTypingAnimationDisabled } from "@/hooks/useAnimationsDisabled";

/**
 * A conversation opened from a position, under the StrictMode the app actually runs in.
 *
 * `main.tsx` mounts the tree inside `<StrictMode>`, so in development React runs every effect
 * twice — effect, cleanup, effect — while refs survive that cycle untouched. A conversation started
 * from a position is set up INSIDE an effect, which is what makes it the only entry point exposed
 * to that double pass: picking a scenario from the grid happens in a click handler and never sees it.
 *
 * What the user must keep seeing is simply the conversation moving: the greeting, then the question,
 * then the confirmation. The failure this guards against is the thread stopping after the greeting
 * while everything else still works — the composer keeps accepting answers, the requests all
 * succeed, and not one further message ever appears.
 *
 * Asserted on the messages themselves, never on how they are paced or stored.
 */

const preview = vi.fn();
const interpretBound = vi.fn();

vi.mock("@/features/operations/operationsApi", () => ({
  operationsApi: {
    scenarios: vi.fn(async () => ({ ok: true, status: 200, data: { scenarios: [] } })),
    getIntent: vi.fn(async () => ({
      ok: true,
      status: 200,
      data: { intent: { id: "intent-adopted", status: "gathering" }, history: [] },
    })),
    preview: (...args: unknown[]) => preview(...args),
    interpretBound: (...args: unknown[]) => interpretBound(...args),
    answer: vi.fn(),
  },
}));

const { useConversation } = await import("@/features/operations/useConversation");

const previewPayload = {
  intentId: "intent-adopted",
  scenarioTitle: "Registrar folha de pagamento",
  answers: {},
  candidate: {
    sourceReference: "intent:adopted",
    eventType: "payroll_payment",
    economicEffect: "cash_out",
    occurredAt: "2026-08-12T00:00:00.000Z",
    amount: "7000",
    currency: "BRL",
    parties: [],
    objects: [{ objectId: "intent:pay-1", objectType: "payroll", relation: "settles" }],
    reason: { type: "payroll_payment", description: "", confidence: "high", requiresFollowup: false },
    reporter: { reporterType: "user", reporterId: "cfo", channel: "web" },
  },
  partyNames: {},
};

/** Opened from the position: the amount is the one thing still to answer. */
const openedFromPosition = {
  intentId: "intent-adopted",
  scenarioId: "register_payroll",
  state: {
    kind: "question" as const,
    slot: { key: "amount", type: "money" as const, prompt: "Qual é o valor da folha?", required: true },
    answered: 4,
    total: 6,
  },
  positionLabel: "Folha de pagamento · R$ 7.000,00",
};

beforeEach(() => {
  preview.mockReset();
  interpretBound.mockReset();
  preview.mockResolvedValue({ ok: true, status: 200, data: previewPayload });
  interpretBound.mockResolvedValue({
    ok: true,
    status: 200,
    data: {
      intentId: "intent-adopted",
      scenarioId: "register_payroll",
      state: { kind: "ready", answered: 5, total: 6 },
      accepted: ["amount"],
      rejected: [],
      skipped: [],
      lowConfidence: [],
      identity: [],
    },
  });
  setTypingAnimationDisabled(true);
});

/** Renders the hook the way the app does: inside StrictMode. */
const renderAdopted = () =>
  renderHook(() => useConversation(openedFromPosition), { wrapper: StrictMode });

describe("a conversation adopted from a position, under StrictMode", () => {
  it("keeps showing messages after the greeting", async () => {
    const { result } = renderAdopted();

    // The greeting names the position — that much already works today.
    await waitFor(() => {
      expect(result.current.stream.length).toBeGreaterThan(0);
    });

    // And the conversation must not stop there: the question has to reach the thread too.
    await waitFor(() => {
      expect(result.current.stream.length).toBeGreaterThan(1);
    });
  });

  it("carries the whole exchange through to the confirmation", async () => {
    const { result } = renderAdopted();
    await waitFor(() => expect(result.current.currentSlot?.key).toBe("amount"));

    await act(async () => {
      await result.current.sendUtterance("7000");
    });

    // Everything the operator did and everything the app answered is on screen: the greeting, the
    // question, the answer they typed, and the confirmation that ends the operation.
    await waitFor(() => {
      expect(result.current.stream.some((item) => item.kind === "user")).toBe(true);
      expect(result.current.stream.some((item) => item.kind === "confirm")).toBe(true);
    });
  });
});
