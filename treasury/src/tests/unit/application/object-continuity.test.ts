import { describe, it, expect } from "vitest";
import { CandidateMapper } from "../../../core/application/services/CandidateMapper";
import { getScenario } from "../../../core/domain/scenarios/Scenario";
import { Intent } from "../../../core/domain/entities/Intent";
import { IntentStatus } from "../../../core/domain/enums/IntentStatus";

/**
 * MVA — economic object continuity. Validates ONE hypothesis: that Treasury can represent the same
 * economic object evolving across several events, instead of minting a new object per event.
 *
 * The strategy under test is reusing the `objectId` between related events. It is a probe, not a
 * settled architectural decision. Two axes must be shown to stay independent:
 *   - LINEAGE      (`relatedEventId`) — which fact caused this fact; validated by the Ledger;
 *   - CONTINUITY   (`objectId`)       — which position this fact moves; asserted by the producer.
 *
 * Scope: `register_advance_settlement` only. Everything else must keep minting, byte for byte.
 */
const USINA = "party-usina";

function build(scenarioId: string, intentId: string, answers: Record<string, string>) {
  const scenario = getScenario(scenarioId)!;
  const intent = Intent.rehydrate({
    id: intentId,
    scenarioId,
    userId: "cfo",
    status: IntentStatus.AWAITING_CONFIRMATION,
    answers,
    createdAt: "2026-07-09T00:00:00.000Z",
    updatedAt: "2026-07-09T00:00:00.000Z",
  });
  return new CandidateMapper(USINA).build(intent, scenario);
}

const settlementAnswers = { payer: "party-broker", amount: "250.00", currency: "BRL", occurredAt: "2026-07-09" };

describe("object continuity — absence keeps today's behaviour", () => {
  it("advance settlement WITHOUT a continuity answer mints the objectId exactly as today", () => {
    const c = build("register_advance_settlement", "intent-1", { ...settlementAnswers, origin: "evt-advance-1" });
    expect(c.objects).toEqual([{ objectId: "intent:intent-1", objectType: "advance", relation: "settles" }]);
  });

  it("a blank continuity answer mints as well — blank is not an assertion", () => {
    const c = build("register_advance_settlement", "intent-1", { ...settlementAnswers, origin: "evt-advance-1", objectRef: "   " });
    expect(c.objects[0].objectId).toBe("intent:intent-1");
  });

  it("a scenario that does not declare continuity ignores the answer entirely", () => {
    // commission_received is out of this MVA's scope: it must keep minting even if the key is present.
    const c = build("register_commission_received", "intent-1", {
      payer: "party-operator", amount: "1000.00", currency: "BRL", occurredAt: "2026-07-09",
      origin: "evt-expected-1", objectRef: "intent:intent-A",
    });
    expect(c.objects[0].objectId).toBe("intent:intent-1");
  });
});

describe("object continuity — one economic object across several events", () => {
  // The canonical sequence: an advance of 500 is disbursed, then recovered in two 250 instalments.
  const origination = build("register_advance", "intent-A", {
    payee: "party-broker", amount: "500.00", currency: "BRL", occurredAt: "2026-07-02",
  });
  const advanceObjectId = origination.objects[0].objectId;

  const first = build("register_advance_settlement", "intent-B", {
    ...settlementAnswers, origin: "evt-advance-1", objectRef: advanceObjectId,
  });
  const second = build("register_advance_settlement", "intent-C", {
    ...settlementAnswers, origin: "evt-advance-1", objectRef: advanceObjectId,
  });

  it("the same objectId appears in the origination and in both settlements", () => {
    expect(advanceObjectId).toBe("intent:intent-A");
    expect(first.objects[0].objectId).toBe(advanceObjectId);
    expect(second.objects[0].objectId).toBe(advanceObjectId);
  });

  it("the objects keep their own type and relation — only identity is shared", () => {
    expect(origination.objects[0]).toMatchObject({ objectType: "advance", relation: "originates" });
    expect(first.objects[0]).toMatchObject({ objectType: "advance", relation: "settles" });
    expect(second.objects[0]).toMatchObject({ objectType: "advance", relation: "settles" });
  });

  it("sourceReference stays independent of objectId — the events remain three distinct facts", () => {
    const references = [origination.sourceReference, first.sourceReference, second.sourceReference];
    expect(references).toEqual(["intent:intent-A", "intent:intent-B", "intent:intent-C"]);
    expect(new Set(references).size).toBe(3);
  });
});

describe("object continuity — continuity and lineage are independent axes", () => {
  it("continuity WITH lineage: both assertions are carried", () => {
    const c = build("register_advance_settlement", "intent-1", {
      ...settlementAnswers, origin: "evt-advance-1", objectRef: "intent:intent-A",
    });
    expect(c.objects[0].objectId).toBe("intent:intent-A");
    expect(c.relatedEventId).toBe("evt-advance-1");
  });

  it("continuity WITHOUT lineage: the position is known, the causing event is not", () => {
    const c = build("register_advance_settlement", "intent-1", { ...settlementAnswers, objectRef: "intent:intent-A" });
    expect(c.objects[0].objectId).toBe("intent:intent-A");
    expect(c.relatedEventId).toBeUndefined();
  });

  it("lineage WITHOUT continuity: the causing event is known, the position is not", () => {
    const c = build("register_advance_settlement", "intent-1", { ...settlementAnswers, origin: "evt-advance-1" });
    expect(c.objects[0].objectId).toBe("intent:intent-1");
    expect(c.relatedEventId).toBe("evt-advance-1");
  });

  it("neither: the current behaviour, unchanged", () => {
    const c = build("register_advance_settlement", "intent-1", settlementAnswers);
    expect(c.objects[0].objectId).toBe("intent:intent-1");
    expect(c.relatedEventId).toBeUndefined();
  });
});
