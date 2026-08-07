// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { setTypingAnimationDisabled } from "@/hooks/useAnimationsDisabled";

/**
 * The conversation opened from a position, when the position could answer everything.
 *
 * A payroll obligation recognized against a known counterparty leaves nothing for the operator to
 * type: the position supplies the continuity, the lineage, the currency and the counterparty, and
 * the amount and date came with the recognition. The chat then has no question to ask, and what the
 * user must see is the confirmation card — the same one that ends every other operation.
 *
 * This is written against what the user observes (a confirmation appears, the conversation moves to
 * confirming) rather than against how the hook stores it, so it keeps holding if the internals move.
 */

const preview = vi.fn();

vi.mock("@/features/operations/operationsApi", () => ({
  operationsApi: {
    scenarios: vi.fn(async () => ({ ok: true, status: 200, data: { scenarios: [] } })),
    getIntent: vi.fn(async () => ({
      ok: true,
      status: 200,
      data: {
        intent: { id: "intent-adopted", status: "awaiting_confirmation" },
        history: [],
      },
    })),
    preview: (...args: unknown[]) => preview(...args),
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
    occurredAt: "2026-08-06T00:00:00.000Z",
    amount: "45000.00",
    currency: "BRL",
    parties: [],
    objects: [{ objectId: "payroll:1", objectType: "payroll", relation: "settles" }],
    reason: { type: "payroll_payment", description: "", confidence: "high", requiresFollowup: false },
    reporter: { reporterType: "user", reporterId: "cfo", channel: "web" },
  },
  partyNames: {},
};

/** Everything the position could answer is answered: the dialog has nothing left to ask. */
const adoptedAndReady = {
  intentId: "intent-adopted",
  scenarioId: "register_payroll",
  state: { kind: "ready" as const, answered: 4, total: 4 },
  positionLabel: "Folha de pagamento · R$ 45.000,00",
};

beforeEach(() => {
  preview.mockReset();
  preview.mockResolvedValue({ ok: true, status: 200, data: previewPayload });
  // The reveal is paced by typing timers, and this test is about the flow, not the pacing. Set
  // through the preference's own setter rather than localStorage: the toggle reads storage once at
  // module load, so writing the key here would land after the value was already cached.
  setTypingAnimationDisabled(true);
});

describe("a conversation adopted from a position", () => {
  it("opens the confirmation when the position already answered everything", async () => {
    const { result } = renderHook(() => useConversation(adoptedAndReady));

    // What the user sees: the operation is ready to confirm, and the card is on screen. Without it
    // the chat simply stops — no question, no card, no error — and there is nothing left to do.
    await waitFor(() => {
      expect(result.current.stream.some((item) => item.kind === "confirm")).toBe(true);
    });
    expect(result.current.phase).toBe("confirming");
  });

  it("asks the Ledger for that confirmation exactly once, for the adopted operation", async () => {
    renderHook(() => useConversation(adoptedAndReady));

    await waitFor(() => expect(preview).toHaveBeenCalledWith("intent-adopted"));
    expect(preview).toHaveBeenCalledTimes(1);
  });

  it("still asks the question when the position could not answer everything", async () => {
    // The counterpart case, so the two are pinned together: a conversation that DOES have something
    // left to ask must ask it, and must not jump to a confirmation.
    const { result } = renderHook(() =>
      useConversation({
        ...adoptedAndReady,
        state: {
          kind: "question" as const,
          slot: { key: "amount", type: "money" as const, prompt: "Qual é o valor?", required: true },
          answered: 3,
          total: 4,
        },
      }),
    );

    await waitFor(() => expect(result.current.currentSlot?.key).toBe("amount"));
    expect(result.current.phase).toBe("conversation");
    expect(preview).not.toHaveBeenCalled();
  });
});
