import { describe, expect, it } from "vitest";
import { returnDiscarded, returnOffer, type ReturnTarget } from "@/features/operations/returnTarget";

/** REQ-690 / CA-690: a conversation opened from a screen offers to go back to it when it ends. */
const fromAgenda: ReturnTarget = { nav: "agenda", intentId: "intent-1" };

describe("REQ-690 — the way back to the screen a conversation was opened from", () => {
  it("is not offered when the conversation was not opened from a screen", () => {
    expect(returnOffer(null, { intentId: "intent-1", phase: "conversation", seenTarget: true })).toBe("none");
    expect(returnOffer(undefined, { intentId: null, phase: "picking", seenTarget: false })).toBe("none");
  });

  it("is secondary while the opened conversation is still running", () => {
    expect(returnOffer(fromAgenda, { intentId: "intent-1", phase: "conversation", seenTarget: true })).toBe("secondary");
    expect(returnOffer(fromAgenda, { intentId: "intent-1", phase: "confirming", seenTarget: true })).toBe("secondary");
  });

  it("is primary once the conversation ended: sent, or refused for good", () => {
    expect(returnOffer(fromAgenda, { intentId: "intent-1", phase: "done", seenTarget: true })).toBe("primary");
  });

  it("is primary once the operator gave up (Cancelar brings back the picker, with no intent)", () => {
    expect(returnOffer(fromAgenda, { intentId: null, phase: "picking", seenTarget: true })).toBe("primary");
  });

  it("is secondary while the opened conversation is still being taken up, never a false 'gave up'", () => {
    expect(returnOffer(fromAgenda, { intentId: null, phase: "picking", seenTarget: false })).toBe("secondary");
  });

  it("is not offered from a conversation the operator started on their own", () => {
    expect(returnOffer(fromAgenda, { intentId: "intent-2", phase: "done", seenTarget: true })).toBe("none");
  });

  it("is discarded only when another conversation has started", () => {
    expect(returnDiscarded(fromAgenda, { intentId: "intent-2" })).toBe(true);
    expect(returnDiscarded(fromAgenda, { intentId: "intent-1" })).toBe(false);
    expect(returnDiscarded(fromAgenda, { intentId: null })).toBe(false);
    expect(returnDiscarded(null, { intentId: "intent-2" })).toBe(false);
  });
});
