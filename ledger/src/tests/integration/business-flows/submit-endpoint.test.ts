import { describe, it, expect } from "vitest";
import { InMemoryLedgerEventRepository } from "../../../infra/persistence/memory/InMemoryLedgerEventRepository";
import { NoOpAuditLogger } from "../../../infra/audit/NoOpAuditLogger";
import { StagingRecordValidator } from "../../../core/application/services/StagingRecordValidator";
import { CreateLedgerEventUseCase } from "../../../core/application/use-cases/CreateLedgerEventUseCase";
import { SubmitCandidateUseCase } from "../../../core/application/use-cases/SubmitCandidateUseCase";
import { SubmitCandidateInput } from "../../../core/application/dtos/SubmitCandidateInput";
import { EventType } from "../../../core/domain/enums/EventType";
import { EconomicEffect } from "../../../core/domain/enums/EconomicEffect";
import { PartyRole } from "../../../core/domain/enums/PartyRole";
import { Direction } from "../../../core/domain/enums/Direction";
import { ObjectType } from "../../../core/domain/enums/ObjectType";
import { Relation } from "../../../core/domain/enums/Relation";
import { ReasonType } from "../../../core/domain/enums/ReasonType";
import { ConfidenceLevel } from "../../../core/domain/enums/ConfidenceLevel";
import { ReporterType } from "../../../core/domain/enums/ReporterType";

function build() {
  const ledgerRepo = new InMemoryLedgerEventRepository();
  const validator = new StagingRecordValidator(ledgerRepo);
  const createUseCase = new CreateLedgerEventUseCase(ledgerRepo, new NoOpAuditLogger());
  const submit = new SubmitCandidateUseCase(validator, createUseCase, ledgerRepo);
  return { ledgerRepo, submit };
}

// A valid candidate modeled on the Advance flow (a known-good tuple the invariants accept).
function validCandidate(over: Partial<SubmitCandidateInput> = {}): SubmitCandidateInput {
  return {
    sourceReference: "intent:adv-1",
    eventType: EventType.ADVANCE_PAYMENT,
    economicEffect: EconomicEffect.CASH_OUT,
    occurredAt: "2026-07-09T00:00:00.000Z",
    amount: "500.00",
    currency: "BRL",
    description: "Advance on future commission",
    parties: [
      { partyId: "party-usina", role: PartyRole.PAYER, direction: Direction.OUT, amount: "500.00" },
      { partyId: "broker-1", role: PartyRole.PAYEE, direction: Direction.NEUTRAL },
    ],
    objects: [{ objectId: "adv-1", objectType: ObjectType.ADVANCE, relation: Relation.ORIGINATES }],
    reason: { type: ReasonType.ADVANCE_PAYMENT, description: "Advance", confidence: ConfidenceLevel.HIGH, requiresFollowup: false },
    reporter: { reporterType: ReporterType.USER, reporterId: "user-cfo", channel: "web" },
    ...over,
  };
}

