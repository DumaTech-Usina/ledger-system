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
    if (outcome.status === "rejected") expect(outcome.reason).toMatch(/eventType|invalid/i);
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
