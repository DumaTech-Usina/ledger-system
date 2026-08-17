import { describe, it, expect } from "vitest";
import { CandidateMapper, continuityObjectType, continuitySlot } from "../../../core/application/services/CandidateMapper";
import { ListSettlementCandidatesUseCase } from "../../../core/application/use-cases/ListSettlementCandidates";
import { StartPositionActionUseCase } from "../../../core/application/use-cases/StartPositionAction";
import { StartIntentUseCase } from "../../../core/application/use-cases/StartIntent";
import { ApplyAnswersUseCase } from "../../../core/application/use-cases/ApplyAnswers";
import { getScenario } from "../../../core/domain/scenarios/Scenario";
import { Intent } from "../../../core/domain/entities/Intent";
import { IntentStatus } from "../../../core/domain/enums/IntentStatus";
import { InMemoryIntentRepository } from "../../../infra/persistence/InMemoryIntentRepository";
import { InMemoryAuditLog } from "../../../infra/audit/InMemoryAuditLog";
import type { Clock } from "../../../core/application/ports/Clock";
import type { IdGenerator } from "../../../core/application/ports/IdGenerator";
import type { IntentRepository } from "../../../core/application/repositories/IntentRepository";
import type { PositionCandidate, PositionLookupPort } from "../../../core/application/ports/PositionLookupPort";
import type { PositionLifecycle } from "../../../core/application/dtos/LedgerReadModels";
import type { PositionLifecyclePort } from "../../../core/application/ports/PositionLifecyclePort";
import type { LedgerEventLookupPort } from "../../../core/application/ports/LedgerEventLookupPort";
import { PARTY, partyDirectory } from "../../fixtures/parties";

/**
 * Regression — a repayment and a commission receipt must MOVE the position they close.
 *
 * Both scenarios settle an object type treasury itself can originate (a LOAN_ORIGINATION, a
 * COMMISSION_EXPECTED), so "which position does this close?" is a question with a real answer. They
 * were nevertheless the only two settlements in the catalogue that could not carry it: the mapping
 * declared no `objectIdSlot` and the scenario declared no slot to hold one.
 *
 * The failure was silent, and that is what made it expensive. Nothing rejected the answer — the id
 * was simply dropped, `build` minted `intent:<id>` as if the position had never existed, and the
 * book gained a second position settled against an origination of zero while the real loan stayed
 * open at its full value. LOAN is in USINA_RECEIVABLE_OBJECT_TYPES, so that overstates
 * `openExposure` by the whole amount already repaid.
 *
 * Continuity is asserted here, never verified — the Ledger does not validate that axis (premise 7),
 * and these tests must not start pretending it does. What they fix is that the assertion SURVIVES
 * the trip from the position to the candidate, on the same three layers `register_advance_settlement`
 * already goes through: the mapper that mints the id, the conversation that can hold the answer, and
 * the two read paths that supply it.
 */
const USINA = PARTY.USINA;
const clock: Clock = { now: () => "2026-08-17T00:00:00.000Z" };

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

const repaymentAnswers = {
  payer: PARTY.BROKER,
  amount: "250.00",
  currency: "BRL",
  occurredAt: "2026-08-17",
};

const commissionAnswers = {
  payer: PARTY.OPERATOR,
  amount: "1000.00",
  currency: "BRL",
  occurredAt: "2026-08-17",
};

/** The two scenarios this regression is about, with what each needs to reach `build`. */
const CASES = [
  {
    scenarioId: "register_loan_repayment",
    objectType: "loan",
    originationScenario: "register_loan",
    originationAnswers: { payee: PARTY.BROKER, amount: "500.00", currency: "BRL", occurredAt: "2026-08-01" },
    answers: repaymentAnswers,
    origin: "evt-loan-1",
  },
  {
    scenarioId: "register_commission_received",
    objectType: "commission_receivable",
    originationScenario: "register_commission_accrual",
    originationAnswers: { amount: "1000.00", currency: "BRL", occurredAt: "2026-08-01" },
    answers: commissionAnswers,
    origin: "evt-expected-1",
  },
] as const;

