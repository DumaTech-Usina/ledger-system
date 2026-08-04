import { describe, it, expect } from "vitest";
import { listScenarios, getScenario } from "../../../core/domain/scenarios/Scenario";
import { CandidateMapper } from "../../../core/application/services/CandidateMapper";
import { Intent } from "../../../core/domain/entities/Intent";
import { IntentStatus } from "../../../core/domain/enums/IntentStatus";
import { SlotType } from "../../../core/domain/enums/SlotType";
import { PARTY } from "../../fixtures/parties";

/**
 * Guards the one rule that ties this service to a Ledger invariant it cannot see.
 *
 * The Ledger admits a settlement with no `relatedEventId` ONLY when the event declares its lineage
 * unresolved — reason UNKNOWN_ORIGIN with requiresFollowup = true (InvariantPolicy step 10,
 * `ledger/src/core/domain/policies/InvariantPolicy.ts:192-201`), and only for an event type whose
 * contract lists that reason (`EventContract`: COMMISSION_RECEIVED is the only one).
 *
 * So a scenario carrying a lineage slot has exactly two legal shapes: the slot is required, or the
 * mapping declares an orphan. Any third shape produces a candidate the Ledger rejects — and the
 * Treasury has no way to learn that until a submission fails in production. Today the rule is held
 * by a comment in CandidateMapper; this test holds it for real.
 */

/** Answers rich enough for any scenario's mapping, minus the lineage slot under test. */
function answersFor(scenarioId: string): Record<string, string> {
  const scenario = getScenario(scenarioId)!;
  const answers: Record<string, string> = {};
  for (const slot of scenario.slots) {
    if (slot.type === SlotType.EVENT_REF) continue; // deliberately left blank
    answers[slot.key] =
      slot.type === SlotType.MONEY ? "1000.00"
      : slot.type === SlotType.DATE ? "2026-08-03"
      : slot.type === SlotType.CHOICE ? (slot.choices?.[0] ?? "")
      : slot.type === SlotType.PARTY ? PARTY.BROKER
      : "x";
  }
  return answers;
}

function buildWithoutLineage(scenarioId: string) {
  const scenario = getScenario(scenarioId)!;
  const intent = Intent.rehydrate({
    id: "intent-1",
    scenarioId,
    userId: "cfo",
    status: IntentStatus.AWAITING_CONFIRMATION,
    answers: answersFor(scenarioId),
    createdAt: "2026-08-03T00:00:00.000Z",
    updatedAt: "2026-08-03T00:00:00.000Z",
  });
  return new CandidateMapper(PARTY.USINA).build(intent, scenario);
}

const lineageScenarios = listScenarios().filter((s) =>
  s.slots.some((slot) => slot.type === SlotType.EVENT_REF),
);

describe("lineage slots match the Ledger's orphan rule", () => {
  it("there is at least one scenario to check", () => {
    expect(lineageScenarios.length).toBeGreaterThan(0);
  });

  it.each(lineageScenarios.map((s) => [s.id] as const))(
    "%s: either the lineage slot is required, or the candidate declares an explicit orphan",
    (scenarioId) => {
      const slot = getScenario(scenarioId)!.slots.find((s) => s.type === SlotType.EVENT_REF)!;
      if (slot.required) return; // the dialog will not let it through blank

      const candidate = buildWithoutLineage(scenarioId);
      expect(candidate.relatedEventId).toBeUndefined();
      expect(candidate.reason.type).toBe("unknown_origin");
      expect(candidate.reason.requiresFollowup).toBe(true);
    },
  );
});

describe("unknown_origin is emitted only where the Ledger contract admits it", () => {
  // EventContract lists ReasonType.UNKNOWN_ORIGIN for COMMISSION_RECEIVED and nothing else.
  const ADMITTED_EVENT_TYPES = ["commission_received"];

  it.each(lineageScenarios.map((s) => [s.id] as const))(
    "%s never claims unresolved lineage for an event type that forbids it",
    (scenarioId) => {
      const slot = getScenario(scenarioId)!.slots.find((s) => s.type === SlotType.EVENT_REF)!;
      if (slot.required) return;

      const candidate = buildWithoutLineage(scenarioId);
      if (candidate.reason.type === "unknown_origin") {
        expect(ADMITTED_EVENT_TYPES).toContain(candidate.eventType);
      }
    },
  );

  it("a filled lineage slot never produces unknown_origin", () => {
    const scenario = getScenario("register_commission_received")!;
    const intent = Intent.rehydrate({
      id: "intent-1",
      scenarioId: scenario.id,
      userId: "cfo",
      status: IntentStatus.AWAITING_CONFIRMATION,
      answers: { ...answersFor(scenario.id), origin: "evt-expected-1" },
      createdAt: "2026-08-03T00:00:00.000Z",
      updatedAt: "2026-08-03T00:00:00.000Z",
    });

    const candidate = new CandidateMapper(PARTY.USINA).build(intent, scenario);
    expect(candidate.relatedEventId).toBe("evt-expected-1");
    expect(candidate.reason.type).not.toBe("unknown_origin");
  });
});

describe("the identity marker does not claim unresolved lineage", () => {
  it("an unidentified counterparty never sets reason.type to unknown_origin on its own", () => {
    const scenario = getScenario("register_commission_received")!;
    const intent = Intent.rehydrate({
      id: "intent-1",
      scenarioId: scenario.id,
      userId: "cfo",
      status: IntentStatus.AWAITING_CONFIRMATION,
      answers: { ...answersFor(scenario.id), origin: "evt-expected-1" },
      createdAt: "2026-08-03T00:00:00.000Z",
      updatedAt: "2026-08-03T00:00:00.000Z",
    });

    // The payer is unidentified, but the lineage is known — the two gaps stay separate.
    const candidate = new CandidateMapper(PARTY.USINA).build(
      intent,
      scenario,
      new Set([PARTY.BROKER]),
    );

    expect(candidate.reason.type).not.toBe("unknown_origin");
    expect(candidate.reason.requiresFollowup).toBe(true);
  });
});
