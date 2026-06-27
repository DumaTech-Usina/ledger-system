import { describe, it, expect } from "vitest";
import { StagingPostingJob } from "../../../infra/jobs/StagingPostingJob";
import { InMemoryLedgerEventRepository } from "../../../infra/persistence/memory/InMemoryLedgerEventRepository";
import { InMemoryStagingRepository } from "../../../infra/persistence/staging/InMemoryStagingRepository";
import { InMemoryRejectedEventRepository } from "../../../infra/persistence/rejected/InMemoryRejectedEventRepository";
import { StagingRecordValidator } from "../../../core/application/services/StagingRecordValidator";
import { CreateLedgerEventUseCase } from "../../../core/application/use-cases/CreateLedgerEventUseCase";
import { RejectLedgerEventUseCase } from "../../../core/application/use-cases/RejectLedgerEventUseCase";
import { ReceiptLineageResolver } from "../../../core/application/services/ReceiptLineageResolver";
import { NoOpAuditLogger } from "../../../infra/audit/NoOpAuditLogger";
import { StagingRecord } from "../../../core/application/dtos/StagingRecord";
import { EventType } from "../../../core/domain/enums/EventType";
import { ReasonType } from "../../../core/domain/enums/ReasonType";

const USINA = "party-usina";
const RECEIVABLE = "receivable:rcpt-9";

function buildPipeline(seeds: StagingRecord[]) {
  const ledgerRepo = new InMemoryLedgerEventRepository();
  const stagingRepo = new InMemoryStagingRepository(seeds);
  const rejectedRepo = new InMemoryRejectedEventRepository();
  const validator = new StagingRecordValidator(ledgerRepo);
  const createUseCase = new CreateLedgerEventUseCase(ledgerRepo, new NoOpAuditLogger());
  const rejectUseCase = new RejectLedgerEventUseCase(rejectedRepo, new NoOpAuditLogger());
  const resolver = new ReceiptLineageResolver(ledgerRepo);
  const job = new StagingPostingJob(stagingRepo, validator, createUseCase, rejectUseCase, resolver);
  return { job, ledgerRepo, rejectedRepo, stagingRepo };
}

function received(overrides: Partial<StagingRecord> = {}): StagingRecord {
  return {
    id: "stg-received",
    status: "pending",
    eventType: "commission_received",
    economicEffect: "cash_in",
    occurredAt: "2026-03-10T00:00:00.000Z",
    sourceAt: "2026-03-10T00:00:00.000Z",
    amount: "500.00",
    currency: "BRL",
    sourceSystem: "integration",
    sourceReference: "receipt:rcpt-9:received",
    normalizationVersion: "1.0",
    normalizationWorkerId: "worker-x",
    parties: [
      { partyId: "op-1", role: "payer", direction: "neutral" },
      { partyId: USINA, role: "payee", direction: "in", amount: "500.00" },
    ],
    objects: [
      { objectId: RECEIVABLE, objectType: "commission_receivable", relation: "settles" },
      { objectId: "prop-9", objectType: "proposal", relation: "references" },
      { objectId: "prop-9:1", objectType: "installment", relation: "references" },
    ],
    reason: {
      type: "commission_payment",
      description: "received",
      confidence: "medium",
      requiresFollowup: false,
    },
    reporter: { reporterType: "system", reporterId: "w", channel: "batch" },
    ...overrides,
  };
}

function expected(overrides: Partial<StagingRecord> = {}): StagingRecord {
  return {
    id: "stg-expected",
    status: "pending",
    eventType: "commission_expected",
    economicEffect: "non_cash",
    occurredAt: "2026-01-05T00:00:00.000Z",
    sourceAt: null,
    amount: "500.00",
    currency: "BRL",
    sourceSystem: "integration",
    sourceReference: "receipt:rcpt-9:expected",
    normalizationVersion: "1.0",
    normalizationWorkerId: "worker-x",
    parties: [
      { partyId: "op-1", role: "payer", direction: "neutral" },
      { partyId: USINA, role: "payee", direction: "neutral" },
    ],
    objects: [
      { objectId: RECEIVABLE, objectType: "commission_receivable", relation: "originates" },
      { objectId: "prop-9", objectType: "proposal", relation: "references" },
      { objectId: "prop-9:1", objectType: "installment", relation: "references" },
    ],
    reason: {
      type: "commission_accrual",
      description: "accrual",
      confidence: "medium",
      requiresFollowup: false,
    },
    reporter: { reporterType: "system", reporterId: "w", channel: "batch" },
    ...overrides,
  };
}