describe("SubmitCandidateUseCase (User App submit endpoint)", () => {
  it("accepts a valid candidate and posts a ledger event", async () => {
    const { ledgerRepo, submit } = build();
    const outcome = await submit.execute(validCandidate(), "intent:adv-1");
    expect(outcome.status).toBe("accepted");
    if (outcome.status === "accepted") expect(outcome.ledgerReference).toBeTruthy();
    expect(await ledgerRepo.existsBySourceReference("intent:adv-1")).toBe(true);
  });

  it("rejects a candidate with an unknown event type (Ledger gate does its job)", async () => {
    const { submit } = build();
    const outcome = await submit.execute(validCandidate({ eventType: "charge_created", sourceReference: "intent:bad" }), "intent:bad");
    expect(outcome.status).toBe("rejected");
    if (outcome.status === "rejected") {
      expect(outcome.reason).toMatch(/eventType|invalid/i);
      // A malformed tuple is not the user's fault → internal, never exposed as an input question.
      expect(outcome.rejections[0]).toMatchObject({ code: "TUPLE_INVALID", category: "internal" });
    }
  });

  it("surfaces a duplicate as a structured, terminal rejection", async () => {
    const { submit } = build();
    // First submit records the source reference; a second with the SAME reference but a different
    // idempotency key is caught by the validator as a duplicate (not the idempotent retry path).
    await submit.execute(validCandidate({ sourceReference: "intent:dup" }), "key-1");
    const outcome = await submit.execute(validCandidate({ sourceReference: "intent:dup" }), "key-2");
    expect(outcome.status).toBe("rejected");
    if (outcome.status === "rejected") {
      expect(outcome.rejections[0]).toMatchObject({ code: "DUPLICATE", category: "duplicate" });
    }
  });

  it("surfaces a zero amount as a structured input rejection pointing at the amount", async () => {
    const { submit } = build();
    const outcome = await submit.execute(validCandidate({ amount: "0.00", sourceReference: "intent:zero" }), "intent:zero");
    expect(outcome.status).toBe("rejected");
    if (outcome.status === "rejected") {
      expect(outcome.rejections[0]).toMatchObject({ code: "AMOUNT_INVALID", category: "input", field: "amount" });
    }
  });

  // The exact NON_CASH candidate shapes Treasury's CandidateMapper produces (Phase 5): a single
  // BENEFICIARY party carrying no amount, the event amount non-zero. Proves the Ledger accepts them.
  function nonCashCandidate(over: Partial<SubmitCandidateInput>): SubmitCandidateInput {
    return {
      sourceReference: "intent:nc",
      eventType: EventType.COMMISSION_WAIVER,
      economicEffect: EconomicEffect.NON_CASH,
      occurredAt: "2026-07-09T00:00:00.000Z",
      amount: "500.00",
      currency: "BRL",
      description: "non-cash",
      parties: [{ partyId: "broker-1", role: PartyRole.BENEFICIARY, direction: Direction.NEUTRAL }],
      objects: [{ objectId: "nc-1", objectType: ObjectType.COMMISSION_ENTITLEMENT, relation: Relation.SETTLES }],
      reason: { type: ReasonType.COMMISSION_WAIVER, description: "waiver", confidence: ConfidenceLevel.HIGH, requiresFollowup: false },
      reporter: { reporterType: ReporterType.USER, reporterId: "user-cfo", channel: "web" },
      ...over,
    };
  }

  it("accepts the NON_CASH commission waiver Treasury produces (single beneficiary, no amount)", async () => {
    const { submit } = build();
    const outcome = await submit.execute(nonCashCandidate({ sourceReference: "intent:waiver" }), "intent:waiver");
    expect(outcome.status).toBe("accepted");
  });

  it("accepts the NON_CASH commission accrual (COMMISSION_EXPECTED · ORIGINATES · usina beneficiary)", async () => {
    const { submit } = build();
    const outcome = await submit.execute(
      nonCashCandidate({
        sourceReference: "intent:accrual",
        eventType: EventType.COMMISSION_EXPECTED,
        parties: [{ partyId: "party-usina", role: PartyRole.BENEFICIARY, direction: Direction.NEUTRAL }],
        objects: [{ objectId: "acc-1", objectType: ObjectType.COMMISSION_RECEIVABLE, relation: Relation.ORIGINATES }],
        reason: { type: ReasonType.COMMISSION_ACCRUAL, description: "accrual", confidence: ConfidenceLevel.HIGH, requiresFollowup: false },
      }),
      "intent:accrual",
    );
    expect(outcome.status).toBe("accepted");
  });

  it("accepts the NON_CASH direct-payment acknowledgement with TWO settled objects", async () => {
    const { submit } = build();
    const outcome = await submit.execute(
      nonCashCandidate({
        sourceReference: "intent:direct",
        eventType: EventType.DIRECT_PAYMENT_ACKNOWLEDGED,
        objects: [
          { objectId: "direct-1:receivable", objectType: ObjectType.COMMISSION_RECEIVABLE, relation: Relation.SETTLES },
          { objectId: "direct-1:entitlement", objectType: ObjectType.COMMISSION_ENTITLEMENT, relation: Relation.SETTLES },
        ],
        reason: { type: ReasonType.DIRECT_COMMISSION_PAYMENT_AUTHORIZED, description: "direct", confidence: ConfidenceLevel.HIGH, requiresFollowup: false },
      }),
      "intent:direct",
    );
    expect(outcome.status).toBe("accepted");
  });

  // ── Lineage (Phase 6): the submit boundary now forwards relatedEventId; the Ledger validates it ──
  function commissionExpected(ref: string): SubmitCandidateInput {
    return nonCashCandidate({
      sourceReference: ref,
      eventType: EventType.COMMISSION_EXPECTED,
      amount: "1000.00",
      parties: [{ partyId: "party-usina", role: PartyRole.BENEFICIARY, direction: Direction.NEUTRAL }],
      objects: [{ objectId: `${ref}:obj`, objectType: ObjectType.COMMISSION_RECEIVABLE, relation: Relation.ORIGINATES }],
      reason: { type: ReasonType.COMMISSION_ACCRUAL, description: "accrual", confidence: ConfidenceLevel.HIGH, requiresFollowup: false },
    });
  }
  function commissionReceived(ref: string, over: Partial<SubmitCandidateInput> = {}): SubmitCandidateInput {
    return {
      sourceReference: ref,
      eventType: EventType.COMMISSION_RECEIVED,
      economicEffect: EconomicEffect.CASH_IN,
      occurredAt: "2026-07-10T00:00:00.000Z",
      amount: "1000.00",
      currency: "BRL",
      parties: [
        { partyId: "party-usina", role: PartyRole.PAYEE, direction: Direction.IN, amount: "1000.00" },
        { partyId: "operator-1", role: PartyRole.BENEFICIARY, direction: Direction.NEUTRAL, amount: "1000.00" },
      ],
      objects: [{ objectId: `${ref}:obj`, objectType: ObjectType.COMMISSION_RECEIVABLE, relation: Relation.SETTLES }],
      reason: { type: ReasonType.COMMISSION_PAYMENT, description: "received", confidence: ConfidenceLevel.HIGH, requiresFollowup: false },
      reporter: { reporterType: ReporterType.USER, reporterId: "user-cfo", channel: "web" },
      ...over,
    };
  }

  it("forwards relatedEventId and accepts a commission received linked to its expected", async () => {
    const { submit } = build();
    const expected = await submit.execute(commissionExpected("intent:exp"), "intent:exp");
    expect(expected.status).toBe("accepted");
    const originId = expected.status === "accepted" ? expected.ledgerReference : "";

    const received = await submit.execute(commissionReceived("intent:recv", { relatedEventId: originId }), "intent:recv");
    expect(received.status).toBe("accepted");
  });

  it("accepts an orphan commission received (no origin) when it declares UNKNOWN_ORIGIN + follow-up", async () => {
    const { submit } = build();
    const orphan = await submit.execute(
      commissionReceived("intent:orphan", {
        reason: { type: ReasonType.UNKNOWN_ORIGIN, description: "origin unknown", confidence: ConfidenceLevel.HIGH, requiresFollowup: true },
      }),
      "intent:orphan",
    );
    expect(orphan.status).toBe("accepted");
  });

  it("rejects a non-existent origin as a structured lineage rejection (re-askable)", async () => {
    const { submit } = build();
    const outcome = await submit.execute(commissionReceived("intent:bad-origin", { relatedEventId: "does-not-exist" }), "intent:bad-origin");
    expect(outcome.status).toBe("rejected");
    if (outcome.status === "rejected") {
      expect(outcome.rejections[0]).toMatchObject({ code: "ORIGIN_NOT_FOUND", category: "lineage", field: "relatedEventId" });
    }
  });

  it("rejects a wrong-type origin as a lineage rejection", async () => {
    const { submit } = build();
    const expected = await submit.execute(commissionExpected("intent:exp2"), "intent:exp2");
    const originId = expected.status === "accepted" ? expected.ledgerReference : "";
    // An advance settlement pointing at a COMMISSION_EXPECTED origin — wrong allowedOriginType.
    const outcome = await submit.execute(
      {
        ...commissionReceived("intent:wrongtype", { relatedEventId: originId }),
        eventType: EventType.ADVANCE_SETTLEMENT,
        objects: [{ objectId: "wt:obj", objectType: ObjectType.ADVANCE, relation: Relation.SETTLES }],
        reason: { type: ReasonType.ADVANCE_PAYMENT, description: "recovery", confidence: ConfidenceLevel.HIGH, requiresFollowup: false },
      },
      "intent:wrongtype",
    );
    expect(outcome.status).toBe("rejected");
    if (outcome.status === "rejected") {
      expect(outcome.rejections[0]).toMatchObject({ code: "ORIGIN_WRONG_TYPE", category: "lineage" });
    }
  });

  it("rejects over-settlement as a structured input rejection on the amount", async () => {
    const { submit } = build();
    const expected = await submit.execute(commissionExpected("intent:exp3"), "intent:exp3");
    const originId = expected.status === "accepted" ? expected.ledgerReference : "";
    // Origin is 1000.00; settling 1500.00 exceeds it.
    const outcome = await submit.execute(
      commissionReceived("intent:over", { relatedEventId: originId, amount: "1500.00", parties: [
        { partyId: "party-usina", role: PartyRole.PAYEE, direction: Direction.IN, amount: "1500.00" },
        { partyId: "operator-1", role: PartyRole.BENEFICIARY, direction: Direction.NEUTRAL, amount: "1500.00" },
      ] }),
      "intent:over",
    );
    expect(outcome.status).toBe("rejected");
    if (outcome.status === "rejected") {
      expect(outcome.rejections[0]).toMatchObject({ code: "OVER_SETTLEMENT", category: "input", field: "amount" });
    }
  });

  it("is idempotent: a retry returns the same acceptance, not a duplicate", async () => {
    const { submit } = build();
    const first = await submit.execute(validCandidate(), "intent:adv-1");
    const retry = await submit.execute(validCandidate(), "intent:adv-1");
    expect(first.status).toBe("accepted");
    expect(retry.status).toBe("accepted");
    if (first.status === "accepted" && retry.status === "accepted") {
      expect(retry.ledgerReference).toBe(first.ledgerReference);
    }
  });
});
