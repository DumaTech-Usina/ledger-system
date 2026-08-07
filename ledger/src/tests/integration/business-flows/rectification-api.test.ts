import { describe, it, expect } from "vitest";
import { InMemoryLedgerEventRepository } from "../../../infra/persistence/memory/InMemoryLedgerEventRepository";
import { NoOpAuditLogger } from "../../../infra/audit/NoOpAuditLogger";
import { StagingRecordValidator } from "../../../core/application/services/StagingRecordValidator";
import { CreateLedgerEventUseCase } from "../../../core/application/use-cases/CreateLedgerEventUseCase";
import { SubmitCandidateUseCase } from "../../../core/application/use-cases/SubmitCandidateUseCase";
import { PositionProjectionService } from "../../../core/application/services/PositionProjectionService";
import { SubmitCandidateInput } from "../../../core/application/dtos/SubmitCandidateInput";
import { serializePositionSummary } from "../../../presentation/web/api/serializers/positionSerializer";
import { EventType } from "../../../core/domain/enums/EventType";
import { EconomicEffect } from "../../../core/domain/enums/EconomicEffect";
import { PartyRole } from "../../../core/domain/enums/PartyRole";
import { Direction } from "../../../core/domain/enums/Direction";
import { ObjectType } from "../../../core/domain/enums/ObjectType";
import { Relation } from "../../../core/domain/enums/Relation";
import { ReasonType } from "../../../core/domain/enums/ReasonType";
import { ConfidenceLevel } from "../../../core/domain/enums/ConfidenceLevel";
import { ReporterType } from "../../../core/domain/enums/ReporterType";

/**
 * ETAPA 5 — the public surface.
 *
 * No new endpoint: a retraction is an event, and `POST /api/intents/submit` already carries every
 * field it needs. Inventing a second write path would have said the opposite — that a rectification
 * is something other than a fact.
 *
 * On the read side the contract grows by exactly two additive fields: `relatedEventId` on every
 * serialized event (without it a consumer sees that a retraction exists but not what it undoes) and
 * `retracted` on the events of a position (so no consumer has to re-derive the fold).
 */

const OBJ = "adv:api";

function build() {
  const ledgerRepo = new InMemoryLedgerEventRepository();
  const validator = new StagingRecordValidator(ledgerRepo);
  const createUseCase = new CreateLedgerEventUseCase(ledgerRepo, new NoOpAuditLogger());
  const submit = new SubmitCandidateUseCase(validator, createUseCase, ledgerRepo);
  const positions = new PositionProjectionService(ledgerRepo);
  return { ledgerRepo, submit, positions };
}

const reporter = { reporterType: ReporterType.USER, reporterId: "user-cfo", channel: "web" };

const advance = (): SubmitCandidateInput => ({
  sourceReference: "intent:adv-api",
  eventType: EventType.ADVANCE_PAYMENT,
  economicEffect: EconomicEffect.CASH_OUT,
  occurredAt: "2026-07-01T00:00:00.000Z",
  amount: "500.00",
  currency: "BRL",
  parties: [
    { partyId: "party-usina", role: PartyRole.PAYER, direction: Direction.OUT, amount: "500.00" },
    { partyId: "broker-1", role: PartyRole.PAYEE, direction: Direction.NEUTRAL },
  ],
  objects: [{ objectId: OBJ, objectType: ObjectType.ADVANCE, relation: Relation.ORIGINATES }],
  reason: { type: ReasonType.ADVANCE_PAYMENT, description: "Advance", confidence: ConfidenceLevel.HIGH, requiresFollowup: false },
  reporter,
});

const recovery = (ref: string, amount: string, originId: string): SubmitCandidateInput => ({
  sourceReference: ref,
  eventType: EventType.ADVANCE_SETTLEMENT,
  economicEffect: EconomicEffect.CASH_IN,
  occurredAt: "2026-07-09T00:00:00.000Z",
  amount,
  currency: "BRL",
  relatedEventId: originId,
  parties: [
    { partyId: "party-usina", role: PartyRole.PAYEE, direction: Direction.IN, amount },
    { partyId: "broker-1", role: PartyRole.PAYER, direction: Direction.NEUTRAL, amount },
  ],
  objects: [{ objectId: OBJ, objectType: ObjectType.ADVANCE, relation: Relation.SETTLES }],
  reason: { type: ReasonType.ADVANCE_PAYMENT, description: "Recovery", confidence: ConfidenceLevel.HIGH, requiresFollowup: false },
  reporter,
});

const retraction = (ref: string, targetId: string, amount = "250.00"): SubmitCandidateInput => ({
  sourceReference: ref,
  eventType: EventType.LEDGER_CORRECTION,
  economicEffect: EconomicEffect.NON_CASH,
  occurredAt: "2026-08-01T00:00:00.000Z",
  amount,
  currency: "BRL",
  relatedEventId: targetId,
  parties: [{ partyId: "party-usina", role: PartyRole.PLATFORM, direction: Direction.NEUTRAL }],
  objects: [{ objectId: OBJ, objectType: ObjectType.ADVANCE, relation: Relation.RETRACTS }],
  reason: {
    type: ReasonType.DATA_RECONCILIATION,
    description: "verified by accounting: this entry never happened",
    confidence: ConfidenceLevel.HIGH,
    requiresFollowup: false,
  },
  reporter,
});

const accepted = (o: { status: string; ledgerReference?: string }) => {
  expect(o.status).toBe("accepted");
  return (o as { ledgerReference: string }).ledgerReference;
};

