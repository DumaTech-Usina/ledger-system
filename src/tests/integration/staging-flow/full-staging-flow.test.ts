import { describe, expect, it } from "vitest";
import { ProcessStagingJob } from "../../../infra/jobs/ProcessStagingJob";
import { InMemoryLedgerEventRepository } from "../../../infra/persistence/ledger/InMemoryLedgerEventRepository";
import { InMemoryRejectedEventRepository } from "../../../infra/persistence/rejected/InMemoryRejectedEventRepository";
import { InMemoryStagingRepository } from "../../../infra/persistence/staging/InMemoryStagingRepository";
import { CreateLedgerEventUseCase } from "../../../core/application/use-cases/CreateLedgerEventUseCase";
import { RejectLedgerEventUseCase } from "../../../core/application/use-cases/RejectLedgerEventUseCase";
import { StagingRecordValidator } from "../../../core/application/services/StagingRecordValidator";
import { StagingRecord } from "../../../core/application/dtos/StagingRecord";
import { makeValidStagingRecord } from "../../fixtures";

// ============================
// Helpers
// ============================

function buildPipeline(records: StagingRecord[]) {
  const stagingRepo = new InMemoryStagingRepository(records);
  const ledgerRepo = new InMemoryLedgerEventRepository();
  const rejectedRepo = new InMemoryRejectedEventRepository();
  const validator = new StagingRecordValidator(ledgerRepo);
  const createUseCase = new CreateLedgerEventUseCase(ledgerRepo);
  const rejectUseCase = new RejectLedgerEventUseCase(rejectedRepo);
  const job = new ProcessStagingJob(
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
        makeValidStagingRecord({ id: "stg-1", sourceReference: "ref-1" }),
      ]);
      await job.run();
      expect(await ledgerRepo.findAll()).toHaveLength(1);
      expect(await rejectedRepo.findAll()).toHaveLength(0);
    });

    it("multiple valid records → all saved to ledger", async () => {
      const records = [
        makeValidStagingRecord({ id: "stg-1", sourceReference: "ref-1" }),
        makeValidStagingRecord({ id: "stg-2", sourceReference: "ref-2" }),
        makeValidStagingRecord({ id: "stg-3", sourceReference: "ref-3" }),
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
        makeValidStagingRecord({ id: "stg-bad", amount: "not-a-number" }),
      ]);
      await job.run();
      expect(await ledgerRepo.findAll()).toHaveLength(0);
      expect(await rejectedRepo.findAll()).toHaveLength(1);
    });

    it("record missing eventType → rejected", async () => {
      const { job, rejectedRepo, ledgerRepo } = buildPipeline([
        makeValidStagingRecord({ id: "stg-no-type", eventType: undefined }),
      ]);
      await job.run();
      expect(await rejectedRepo.findAll()).toHaveLength(1);
      expect(await ledgerRepo.findAll()).toHaveLength(0);
    });

    it("record missing sourceSystem → rejected", async () => {
      const { job, rejectedRepo, ledgerRepo } = buildPipeline([
        makeValidStagingRecord({ id: "stg-no-src", sourceSystem: undefined }),
      ]);
      await job.run();
      expect(await rejectedRepo.findAll()).toHaveLength(1);
      expect(await ledgerRepo.findAll()).toHaveLength(0);
    });

    it("record with unknown sourceSystem → rejected", async () => {
      const { job, rejectedRepo, ledgerRepo } = buildPipeline([
        makeValidStagingRecord({
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
        makeValidStagingRecord({ id: "stg-no-parties", parties: [] }),
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
        makeValidStagingRecord({ id: "stg-1", sourceReference: "ref-dup" }),
        makeValidStagingRecord({ id: "stg-2", sourceReference: "ref-dup" }),
      ];
      const { job, ledgerRepo, rejectedRepo } = buildPipeline(records);
      await job.run();
      // First passes, second is detected as duplicate
      expect(await ledgerRepo.findAll()).toHaveLength(1);
      expect(await rejectedRepo.findAll()).toHaveLength(1);
    });
  });

  // ============================
  // All records are marked as processed
  // ============================
  describe("all records are marked as processed after the job run", () => {
    it("no pending records remain after job.run()", async () => {
      const records = [
        makeValidStagingRecord({ id: "stg-1", sourceReference: "ref-1" }),
        makeValidStagingRecord({ id: "stg-2", amount: "bad!" }),
      ];
      const { job, stagingRepo } = buildPipeline(records);
      await job.run();
      const pending = (await stagingRepo.findAll()).filter(
        (r) => r.status === "pending",
      );
      expect(pending).toHaveLength(0);
    });

    it("all records have status=processed regardless of outcome", async () => {
      const records = [
        makeValidStagingRecord({ id: "stg-ok", sourceReference: "ref-ok" }),
        makeValidStagingRecord({ id: "stg-bad", parties: [] }),
      ];
      const { job, stagingRepo } = buildPipeline(records);
      await job.run();
      const all = await stagingRepo.findAll();
      expect(all.every((r) => r.status === "processed")).toBe(true);
    });
  });

  // ============================
  // Mixed batch
  // ============================
  describe("mixed batch of valid and invalid records", () => {
    it("correctly routes each record to ledger or rejected repo", async () => {
      const records = [
        makeValidStagingRecord({ id: "stg-v1", sourceReference: "ref-v1" }),
        makeValidStagingRecord({ id: "stg-bad1", amount: "x" }),
        makeValidStagingRecord({ id: "stg-v2", sourceReference: "ref-v2" }),
        makeValidStagingRecord({ id: "stg-bad2", parties: [] }),
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