describe("commission lineage — StagingPostingJob + ReceiptLineageResolver", () => {
  it("orphan (born-BAIXADO): a lone received is recorded as a first-class fact with unresolved origin — no expected is fabricated", async () => {
    const { job, ledgerRepo, rejectedRepo } = buildPipeline([received()]);

    await job.run();

    const events = await ledgerRepo.findByObjectId(RECEIVABLE);
    const rcv = events.find((e) => e.eventType === EventType.COMMISSION_RECEIVED);
    const expecteds = events.filter((e) => e.eventType === EventType.COMMISSION_EXPECTED);

    // The received is a valid fact, not an error.
    expect(rcv).toBeDefined();
    expect(await rejectedRepo.findAll()).toHaveLength(0);
    // Its lineage is explicitly unresolved — never fabricated.
    expect(rcv!.relatedEventId).toBeNull();
    expect(rcv!.getReason()?.type).toBe(ReasonType.UNKNOWN_ORIGIN);
    expect(rcv!.getReason()?.requiresFollowup).toBe(true);
    expect(expecteds).toHaveLength(0);
  });

  it("normal lifecycle: a received links to the pre-existing expected, no second expected", async () => {
    const { job, ledgerRepo } = buildPipeline([expected(), received()]);

    await job.run();

    const events = await ledgerRepo.findByObjectId(RECEIVABLE);
    const expecteds = events.filter((e) => e.eventType === EventType.COMMISSION_EXPECTED);
    const rcv = events.find((e) => e.eventType === EventType.COMMISSION_RECEIVED);

    expect(expecteds).toHaveLength(1);
    expect(rcv!.relatedEventId).toBe(expecteds[0].id.value);
    expect(rcv!.getReason()?.type).toBe(ReasonType.COMMISSION_PAYMENT);
  });

  it("real-evidence precedence: a received first (orphan), then a real expected — the expected is accepted, never rejected", async () => {
    // received processed first → recorded as an orphan (no origin fabricated); the real
    // expected then arrives as genuine external evidence and must post successfully.
    const { job, ledgerRepo, rejectedRepo } = buildPipeline([received(), expected()]);

    await job.run();

    const events = await ledgerRepo.findByObjectId(RECEIVABLE);
    const expecteds = events.filter((e) => e.eventType === EventType.COMMISSION_EXPECTED);
    const rcv = events.find((e) => e.eventType === EventType.COMMISSION_RECEIVED);

    // The real expected is accepted (the orphan never blocks genuine evidence).
    expect(expecteds).toHaveLength(1);
    expect(await rejectedRepo.findAll()).toHaveLength(0);
    // The orphan remains a first-class fact, untouched (explicit linking is a later step).
    expect(rcv!.relatedEventId).toBeNull();
    expect(rcv!.getReason()?.type).toBe(ReasonType.UNKNOWN_ORIGIN);
  });

  it("later discovery: an expected arriving in a later run enriches lineage implicitly — origin becomes derivable, orphan never rewritten", async () => {
    // Run 1 — only the orphan exists. The gap is exposed, not inferred.
    const { job, ledgerRepo, rejectedRepo, stagingRepo } = buildPipeline([received()]);
    await job.run();

    const afterRun1 = await ledgerRepo.findByObjectId(RECEIVABLE);
    const orphan = afterRun1.find((e) => e.eventType === EventType.COMMISSION_RECEIVED)!;
    expect(orphan.relatedEventId).toBeNull();
    expect(orphan.getReason()?.type).toBe(ReasonType.UNKNOWN_ORIGIN);
    expect(afterRun1.filter((e) => e.eventType === EventType.COMMISSION_EXPECTED)).toHaveLength(0);
    // Capture the orphan's identity + hash to prove it is never rewritten.
    const orphanIdBefore = orphan.id.value;
    const orphanHashBefore = orphan.hash.value;

    // Run 2 — a later external worker supplies the expected as a new fact.
    await stagingRepo.save(expected());
    await job.run();

    const afterRun2 = await ledgerRepo.findByObjectId(RECEIVABLE);
    const exp = afterRun2.find((e) => e.eventType === EventType.COMMISSION_EXPECTED);
    const orphanAfter = afterRun2.find((e) => e.eventType === EventType.COMMISSION_RECEIVED)!;

    // Knowledge enriched: the origin is now derivable through the shared receivable object.
    expect(exp).toBeDefined();
    expect(afterRun2.filter((e) => e.eventType === EventType.COMMISSION_EXPECTED)).toHaveLength(1);
    expect(await rejectedRepo.findAll()).toHaveLength(0);
    // History never rewritten: the orphan is byte-for-byte the same fact.
    expect(orphanAfter.id.value).toBe(orphanIdBefore);
    expect(orphanAfter.hash.value).toBe(orphanHashBefore);
    expect(orphanAfter.relatedEventId).toBeNull();
    expect(orphanAfter.getReason()?.type).toBe(ReasonType.UNKNOWN_ORIGIN);
    expect(orphanAfter.getReason()?.requiresFollowup).toBe(true);
  });
});
