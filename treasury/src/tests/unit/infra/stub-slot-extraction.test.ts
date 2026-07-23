import { describe, it, expect } from "vitest";
import { StubSlotExtractionAdapter } from "../../../infra/nlp/StubSlotExtractionAdapter";
import { getScenario } from "../../../core/domain/scenarios/Scenario";
import type { SlotDefinition } from "../../../core/domain/value-objects/Slot";

const slots = getScenario("register_payment")!.slots; // payee, amount, currency(BRL|USD), occurredAt, description
const adapter = new StubSlotExtractionAdapter();

const byKey = (result: { slots: { key: string; value: string; confidence: number }[] }) =>
  Object.fromEntries(result.slots.map((s) => [s.key, s.value]));

describe("StubSlotExtractionAdapter", () => {
  it("extracts money, currency and an ISO date from a natural sentence", async () => {
    const res = await adapter.extract({ utterance: "Paguei 1500.00 em BRL no dia 2026-07-23", slots });
    const values = byKey(res);
    expect(values.amount).toBe("1500.00");
    expect(values.currency).toBe("BRL");
    expect(values.occurredAt).toBe("2026-07-23");
  });

  it("normalizes a pt-BR money format to the slot's canonical form", async () => {
    const res = await adapter.extract({ utterance: "valor de R$ 1.500,00", slots });
    expect(byKey(res).amount).toBe("1500.00");
  });

  it("grounds a PARTY mention to a known party id, and leaves it unfilled without a directory", async () => {
    const grounded = await adapter.extract({
      utterance: "pagamento para ACME",
      slots,
      knownParties: [{ partyId: "party-acme", name: "ACME" }],
    });
    expect(byKey(grounded).payee).toBe("party-acme");

    const ungrounded = await adapter.extract({ utterance: "pagamento para ACME", slots });
    expect(byKey(ungrounded).payee).toBeUndefined();
  });

  it("proposes nothing for an unparseable utterance", async () => {
    const res = await adapter.extract({ utterance: "olá, tudo bem?", slots });
    expect(res.slots).toHaveLength(0);
  });

  it("is deterministic — same input yields the same proposals", async () => {
    const a = await adapter.extract({ utterance: "1500.00 BRL 2026-07-23", slots });
    const b = await adapter.extract({ utterance: "1500.00 BRL 2026-07-23", slots });
    expect(a).toEqual(b);
  });
});

/**
 * The contract every SlotExtractionPort adapter must satisfy. When a real-model adapter is added,
 * it should be exercised against these same invariants.
 */
describe("SlotExtractionPort contract (StubSlotExtractionAdapter)", () => {
  const knownKeys = new Set(slots.map((s) => s.key));
  const garbageInputs = ["", "   ", "🙂", "12", "select * from x"];

  it("never throws on empty or garbage input", async () => {
    for (const utterance of garbageInputs) {
      await expect(adapter.extract({ utterance, slots })).resolves.toBeDefined();
    }
  });

  it("proposes only keys that exist in the scenario slots", async () => {
    const res = await adapter.extract({ utterance: "1500.00 BRL 2026-07-23 ACME", slots });
    for (const p of res.slots) expect(knownKeys.has(p.key)).toBe(true);
  });

  it("emits confidences within [0, 1]", async () => {
    const res = await adapter.extract({ utterance: "R$ 1.500,00 em USD 2026-07-23", slots });
    for (const p of res.slots) {
      expect(p.confidence).toBeGreaterThanOrEqual(0);
      expect(p.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("proposes nothing when the scenario declares no slots", async () => {
    const res = await adapter.extract({ utterance: "1500.00 BRL", slots: [] as SlotDefinition[] });
    expect(res.slots).toHaveLength(0);
  });
});