describe("settlement continuity — the mapper carries the asserted position", () => {
  for (const c of CASES) {
    it(`${c.scenarioId} settles the position the answer names, instead of minting a new one`, () => {
      const candidate = build(c.scenarioId, "intent-settlement", {
        ...c.answers,
        origin: c.origin,
        objectRef: `intent:${c.objectType}-position`,
      });

      expect(candidate.objects).toEqual([
        {
          objectId: `intent:${c.objectType}-position`,
          objectType: c.objectType,
          relation: "settles",
        },
      ]);
    });

    it(`${c.scenarioId} and its origination name the same objectId — one position, two facts`, () => {
      // The whole point of continuity: the settlement has to land on the position the origination
      // opened. Two ids mean two positions, and the original one never closes.
      const origination = build(c.originationScenario, "intent-origin", { ...c.originationAnswers });
      const positionId = origination.objects[0].objectId;

      const settlement = build(c.scenarioId, "intent-settlement", {
        ...c.answers,
        origin: c.origin,
        objectRef: positionId,
      });

      expect(positionId).toBe("intent:intent-origin");
      expect(settlement.objects[0].objectId).toBe(positionId);
      expect(origination.objects[0].relation).toBe("originates");
      expect(settlement.objects[0].relation).toBe("settles");
      // The facts stay distinct: only the position identity is shared.
      expect(settlement.sourceReference).not.toBe(origination.sourceReference);
    });

    it(`${c.scenarioId} keeps minting when nothing is asserted — absence is not an assertion`, () => {
      const candidate = build(c.scenarioId, "intent-settlement", { ...c.answers, origin: c.origin });
      expect(candidate.objects[0].objectId).toBe("intent:intent-settlement");
    });

    it(`${c.scenarioId} keeps minting on a blank answer — blank is not an assertion either`, () => {
      const candidate = build(c.scenarioId, "intent-settlement", {
        ...c.answers,
        origin: c.origin,
        objectRef: "   ",
      });
      expect(candidate.objects[0].objectId).toBe("intent:intent-settlement");
    });

    it(`${c.scenarioId} keeps continuity and lineage as independent axes`, () => {
      // Which position this moves, and which fact caused it, are different assertions. Carrying one
      // must never imply or overwrite the other.
      const both = build(c.scenarioId, "intent-1", {
        ...c.answers,
        origin: c.origin,
        objectRef: "intent:position-1",
      });
      expect(both.objects[0].objectId).toBe("intent:position-1");
      expect(both.relatedEventId).toBe(c.origin);

      const continuityOnly = build(c.scenarioId, "intent-2", {
        ...c.answers,
        objectRef: "intent:position-1",
      });
      expect(continuityOnly.objects[0].objectId).toBe("intent:position-1");
      expect(continuityOnly.relatedEventId).toBeUndefined();
    });
  }

  it("commission received still records an explicit orphan when the origin is unknown", () => {
    // Continuity must not quietly stand in for lineage: a known position with an unknown origin is
    // still an orphan, and the reason has to keep saying so.
    const candidate = build("register_commission_received", "intent-1", {
      ...commissionAnswers,
      objectRef: "intent:commission-position",
    });

    expect(candidate.objects[0].objectId).toBe("intent:commission-position");
    expect(candidate.reason.type).toBe("unknown_origin");
    expect(candidate.reason.requiresFollowup).toBe(true);
  });
});

describe("settlement continuity — the conversation can hold the answer", () => {
  for (const c of CASES) {
    it(`${c.scenarioId} declares the slot its mapping reads`, () => {
      // A mapping that names a slot the scenario does not declare is not a half-fix: the answer is
      // rejected as an unknown slot, and StartPositionAction turns that rejection into a thrown
      // error. The two declarations have to agree.
      const slot = continuitySlot(c.scenarioId)!;
      expect(slot).toBe("objectRef");
      expect(getScenario(c.scenarioId)!.slots.map((s) => s.key)).toContain(slot);
    });

    it(`${c.scenarioId} accepts a continuity answer instead of rejecting it`, async () => {
      const intents = new InMemoryIntentRepository();
      const audit = new InMemoryAuditLog();
      let n = 0;
      const ids: IdGenerator = { next: () => `int-${++n}` };

      const { intentId } = await new StartIntentUseCase(intents, clock, ids, audit).execute({
        scenarioId: c.scenarioId,
        userId: "cfo",
      });

      const result = await new ApplyAnswersUseCase(intents, clock, audit, partyDirectory()).execute({
        intentId,
        answers: [{ key: "objectRef", value: "intent:position-1" }],
      });

      expect(result.rejected).toEqual([]);
      expect((await intents.findById(intentId))!.answers.objectRef).toBe("intent:position-1");
    });

    it(`${c.scenarioId} does not force the operator to know the position`, () => {
      // Continuity is an offer, never a gate: a settlement whose position is unknown is an ordinary
      // fact and must stay recordable (premise 5).
      const slot = getScenario(c.scenarioId)!.slots.find((s) => s.key === "objectRef")!;
      expect(slot.required).toBe(false);
    });
  }
});

