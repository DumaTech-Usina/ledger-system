import { describe, it, expect } from "vitest";
import {
  CandidateMapper,
  continuityObjectType,
  continuitySlot,
  producibleTuples,
} from "../../../core/application/services/CandidateMapper";
import { ListPositionActionsUseCase } from "../../../core/application/use-cases/ListPositionActions";
import { getScenario } from "../../../core/domain/scenarios/Scenario";
import { Intent } from "../../../core/domain/entities/Intent";
import { IntentStatus } from "../../../core/domain/enums/IntentStatus";
import type { PositionLifecycle } from "../../../core/application/dtos/LedgerReadModels";
import type { PositionLifecyclePort } from "../../../core/application/ports/PositionLifecyclePort";
import { PARTY } from "../../fixtures/parties";
import { algebra } from "../../fixtures/algebra";

/**
 * SERVICE_FEE and TAX — the two obligations that could be opened and never closed.
 *
 * `OBLIGATION_RECOGNIZED` originates five cost categories, but only three had a settlement contract.
 * A recognized fee or tax therefore reached a state no action could move: the algebra admitted
 * `settles` on the object type, and no event type paired with it, so the intersection that builds
 * the action list (`producibleTuples() × algebra`) offered only "recognize" — the very thing that
 * had already happened.
 *
 * The fix is a Ledger one (two contracts) plus the treasury wiring that lets the interface produce
 * them. What is pinned here is the treasury half: that the tuples are producible, that they are the
 * ones the Ledger ratified, and that the resulting action reaches a position of each kind.
 *
 * The algebra fixture reads the Ledger's exported snapshot, so a contract removed on that side fails
 * these tests rather than silently narrowing the offer.
 */
const USINA = PARTY.USINA;

const CASES = [
  {
    scenarioId: "register_service_fee",
    eventType: "service_fee_payment",
    objectType: "service_fee",
    reasonType: "service_fee_payment",
  },
  {
    scenarioId: "register_tax",
    eventType: "tax_payment",
    objectType: "tax",
    reasonType: "tax_payment",
  },
] as const;

function build(scenarioId: string, intentId: string, answers: Record<string, string>) {
  const scenario = getScenario(scenarioId)!;
  const intent = Intent.rehydrate({
    id: intentId,
    scenarioId,
    userId: "cfo",
    status: IntentStatus.AWAITING_CONFIRMATION,
    answers,
    createdAt: "2026-08-17T00:00:00.000Z",
    updatedAt: "2026-08-17T00:00:00.000Z",
  });
  return new CandidateMapper(USINA).build(intent, scenario);
}

const answers = {
  payee: PARTY.ACME,
  amount: "12000.00",
  currency: "BRL",
  occurredAt: "2026-08-17",
};

const lifecycle = (objectId: string, objectType: string): PositionLifecycle => ({
  objectId,
  objectType,
  status: "open",
  outcome: "pending",
  currency: "BRL",
  totalOriginated: "12000.00",
  totalSettled: "0.00",
  openBalance: "12000.00",
  eventCount: 1,
  events: [],
  origin: null,
});

describe("service fee and tax — the scenarios exist and are registered", () => {
  for (const c of CASES) {
    it(`${c.scenarioId} is a known scenario that can carry a continuity assertion`, () => {
      const scenario = getScenario(c.scenarioId);
      expect(scenario).toBeDefined();
      expect(continuitySlot(c.scenarioId)).toBe("objectRef");
      expect(scenario!.slots.map((s) => s.key)).toContain("objectRef");
      expect(continuityObjectType(c.scenarioId)).toBe(c.objectType);
    });
  }
});

describe("service fee and tax — the emitted tuple is the one the Ledger ratified", () => {
  for (const c of CASES) {
    it(`${c.scenarioId} emits ${c.eventType} · ${c.objectType} · settles · cash_out`, () => {
      const candidate = build(c.scenarioId, "intent-1", answers);

      expect(candidate.eventType).toBe(c.eventType);
      expect(candidate.economicEffect).toBe("cash_out");
      expect(candidate.objects).toEqual([
        { objectId: "intent:intent-1", objectType: c.objectType, relation: "settles" },
      ]);
      // The category has to survive into the reason, not only into the position — that is the whole
      // argument for a dedicated event type over the generic outbound_payment.
      expect(candidate.reason.type).toBe(c.reasonType);
    });

    it(`${c.scenarioId} pays the obligation it is pointed at instead of minting a new position`, () => {
      const candidate = build(c.scenarioId, "intent-1", {
        ...answers,
        objectRef: `${c.objectType}:recognized-1`,
      });
      expect(candidate.objects[0].objectId).toBe(`${c.objectType}:recognized-1`);
    });

    it(`${c.scenarioId} still records the ordinary cash-basis payment when nothing is pointed at`, () => {
      // A fee paid with no prior recognition is an ordinary fact and must stay recordable.
      const candidate = build(c.scenarioId, "intent-1", answers);
      expect(candidate.objects[0].objectId).toBe("intent:intent-1");
    });

    it(`${c.scenarioId} carries the usina and the counterparty on a cash-out mold`, () => {
      const candidate = build(c.scenarioId, "intent-1", answers);
      expect(candidate.parties).toEqual([
        { partyId: USINA, role: "payer", direction: "out", amount: "12000.00" },
        { partyId: PARTY.ACME, role: "payee", direction: "neutral" },
      ]);
    });
  }
});

describe("service fee and tax — the position now offers a way to close", () => {
  for (const c of CASES) {
    it(`a ${c.objectType} position offers the settlement, not only the recognition`, async () => {
      const uc = new ListPositionActionsUseCase(
        { lifecycle: async () => lifecycle(`${c.objectType}:1`, c.objectType) } as unknown as PositionLifecyclePort,
        algebra(),
      );

      const result = (await uc.execute(`${c.objectType}:1`))!;
      const settling = result.actions.filter((a) => a.relation === "settles");

      expect(settling.map((a) => a.scenarioId)).toEqual([c.scenarioId]);
      // Something is outstanding, so closing it is the likely thing to do — it leads the list.
      expect(settling[0].likely).toBe(true);
      expect(result.actions[0].scenarioId).toBe(c.scenarioId);
    });

    it(`the ${c.eventType} tuple is admitted by the Ledger's own algebra`, () => {
      const tuple = producibleTuples().find((t) => t.scenarioId === c.scenarioId)!;
      const admissible = algebra().admissibleFor(c.objectType);

      expect(tuple).toMatchObject({ eventType: c.eventType, relation: "settles" });
      expect(admissible).toContainEqual({ eventType: c.eventType, relation: "settles" });
    });
  }

  it("paying one category never offers to pay the other", () => {
    // The categories are separate positions; the offer must not cross them.
    const feeTuples = producibleTuples().filter((t) => t.objectType === "service_fee");
    const taxTuples = producibleTuples().filter((t) => t.objectType === "tax");

    expect(feeTuples.map((t) => t.scenarioId).sort()).toEqual([
      "register_obligation_recognition",
      "register_service_fee",
    ]);
    expect(taxTuples.map((t) => t.scenarioId).sort()).toEqual([
      "register_obligation_recognition",
      "register_tax",
    ]);
  });
});