describe("write — the existing submit endpoint carries a retraction unchanged", () => {
  it("the whole correction runs through POST /api/intents/submit", async () => {
    const { submit, positions } = build();

    const advanceId = accepted(await submit.execute(advance(), "intent:adv-api"));
    const wrongId = accepted(await submit.execute(recovery("intent:wrong", "250.00", advanceId), "intent:wrong"));
    accepted(await submit.execute(retraction("intent:fix", wrongId), "intent:fix"));
    accepted(await submit.execute(recovery("intent:right", "215.00", advanceId), "intent:right"));

    const summary = (await positions.summarize(OBJ))!;
    expect(summary.totalSettled.toString()).toBe("215.00");
    expect(summary.openBalance!.toString()).toBe("285.00");
  });

  it("submitting a retraction is idempotent on the source reference, like any other event", async () => {
    const { submit } = build();
    const advanceId = accepted(await submit.execute(advance(), "intent:adv-api"));
    const wrongId = accepted(await submit.execute(recovery("intent:wrong", "250.00", advanceId), "intent:wrong"));

    const first = accepted(await submit.execute(retraction("intent:fix", wrongId), "intent:fix"));
    const retry = accepted(await submit.execute(retraction("intent:fix", wrongId), "intent:fix"));
    expect(retry).toBe(first);
  });
});

describe("write — refusals reach the client as a contract it can branch on", () => {
  it("retracting an already-retracted event is terminal, not an escalation", async () => {
    const { submit } = build();
    const advanceId = accepted(await submit.execute(advance(), "intent:adv-api"));
    const wrongId = accepted(await submit.execute(recovery("intent:wrong", "250.00", advanceId), "intent:wrong"));
    accepted(await submit.execute(retraction("intent:fix", wrongId), "intent:fix"));

    const outcome = await submit.execute(retraction("intent:fix-again", wrongId), "intent:fix-again");
    expect(outcome.status).toBe("rejected");
    if (outcome.status !== "rejected") return;
    expect(outcome.rejections[0].category).toBe("duplicate");
  });

  it("a retraction with no target is reported as a lineage problem the client can re-ask", async () => {
    const { submit } = build();
    const advanceId = accepted(await submit.execute(advance(), "intent:adv-api"));
    await submit.execute(recovery("intent:wrong", "250.00", advanceId), "intent:wrong");

    const outcome = await submit.execute(
      { ...retraction("intent:no-target", advanceId), relatedEventId: null },
      "intent:no-target",
    );
    expect(outcome.status).toBe("rejected");
    if (outcome.status !== "rejected") return;
    expect(outcome.rejections[0].category).toBe("lineage");
    expect(outcome.rejections[0].field).toBe("relatedEventId");
  });

  it("a retraction pointing at nothing is reported as a missing origin", async () => {
    const { submit } = build();
    const advanceId = accepted(await submit.execute(advance(), "intent:adv-api"));
    await submit.execute(recovery("intent:wrong", "250.00", advanceId), "intent:wrong");

    const outcome = await submit.execute(
      retraction("intent:ghost", "00000000-0000-0000-0000-000000000000"),
      "intent:ghost",
    );
    expect(outcome.status).toBe("rejected");
    if (outcome.status !== "rejected") return;
    expect(outcome.rejections[0].code).toBe("ORIGIN_NOT_FOUND");
  });
});

describe("read — the public contract makes the correction legible", () => {
  it("a consumer can see which event a retraction undoes, and which events no longer stand", async () => {
    const { submit, positions } = build();
    const advanceId = accepted(await submit.execute(advance(), "intent:adv-api"));
    const wrongId = accepted(await submit.execute(recovery("intent:wrong", "250.00", advanceId), "intent:wrong"));
    accepted(await submit.execute(retraction("intent:fix", wrongId), "intent:fix"));
    accepted(await submit.execute(recovery("intent:right", "215.00", advanceId), "intent:right"));

    const payload = serializePositionSummary((await positions.summarize(OBJ))!);

    // Every event is still published: the history is not edited.
    expect(payload.events).toHaveLength(4);

    const wrong = payload.events.find((e) => e.id === wrongId)!;
    expect(wrong.amount).toBe("250.00");
    expect(wrong.retracted).toBe(true);

    const fix = payload.events.find((e) => e.eventType === EventType.LEDGER_CORRECTION)!;
    expect(fix.relatedEventId).toBe(wrongId);
    expect(fix.retracted).toBe(false);

    const right = payload.events.find((e) => e.amount === "215.00")!;
    expect(right.retracted).toBe(false);

    // And the figures published alongside them agree with what stands.
    expect(payload.totalSettled).toBe("215.00");
    expect(payload.openBalance).toBe("285.00");
  });

  it("the detail route names the kind of position, so it agrees with the listing about the same object", async () => {
    const { ledgerRepo, submit, positions } = build();
    accepted(await submit.execute(advance(), "intent:adv-api"));

    const detail = serializePositionSummary((await positions.summarize(OBJ))!);
    const { data } = await ledgerRepo.findPositionAggregates({ limit: 200 });
    const listed = positions.aggregateToListItem(data.find((a) => a.objectId === OBJ)!);

    expect(detail.objectType).toBe(ObjectType.ADVANCE);
    // Until this was published the two routes disagreed: the listing carried the type and the
    // detail did not, so a consumer opening a position by id had no way to know what it was.
    expect(detail.objectType).toBe(listed.objectType);
  });

  it("the settlement's causal origin is exposed too — relatedEventId is not retraction-only", async () => {
    const { submit, positions } = build();
    const advanceId = accepted(await submit.execute(advance(), "intent:adv-api"));
    accepted(await submit.execute(recovery("intent:right", "215.00", advanceId), "intent:right"));

    const payload = serializePositionSummary((await positions.summarize(OBJ))!);
    const settlement = payload.events.find((e) => e.eventType === EventType.ADVANCE_SETTLEMENT)!;
    expect(settlement.relatedEventId).toBe(advanceId);
  });
});
