import { describe, expect, it } from "vitest";
import { StagingPostingJob } from "../../../infra/jobs/StagingPostingJob";
import { InMemoryLedgerEventRepository } from "../../../infra/persistence/memory/InMemoryLedgerEventRepository";
import { InMemoryRejectedEventRepository } from "../../../infra/persistence/rejected/InMemoryRejectedEventRepository";
import { InMemoryStagingRepository } from "../../../infra/persistence/staging/InMemoryStagingRepository";
import { CreateLedgerEventUseCase } from "../../../core/application/use-cases/CreateLedgerEventUseCase";
import { RejectLedgerEventUseCase } from "../../../core/application/use-cases/RejectLedgerEventUseCase";
import { NoOpAuditLogger } from "../../../infra/audit/NoOpAuditLogger";
import { StagingRecordValidator } from "../../../core/application/services/StagingRecordValidator";
import { StagingRecord } from "../../../core/application/dtos/StagingRecord";
import { makeValidStagingRecord } from "../../fixtures";

// ============================
// Helpers
// ============================

/**
 * A self-contained valid record for pipeline mechanics. These tests assert counts, dedup,
 * rejection routing and status transitions — the event type is incidental — so we use a
 * COMMISSION_EXPECTED (originates, no parent required) to keep "N records → N events" intact
 * without seeding an ignition point per record.
 */
function validRecord(overrides: Partial<StagingRecord> = {}): StagingRecord {
  return makeValidStagingRecord({
    eventType: "commission_expected",
    economicEffect: "non_cash",
    objects: [
      { objectId: "obj-1", objectType: "commission_receivable", relation: "originates" },
    ],
    parties: [
      { partyId: "party-1", role: "beneficiary", direction: "neutral" },
    ],
    reason: {
      type: "late_identified_commission",
      description: "ignition point",
      confidence: "medium",
      requiresFollowup: false,
    },
    ...overrides,
  });
}

function buildPipeline(records: StagingRecord[]) {
  const stagingRepo = new InMemoryStagingRepository(records);
  const ledgerRepo = new InMemoryLedgerEventRepository();
  const rejectedRepo = new InMemoryRejectedEventRepository();
  const validator = new StagingRecordValidator(ledgerRepo);
  const audit = new NoOpAuditLogger();
  const createUseCase = new CreateLedgerEventUseCase(ledgerRepo, audit);
  const rejectUseCase = new RejectLedgerEventUseCase(rejectedRepo, audit);
  const job = new StagingPostingJob(
    stagingRepo,
    validator,
    createUseCase,
    rejectUseCase,
  );
  return { job, stagingRepo, ledgerRepo, rejectedRepo };
}