describe("settlement continuity — the read paths supply the position", () => {
  const lifecycle = (objectId: string, objectType: string, originEventType: string): PositionLifecycle => ({
    objectId,
    objectType,
    status: "open",
    outcome: "pending",
    currency: "BRL",
    totalOriginated: "500.00",
    totalSettled: "0.00",
    openBalance: "500.00",
    eventCount: 1,
    events: [
      {
        eventId: "evt-origin",
        eventType: originEventType,
        economicEffect: originEventType === "loan_origination" ? "cash_out" : "non_cash",
        relation: "originates",
        amount: "500.00",
        currency: "BRL",
        occurredAt: "2026-08-01T00:00:00.000Z",
        recordedAt: "2026-08-01T00:00:00.000Z",
        description: null,
        relatedEventId: null,
        retracted: false,
        requiresFollowup: false,
        objects: [{ objectId, objectType, relation: "originates" }],
        source: { system: "treasury", reference: objectId },
        parties: [
          { partyId: PARTY.USINA, role: "payer", direction: "out", amount: "500.00" },
          { partyId: PARTY.BROKER, role: "payee", direction: "neutral", amount: null },
        ],
      },
    ],
    origin: null,
  });

  function wire(position: PositionLifecycle) {
    const intents = new InMemoryIntentRepository();
    const audit = new InMemoryAuditLog();
    let n = 0;
    const ids: IdGenerator = { next: () => `pa-${++n}` };

    const events: LedgerEventLookupPort = {
      event: async (eventId) =>
        eventId === "evt-origin"
          ? {
              eventId,
              eventType: "loan_origination",
              economicEffect: "cash_out",
              amount: "500.00",
              currency: "BRL",
              occurredAt: "2026-08-01T00:00:00.000Z",
              description: null,
              relatedEventId: null,
              objects: position.events[0].objects,
              parties: [
                { partyId: PARTY.USINA, role: "payer", direction: "out", amount: "500.00" },
                { partyId: PARTY.BROKER, role: "payee", direction: "neutral", amount: null },
              ],
              source: { system: "treasury", reference: position.objectId },
            }
          : null,
    };

    return {
      intents,
      uc: new StartPositionActionUseCase(
        { lifecycle: async () => position } as unknown as PositionLifecyclePort,
        events,
        new StartIntentUseCase(intents, clock, ids, audit),
        new ApplyAnswersUseCase(intents, clock, audit, partyDirectory()),
        PARTY.USINA,
      ),
    };
  }

  it("starting a repayment from the loan carries the position over", async () => {
    const { uc, intents } = wire(lifecycle("intent:loan-1", "loan", "loan_origination"));

    const result = await uc.execute({
      objectId: "intent:loan-1",
      scenarioId: "register_loan_repayment",
      userId: "cfo",
    });

    const intent = (await intents.findById(result.intentId))!;
    expect(intent.answers.objectRef).toBe("intent:loan-1");
    expect(intent.answers.origin).toBe("evt-origin");
    expect(result.prefilled).toContain("objectRef");
  });

  it("starting a commission receipt from the receivable carries the position over", async () => {
    const { uc, intents } = wire(
      lifecycle("intent:commission-1", "commission_receivable", "commission_expected"),
    );

    const result = await uc.execute({
      objectId: "intent:commission-1",
      scenarioId: "register_commission_received",
      userId: "cfo",
    });

    const intent = (await intents.findById(result.intentId))!;
    expect(intent.answers.objectRef).toBe("intent:commission-1");
    expect(result.prefilled).toContain("objectRef");
  });

  for (const c of CASES) {
    it(`${c.scenarioId} is offered the open positions it could close`, async () => {
      const position: PositionCandidate = {
        objectId: `intent:${c.objectType}-1`,
        objectType: c.objectType,
        originEventId: "evt-origin-1",
        counterpartyId: PARTY.BROKER,
        totalOriginated: "500.00",
        openBalance: "500.00",
        currency: "BRL",
        originatedAt: "2026-08-01T00:00:00.000Z",
      };

      const intents = {
        findById: async () =>
          Intent.rehydrate({
            id: "intent-1",
            scenarioId: c.scenarioId,
            userId: "cfo",
            status: IntentStatus.GATHERING,
            answers: {},
            createdAt: "2026-08-17T00:00:00.000Z",
            updatedAt: "2026-08-17T00:00:00.000Z",
          }),
      } as unknown as IntentRepository;

      const lookup: PositionLookupPort = {
        openPositions: async () => [position],
        unoriginatedPositions: async () => [],
      };

      const { slots, candidates } = await new ListSettlementCandidatesUseCase(
        intents,
        lookup,
        partyDirectory(),
      ).execute("intent-1");

      expect(continuityObjectType(c.scenarioId)).toBe(c.objectType);
      expect(slots.continuity).toBe("objectRef");
      expect(candidates.map((p) => p.objectId)).toEqual([`intent:${c.objectType}-1`]);
    });
  }
});
