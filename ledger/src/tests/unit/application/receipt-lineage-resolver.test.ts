import { describe, it, expect } from "vitest";
import { ReceiptLineageResolver } from "../../../core/application/services/ReceiptLineageResolver";
import { CreateLedgerEventUseCase } from "../../../core/application/use-cases/CreateLedgerEventUseCase";
import { CreateLedgerEventCommand } from "../../../core/application/dtos/CreateLedgerEventInput";
import { ValidatedStagingRecord } from "../../../core/application/dtos/StagingRecord";
import { InMemoryLedgerEventRepository } from "../../../infra/persistence/memory/InMemoryLedgerEventRepository";
import { NoOpAuditLogger } from "../../../infra/audit/NoOpAuditLogger";
import { LedgerEvent } from "../../../core/domain/entities/LedgerEvent";
import { ConfidenceLevel } from "../../../core/domain/enums/ConfidenceLevel";
import { Direction } from "../../../core/domain/enums/Direction";
import { EconomicEffect } from "../../../core/domain/enums/EconomicEffect";
import { EventType } from "../../../core/domain/enums/EventType";
import { ObjectType } from "../../../core/domain/enums/ObjectType";
import { PartyRole } from "../../../core/domain/enums/PartyRole";
import { ReasonType } from "../../../core/domain/enums/ReasonType";
import { Relation } from "../../../core/domain/enums/Relation";
import { ReporterType } from "../../../core/domain/enums/ReporterType";

const USINA = "party-usina";
const RECEIVABLE = "receivable:rcpt-9";

function buildResolver() {
  const ledgerRepo = new InMemoryLedgerEventRepository();
  // createUseCase is used only to seed a real COMMISSION_EXPECTED into the ledger; the
  // resolver itself holds no write dependency and cannot create events.
  const createUseCase = new CreateLedgerEventUseCase(ledgerRepo, new NoOpAuditLogger());
  const resolver = new ReceiptLineageResolver(ledgerRepo);
  return { resolver, ledgerRepo, createUseCase };
}

function makeReceived(overrides: Partial<ValidatedStagingRecord> = {}): ValidatedStagingRecord {
  return {
    id: "stg-rcv",
    status: "pending",
    eventType: EventType.COMMISSION_RECEIVED,
    economicEffect: EconomicEffect.CASH_IN,
    occurredAt: "2026-03-10T00:00:00.000Z",
    sourceAt: "2026-03-10T00:00:00.000Z",
    amount: "500.00",
    currency: "BRL",
    sourceSystem: "integration",
    sourceReference: "receipt:rcpt-9:received",
    normalizationVersion: "1.0",
    normalizationWorkerId: "worker-x",
    parties: [
      { partyId: "op-1", role: PartyRole.PAYER, direction: Direction.NEUTRAL },
      { partyId: USINA, role: PartyRole.PAYEE, direction: Direction.IN, amount: "500.00" },
    ],
    objects: [
      { objectId: RECEIVABLE, objectType: ObjectType.COMMISSION_RECEIVABLE, relation: Relation.SETTLES },
      { objectId: "prop-9", objectType: ObjectType.PROPOSAL, relation: Relation.REFERENCES },
    ],
    reason: {
      type: ReasonType.COMMISSION_PAYMENT,
      description: "received",
      confidence: ConfidenceLevel.MEDIUM,
      requiresFollowup: false,
    },
    reporter: { reporterType: ReporterType.SYSTEM, reporterId: "w", channel: "batch" },
    ...overrides,
  } as ValidatedStagingRecord;
}

async function postExpected(
  createUseCase: CreateLedgerEventUseCase,
  amount = "500.00",
): Promise<LedgerEvent> {
  const cmd: CreateLedgerEventCommand = {
    eventType: EventType.COMMISSION_EXPECTED,
    economicEffect: EconomicEffect.NON_CASH,
    occurredAt: new Date("2026-01-05T00:00:00Z"),
    sourceAt: null,
    amount,
    currency: "BRL",
    sourceSystem: "integration",
    sourceReference: "receipt:rcpt-9:expected",
    normalizationVersion: "1.0",
    normalizationWorkerId: "w",
    relatedEventId: null,
    parties: [
      { partyId: "op-1", role: PartyRole.PAYER, direction: Direction.NEUTRAL },
      { partyId: USINA, role: PartyRole.PAYEE, direction: Direction.NEUTRAL },
    ],
    objects: [
      { objectId: RECEIVABLE, objectType: ObjectType.COMMISSION_RECEIVABLE, relation: Relation.ORIGINATES },
    ],
    reason: {
      type: ReasonType.COMMISSION_ACCRUAL,
      description: "accrual",
      confidence: ConfidenceLevel.MEDIUM,
      requiresFollowup: false,
    },
    reporter: { reporterType: ReporterType.SYSTEM, reporterId: "w", channel: "batch" },
  };
  return createUseCase.execute(cmd);
}

describe("ReceiptLineageResolver (find-only)", () => {
  it("is a no-op for non-commission records — returns the record's own relatedEventId", async () => {
    const { resolver } = buildResolver();
    const id = await resolver.resolve(
      makeReceived({ eventType: EventType.ADVANCE_PAYMENT, relatedEventId: null }),
    );
    expect(id).toBeNull();
  });

  it("returns the existing link when the received already carries a relatedEventId", async () => {
    const { resolver } = buildResolver();
    const id = await resolver.resolve(makeReceived({ relatedEventId: "already-linked" }));
    expect(id).toBe("already-linked");
  });

  it("finds the originating expected already on the receivable (normal lifecycle)", async () => {
    const { resolver, createUseCase } = buildResolver();
    const expected = await postExpected(createUseCase);

    const id = await resolver.resolve(makeReceived());

    expect(id).toBe(expected.id.value);
  });

  it("returns null when no originating expected exists (orphan) — never fabricates one", async () => {
    const { resolver, ledgerRepo } = buildResolver();

    const id = await resolver.resolve(makeReceived());

    expect(id).toBeNull();
    // The ledger must contain no fabricated expected.
    const onObject = await ledgerRepo.findByObjectId(RECEIVABLE);
    expect(onObject.filter((e) => e.eventType === EventType.COMMISSION_EXPECTED)).toHaveLength(0);
  });

  it("throws when a commission_received has no commission_receivable object", async () => {
    const { resolver } = buildResolver();
    await expect(
      resolver.resolve(makeReceived({ objects: [] })),
    ).rejects.toThrow(/no commission_receivable/);
  });
});
