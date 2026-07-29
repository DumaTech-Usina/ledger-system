import { describe, it, expect } from "vitest";
import { DialogEngine } from "../../../core/domain/services/DialogEngine";
import { registerPayment } from "../../../core/domain/scenarios/registerPayment";

const slot = (key: string) => registerPayment.slots.find((s) => s.key === key)!;

describe("DialogEngine.nextState", () => {
  it("asks for the first required slot when nothing is answered", () => {
    const state = DialogEngine.nextState(registerPayment, {});
    expect(state.kind).toBe("question");
    if (state.kind === "question") expect(state.slot.key).toBe("payee");
  });

  it("skips to the next unfilled required slot as answers arrive", () => {
    const state = DialogEngine.nextState(registerPayment, {
      payee: "ACME",
      amount: "1500.00",
      currency: "BRL",
    });
    expect(state.kind).toBe("question");
    if (state.kind === "question") expect(state.slot.key).toBe("occurredAt");
  });

  it("is ready when all required slots are filled (optional ones may be blank)", () => {
    const state = DialogEngine.nextState(registerPayment, {
      payee: "ACME",
      amount: "1500.00",
      currency: "BRL",
      occurredAt: "2026-07-09",
    });
    expect(state.kind).toBe("ready");
  });
});

describe("DialogEngine.normalizeAnswer", () => {
  it("converts a DD/MM/YYYY date to the slot's canonical ISO form", () => {
    expect(DialogEngine.normalizeAnswer(slot("occurredAt"), "28/07/2026")).toBe("2026-07-28");
  });

  it("also accepts DD-MM-YYYY", () => {
    expect(DialogEngine.normalizeAnswer(slot("occurredAt"), "28-07-2026")).toBe("2026-07-28");
  });

  it("leaves an already-ISO date unchanged", () => {
    expect(DialogEngine.normalizeAnswer(slot("occurredAt"), "2026-07-28")).toBe("2026-07-28");
  });

  it("leaves an impossible calendar date unchanged, so validateAnswer still rejects it", () => {
    const value = DialogEngine.normalizeAnswer(slot("occurredAt"), "31/02/2026");
    expect(value).toBe("31/02/2026");
    expect(DialogEngine.validateAnswer(slot("occurredAt"), value)).not.toBeNull();
  });

  it("does not touch non-date slots", () => {
    expect(DialogEngine.normalizeAnswer(slot("amount"), "28/07/2026")).toBe("28/07/2026");
  });
});

describe("DialogEngine.validateAnswer", () => {
  it("rejects a non-numeric money value", () => {
    expect(DialogEngine.validateAnswer(slot("amount"), "abc")).not.toBeNull();
  });

  it("rejects a non-positive amount", () => {
    expect(DialogEngine.validateAnswer(slot("amount"), "0")).not.toBeNull();
  });

  it("accepts a valid amount", () => {
    expect(DialogEngine.validateAnswer(slot("amount"), "1500.00")).toBeNull();
  });

  it("rejects a value outside a CHOICE slot", () => {
    expect(DialogEngine.validateAnswer(slot("currency"), "GBP")).not.toBeNull();
  });

  it("rejects a required slot left blank", () => {
    expect(DialogEngine.validateAnswer(slot("payee"), "")).not.toBeNull();
  });

  it("accepts an optional slot left blank", () => {
    expect(DialogEngine.validateAnswer(slot("description"), "")).toBeNull();
  });
});