describe("Full Staging Flow — Integration", () => {
  // ============================
  // Critical invariant: valid events reach the ledger
  // ============================
  describe("valid events reach the ledger repository", () => {
    it("one valid record → one event in ledger, zero rejections", async () => {
      const { job, ledgerRepo, rejectedRepo } = buildPipeline([
        validRecord({ id: "stg-1", sourceReference: "ref-1" }),
      ]);
      await job.run();
      expect(await ledgerRepo.findAll()).toHaveLength(1);
      expect(await rejectedRepo.findAll()).toHaveLength(0);
    });

    it("multiple valid records → all saved to ledger", async () => {
      const records = [
        validRecord({ id: "stg-1", sourceReference: "ref-1" }),
        validRecord({ id: "stg-2", sourceReference: "ref-2" }),
        validRecord({ id: "stg-3", sourceReference: "ref-3" }),
      ];
      const { job, ledgerRepo } = buildPipeline(records);
      await job.run();
      expect(await ledgerRepo.findAll()).toHaveLength(3);
    });
  });

  // ============================
  // Critical invariant: invalid events reach the rejected repository
  // ============================
  describe("invalid events reach the rejected repository", () => {
    it("record with invalid amount format → rejected, not in ledger", async () => {
      const { job, ledgerRepo, rejectedRepo } = buildPipeline([
        validRecord({ id: "stg-bad", amount: "not-a-number" }),
      ]);
      await job.run();
      expect(await ledgerRepo.findAll()).toHaveLength(0);
      expect(await rejectedRepo.findAll()).toHaveLength(1);
    });

    it("record missing eventType → rejected", async () => {
      const { job, rejectedRepo, ledgerRepo } = buildPipeline([
        validRecord({ id: "stg-no-type", eventType: undefined }),
      ]);
      await job.run();
      expect(await rejectedRepo.findAll()).toHaveLength(1);
      expect(await ledgerRepo.findAll()).toHaveLength(0);
    });

    it("record missing sourceSystem → rejected", async () => {
      const { job, rejectedRepo, ledgerRepo } = buildPipeline([
        validRecord({ id: "stg-no-src", sourceSystem: undefined }),
      ]);
      await job.run();
      expect(await rejectedRepo.findAll()).toHaveLength(1);
      expect(await ledgerRepo.findAll()).toHaveLength(0);
    });

    it("record with unknown sourceSystem → rejected", async () => {
      const { job, rejectedRepo, ledgerRepo } = buildPipeline([
        validRecord({
          id: "stg-bad-src",
          sourceSystem: "ghost-system",
        }),
      ]);
      await job.run();
      expect(await rejectedRepo.findAll()).toHaveLength(1);
      expect(await ledgerRepo.findAll()).toHaveLength(0);
    });

    it("record with empty parties → rejected", async () => {
      const { job, rejectedRepo, ledgerRepo } = buildPipeline([
        validRecord({ id: "stg-no-parties", parties: [] }),
      ]);
      await job.run();
      expect(await rejectedRepo.findAll()).toHaveLength(1);
      expect(await ledgerRepo.findAll()).toHaveLength(0);
    });
  });

  // ============================
  // Deduplication (Critical)
  // ============================
  describe("event deduplication via sourceReference", () => {
    it("duplicate sourceReference in the same batch → second record is rejected", async () => {
      const records = [
        validRecord({ id: "stg-1", sourceReference: "ref-dup" }),
        validRecord({ id: "stg-2", sourceReference: "ref-dup" }),
      ];
      const { job, ledgerRepo, rejectedRepo } = buildPipeline(records);
      await job.run();
      // First passes, second is detected as duplicate
      expect(await ledgerRepo.findAll()).toHaveLength(1);
      expect(await rejectedRepo.findAll()).toHaveLength(1);
    });
  });

  // ============================
  // Status transitions
  // ============================
  describe("status transitions after job run", () => {
    it("no pending records remain after job.run()", async () => {
      const records = [
        validRecord({ id: "stg-1", sourceReference: "ref-1" }),
        validRecord({ id: "stg-2", amount: "bad!" }),
      ];
      const { job, stagingRepo } = buildPipeline(records);
      await job.run();
      const pending = (await stagingRepo.findAll()).filter(
        (r) => r.status === "pending",
      );
      expect(pending).toHaveLength(0);
    });

    it("valid record → status=accepted", async () => {
      const { job, stagingRepo } = buildPipeline([
        validRecord({ id: "stg-ok", sourceReference: "ref-ok" }),
      ]);
      await job.run();
      const record = (await stagingRepo.findAll()).find(
        (r) => r.id === "stg-ok",
      );
      expect(record?.status).toBe("accepted");
    });

    it("invalid record → status=rejected", async () => {
      const { job, stagingRepo } = buildPipeline([
        validRecord({ id: "stg-bad", parties: [] }),
      ]);
      await job.run();
      const record = (await stagingRepo.findAll()).find(
        (r) => r.id === "stg-bad",
      );
      expect(record?.status).toBe("rejected");
    });

    it("mixed batch → each record gets the correct terminal status", async () => {
      const records = [
        validRecord({ id: "stg-ok", sourceReference: "ref-ok" }),
        validRecord({ id: "stg-bad", parties: [] }),
      ];
      const { job, stagingRepo } = buildPipeline(records);
      await job.run();
      const all = await stagingRepo.findAll();
      const byId = Object.fromEntries(all.map((r) => [r.id, r.status]));
      expect(byId["stg-ok"]).toBe("accepted");
      expect(byId["stg-bad"]).toBe("rejected");
    });
  });

  // ============================
  // Mixed batch
  // ============================
  describe("mixed batch of valid and invalid records", () => {
    it("correctly routes each record to ledger or rejected repo", async () => {
      const records = [
        validRecord({ id: "stg-v1", sourceReference: "ref-v1" }),
        validRecord({ id: "stg-bad1", amount: "x" }),
        validRecord({ id: "stg-v2", sourceReference: "ref-v2" }),
        validRecord({ id: "stg-bad2", parties: [] }),
      ];
      const { job, ledgerRepo, rejectedRepo } = buildPipeline(records);
      await job.run();
      expect(await ledgerRepo.findAll()).toHaveLength(2);
      expect(await rejectedRepo.findAll()).toHaveLength(2);
    });
  });

  // ============================
  // Empty staging queue
  // ============================
  it("runs without error on an empty staging queue", async () => {
    const { job, ledgerRepo, rejectedRepo } = buildPipeline([]);
    await job.run();
    expect(await ledgerRepo.findAll()).toHaveLength(0);
    expect(await rejectedRepo.findAll()).toHaveLength(0);
  });
});
