import { describe, it, expect } from "vitest";
import { LlmSlotExtractionAdapter } from "../../../infra/nlp/LlmSlotExtractionAdapter";
import type { ChatModel, ChatCompletionRequest } from "../../../infra/nlp/ChatModel";
import { getScenario, listScenarios } from "../../../core/domain/scenarios/Scenario";
import type { ScenarioCatalogEntry } from "../../../core/application/ports/SlotExtractionPort";

const slots = getScenario("register_payment")!.slots; // payee, amount, currency, occurredAt, description
const catalog: ScenarioCatalogEntry[] = listScenarios().map((s) => ({
  id: s.id,
  title: s.title,
  description: s.description,
  slots: s.slots,
}));

/** A ChatModel that returns canned text and (optionally) records the request it received. */
function fakeModel(reply: string, seen?: { request?: ChatCompletionRequest }): ChatModel {
  return {
    async complete(request) {
      if (seen) seen.request = request;
      return reply;
    },
  };
}

const byKey = (r: { slots: { key: string; value: string }[] }) =>
  Object.fromEntries(r.slots.map((s) => [s.key, s.value]));

describe("LlmSlotExtractionAdapter — bound mode", () => {
  it("returns the model's proposals for valid, in-scenario keys", async () => {
    const adapter = new LlmSlotExtractionAdapter(
      fakeModel(JSON.stringify({ slots: [{ key: "amount", value: "1500.00", confidence: 0.9 }] })),
    );
    const res = await adapter.extract({ utterance: "pay 1500", slots });
    expect(byKey(res).amount).toBe("1500.00");
  });

  it("drops proposals for keys not in the scenario (hallucination guard)", async () => {
    const adapter = new LlmSlotExtractionAdapter(
      fakeModel(
        JSON.stringify({
          slots: [
            { key: "amount", value: "1500.00", confidence: 0.9 },
            { key: "not_a_slot", value: "x", confidence: 0.9 },
          ],
        }),
      ),
    );
    const res = await adapter.extract({ utterance: "...", slots });
    expect(res.slots.map((s) => s.key)).toEqual(["amount"]);
  });

  it("clamps confidence into [0,1] and coerces non-string values to strings", async () => {
    const adapter = new LlmSlotExtractionAdapter(
      fakeModel(
        JSON.stringify({
          slots: [
            { key: "amount", value: 1500, confidence: 5 },
            { key: "currency", value: "BRL", confidence: -2 },
          ],
        }),
      ),
    );
    const res = await adapter.extract({ utterance: "...", slots });
    const amount = res.slots.find((s) => s.key === "amount")!;
    const currency = res.slots.find((s) => s.key === "currency")!;
    expect(amount.value).toBe("1500");
    expect(amount.confidence).toBe(1);
    expect(currency.confidence).toBe(0);
  });

  it("builds a schema that constrains slot keys to the scenario", async () => {
    const seen: { request?: ChatCompletionRequest } = {};
    const adapter = new LlmSlotExtractionAdapter(fakeModel(JSON.stringify({ slots: [] }), seen));
    await adapter.extract({ utterance: "x", slots });
    const schema = seen.request!.schema as any;
    expect(schema.properties.slots.items.properties.key.enum).toEqual(slots.map((s) => s.key));
  });
});

describe("LlmSlotExtractionAdapter — classify mode", () => {
  it("keeps a scenarioId that is a real catalog entry and filters its slots", async () => {
    const adapter = new LlmSlotExtractionAdapter(
      fakeModel(
        JSON.stringify({
          scenarioId: "register_payroll",
          slots: [{ key: "amount", value: "3000.00", confidence: 0.9 }],
        }),
      ),
    );
    const res = await adapter.extract({ utterance: "pay employees 3000", scenarios: catalog });
    expect(res.scenarioId).toBe("register_payroll");
    expect(byKey(res).amount).toBe("3000.00");
  });

  it("never trusts a scenarioId that is not in the catalog", async () => {
    const adapter = new LlmSlotExtractionAdapter(
      fakeModel(
        JSON.stringify({
          scenarioId: "not_a_scenario",
          slots: [{ key: "amount", value: "1500.00", confidence: 0.9 }],
        }),
      ),
    );
    const res = await adapter.extract({ utterance: "...", scenarios: catalog });
    expect(res.scenarioId).toBeUndefined();
    expect(res.slots).toHaveLength(0);
  });

  it("passes through a clarification when no scenario is chosen", async () => {
    const adapter = new LlmSlotExtractionAdapter(
      fakeModel(JSON.stringify({ clarification: "Which operation?", slots: [] })),
    );
    const res = await adapter.extract({ utterance: "a payment", scenarios: catalog });
    expect(res.scenarioId).toBeUndefined();
    expect(res.clarification).toBe("Which operation?");
  });
});

/** The same SlotExtractionPort contract asserted for the stub — the real adapter must also pass it. */
describe("SlotExtractionPort contract (LlmSlotExtractionAdapter)", () => {
  const knownKeys = new Set(slots.map((s) => s.key));

  it("never throws on malformed or empty model output", async () => {
    for (const reply of ["", "   ", "not json", "[1,2,3]", "null", '{"slots": "oops"}']) {
      const adapter = new LlmSlotExtractionAdapter(fakeModel(reply));
      const res = await adapter.extract({ utterance: "x", slots });
      expect(Array.isArray(res.slots)).toBe(true);
    }
  });

  it("proposes only known keys and confidences within [0,1]", async () => {
    const adapter = new LlmSlotExtractionAdapter(
      fakeModel(
        JSON.stringify({
          slots: [
            { key: "amount", value: "10", confidence: 0.4 },
            { key: "ghost", value: "x", confidence: 0.9 },
          ],
        }),
      ),
    );
    const res = await adapter.extract({ utterance: "x", slots });
    for (const p of res.slots) {
      expect(knownKeys.has(p.key)).toBe(true);
      expect(p.confidence).toBeGreaterThanOrEqual(0);
      expect(p.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("does not reject when the transport rejects — the error surfaces to the caller", async () => {
    const failing: ChatModel = {
      async complete() {
        throw new Error("model unavailable");
      },
    };
    const adapter = new LlmSlotExtractionAdapter(failing);
    // The adapter does not swallow transport errors; InterpretUtterance's safeExtract degrades instead.
    await expect(adapter.extract({ utterance: "x", slots })).rejects.toThrow(/unavailable/);
  });
});
