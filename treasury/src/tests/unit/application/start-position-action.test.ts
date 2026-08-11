import { describe, it, expect } from "vitest";
import { StartPositionActionUseCase } from "../../../core/application/use-cases/StartPositionAction";
import { StartIntentUseCase } from "../../../core/application/use-cases/StartIntent";
import { ApplyAnswersUseCase } from "../../../core/application/use-cases/ApplyAnswers";
import { InMemoryIntentRepository } from "../../../infra/persistence/InMemoryIntentRepository";
import { InMemoryAuditLog } from "../../../infra/audit/InMemoryAuditLog";
import type { Clock } from "../../../core/application/ports/Clock";
import type { IdGenerator } from "../../../core/application/ports/IdGenerator";
import type { PositionLifecycle } from "../../../core/application/dtos/LedgerReadModels";
import type { PositionLifecyclePort } from "../../../core/application/ports/PositionLifecyclePort";
import type { LedgerEventLookupPort } from "../../../core/application/ports/LedgerEventLookupPort";
import { PARTY, partyDirectory } from "../../fixtures/parties";

/**
 * Opening a conversation from a position.
 *
 * What matters is not that fewer questions are asked — it is WHICH ones stop being asked. Continuity
 * and lineage are answers the position holds and the operator would have to look up; the
 * counterparty is only carried when the economics make it necessarily the same party, because
 * carrying it otherwise produces a record that is valid and false.
 */
const clock: Clock = { now: () => "2026-08-06T00:00:00.000Z" };

const lifecycle = (over: Partial<PositionLifecycle> = {}): PositionLifecycle => ({
  objectId: "intent:adv-1",
  objectType: "advance",
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
      eventType: "advance_payment",
      economicEffect: "cash_out",
      relation: "originates",
      amount: "500.00",
      currency: "BRL",
      occurredAt: "2026-07-01T00:00:00.000Z",
      recordedAt: "2026-07-01T00:00:00.000Z",
      description: null,
      relatedEventId: null,
      retracted: false,
      requiresFollowup: false,
      objects: [{ objectId: "intent:adv-1", objectType: "advance", relation: "originates" }],
      source: { system: "treasury", reference: "intent:adv-1" },
      parties: [
        { partyId: "party-usina", role: "payer", direction: "out", amount: "500.00" },
        { partyId: "party-broker", role: "payee", direction: "neutral", amount: null },
      ],
    },
  ],
  origin: {
    eventId: "evt-origin",
    eventType: "advance_payment",
    occurredAt: "2026-07-01T00:00:00.000Z",
    source: { system: "treasury", reference: "intent:adv-1" },
    relatedObjects: [],
    parties: [
      { partyId: "party-usina", role: "payer", direction: "out", amount: "500.00" },
      { partyId: "party-broker", role: "payee", direction: "neutral", amount: null },
    ],
  },
  ...over,
});

function wire(position: PositionLifecycle | null) {
  const intents = new InMemoryIntentRepository();
  const audit = new InMemoryAuditLog();
  let n = 0;
  const ids: IdGenerator = { next: () => `pa-${++n}` };
  const directory = partyDirectory();

  const events: LedgerEventLookupPort = {
    event: async (eventId) =>
      eventId === "evt-origin"
        ? {
            eventId,
            eventType: "advance_payment",
            economicEffect: "cash_out",
            amount: "500.00",
            currency: "BRL",
            occurredAt: "2026-07-01T00:00:00.000Z",
            description: null,
            relatedEventId: null,
            objects: [{ objectId: "intent:adv-1", objectType: "advance", relation: "originates" }],
            parties: [
              { partyId: PARTY.USINA, role: "payer", direction: "out", amount: "500.00" },
              { partyId: PARTY.BROKER, role: "payee", direction: "neutral", amount: null },
            ],
            source: { system: "integration", reference: "intent:adv-1" },
          }
        : null,
  };

  return {
    intents,
    uc: new StartPositionActionUseCase(
      { lifecycle: async () => position } as unknown as PositionLifecyclePort,
      events,
      new StartIntentUseCase(intents, clock, ids, audit),
      new ApplyAnswersUseCase(intents, clock, audit, directory),
      PARTY.USINA,
    ),
  };
}

describe("StartPositionAction", () => {
  it("answers what the position knows, and leaves the rest to the operator", async () => {
    const { uc, intents } = wire(lifecycle());

    const result = await uc.execute({
      objectId: "intent:adv-1",
      scenarioId: "register_advance_settlement",
      userId: "cfo",
    });

    const intent = (await intents.findById(result.intentId))!;
    expect(intent.answers.objectRef).toBe("intent:adv-1"); // continuity
    expect(intent.answers.origin).toBe("evt-origin"); // lineage
    expect(intent.answers.currency).toBe("BRL");
    // The party settling an advance is the one that received it — carried over, not retyped.
    expect(intent.answers.payer).toBe(PARTY.BROKER);

    // What is left is what only the operator knows.
    expect(result.state.kind).toBe("question");
    expect(intent.answers.amount).toBeUndefined();
    expect(intent.answers.occurredAt).toBeUndefined();
  });

  it("does NOT carry the counterparty where it is not necessarily the same party", async () => {
    // A commission received from an operator is later split — to a partner, to people, to fees.
    // Those are different counterparties, so the question has to be asked.
    const commission = lifecycle({
      objectId: "intent:com-1",
      objectType: "commission_receivable",
      events: [],
    });
    const { uc, intents } = wire(commission);

    const result = await uc.execute({
      objectId: "intent:com-1",
      scenarioId: "register_commission_received",
      userId: "cfo",
    });

    const intent = (await intents.findById(result.intentId))!;
    expect(intent.answers.payer).toBeUndefined();
  });

  it("never points lineage at an origination a correction withdrew", async () => {
    const corrected = lifecycle({
      events: [{ ...lifecycle().events[0], retracted: true }],
    });
    const { uc, intents } = wire(corrected);

    const result = await uc.execute({
      objectId: "intent:adv-1",
      scenarioId: "register_advance_settlement",
      userId: "cfo",
    });

    const intent = (await intents.findById(result.intentId))!;
    // Reviving a fact the book withdrew would be worse than asking.
    expect(intent.answers.origin).toBeUndefined();
    expect(intent.answers.payer).toBeUndefined();
    // Continuity still holds: the position exists regardless of what was retracted on it.
    expect(intent.answers.objectRef).toBe("intent:adv-1");
  });

  it("carries the branch chosen with the action instead of asking it again", async () => {
    const payroll = lifecycle({ objectId: "payroll:1", objectType: "payroll", events: [] });
    const { uc, intents } = wire(payroll);

    const result = await uc.execute({
      objectId: "payroll:1",
      scenarioId: "register_obligation_recognition",
      variantChoice: "payroll",
      userId: "cfo",
    });

    const intent = (await intents.findById(result.intentId))!;
    expect(intent.answers.kind).toBe("payroll");
    expect(intent.answers.objectRef).toBe("payroll:1");
  });

  it("reports which answers the position supplied, so the interface can show what it knows", async () => {
    const { uc } = wire(lifecycle());
    const result = await uc.execute({
      objectId: "intent:adv-1",
      scenarioId: "register_advance_settlement",
      userId: "cfo",
    });

    expect(result.prefilled.sort()).toEqual(["currency", "objectRef", "origin", "payer"]);
  });

  it("refuses to open an operation over a position the Ledger does not know", async () => {
    const { uc } = wire(null);
    await expect(
      uc.execute({ objectId: "ghost", scenarioId: "register_advance_settlement", userId: "cfo" }),
    ).rejects.toThrow(/Unknown position/i);
  });
});
