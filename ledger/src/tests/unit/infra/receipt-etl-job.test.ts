/**
 * Phase 0.4 — ReceiptETLJob orchestration tests.
 *
 * These tests are intentionally RED until Step 8 of the refactor plan is complete.
 * Step 8 changes ReceiptETLJob to accept injected dependencies instead of constructing
 * MongoReceiptETLReader, ProposalContextNormalizer, and ReceiptStagingBuilder inline.
 *
 * Until then, this file documents the target behaviour and serves as the acceptance
 * criteria for the Step 8 refactor.
 */
import { describe, it, expect, vi } from "vitest";
import { ReceiptETLJob } from "../../../infra/jobs/ReceiptETLJob";
import { InMemoryStagingRepository } from "../../../infra/persistence/staging/InMemoryStagingRepository";
import { ProposalContextInput } from "../../../core/application/dtos/ProposalContextInput";
import { ReceiptPostingInput } from "../../../core/application/dtos/ReceiptPostingInput";
import { ProposalContextNormalizer } from "../../../core/application/services/ProposalContextNormalizer";
import { ReceiptStagingBuilder } from "../../../core/application/services/ReceiptStagingBuilder";
import { ReceiptETLReader } from "../../../core/application/ports/ReceiptETLReader";

// ── Stub helpers ─────────────────────────────────────────────────────────────

function makeProposalInput(proposalId: string): ProposalContextInput {
  return {
    proposalId,
    proposalNumber: "12345678",
    operatorId: "op-001",
    registeredAt: "2024-05-01T08:00:00Z",
  };
}

function makeBaixadoReceiptInput(
  receiptId: string,
  proposalId: string,
  installmentNumber = 1,
): ReceiptPostingInput {
  return {
    receiptId,
    proposalId,
    installmentNumber,
    downloadedValue: "200.00",
    dischargeDate: "2024-06-15T00:00:00Z",
    receiptStatus: "BAIXADO",
  };
}

function makeAtertaReceiptInput(receiptId: string, proposalId: string): ReceiptPostingInput {
  return {
    receiptId,
    proposalId,
    installmentNumber: 1,
    downloadedValue: "150.00",
    dischargeDate: null,
    receiptStatus: "ABERTA",
  };
}

function makeReader(
  proposals: ProposalContextInput[],
  receipts: ReceiptPostingInput[],
): ReceiptETLReader {
  return {
    fetchCleanProposals: vi.fn().mockResolvedValue(proposals),
    fetchCleanReceipts: vi.fn().mockResolvedValue(receipts),
  };
}

function buildPipeline(
  reader: ReceiptETLReader,
  stagingRepo = new InMemoryStagingRepository([]),
) {
  const normalizer = new ProposalContextNormalizer();
  const builder = new ReceiptStagingBuilder(stagingRepo, "usina-001", "worker-etl-1");
  const job = new ReceiptETLJob(reader, normalizer, builder);
  return { job, stagingRepo };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ReceiptETLJob — orchestrating the full ETL pipeline from source system to staging", () => {

  it("when the source system returns no proposals and no receipts, nothing is staged — an empty run is a valid no-op and must not produce phantom records", async () => {
    const reader = makeReader([], []);
    const { job, stagingRepo } = buildPipeline(reader);

    await job.run();

    expect(await stagingRepo.findAll()).toHaveLength(0);
  });

  it("a valid BAIXADO receipt matched to a known proposal produces one CASH_IN staging record — the ETL pipeline correctly routes a discharged commission from source to staging", async () => {
    const reader = makeReader(
      [makeProposalInput("prop-001")],
      [makeBaixadoReceiptInput("rcpt-A", "prop-001")],
    );
    const { job, stagingRepo } = buildPipeline(reader);

    await job.run();

    const saved = await stagingRepo.findAll();
    expect(saved).toHaveLength(1);
    expect(saved[0].economicEffect).toBe("cash_in");
  });

  it("a valid ABERTA receipt matched to a known proposal produces one NON_CASH staging record — the ETL pipeline correctly recognizes an unresolved commission obligation", async () => {
    const reader = makeReader(
      [makeProposalInput("prop-002")],
      [makeAtertaReceiptInput("rcpt-B", "prop-002")],
    );
    const { job, stagingRepo } = buildPipeline(reader);

    await job.run();

    const saved = await stagingRepo.findAll();
    expect(saved).toHaveLength(1);
    expect(saved[0].economicEffect).toBe("non_cash");
  });

  it("a receipt that references a proposalId absent from the proposals list is silently skipped — orphaned receipts must not reach the staging queue without a proposal context to provide attribution", async () => {
    const reader = makeReader(
      [makeProposalInput("prop-known")],
      [makeBaixadoReceiptInput("rcpt-orphan", "prop-unknown")],
    );
    const { job, stagingRepo } = buildPipeline(reader);

    await job.run();

    expect(await stagingRepo.findAll()).toHaveLength(0);
  });

  it("when the source reader fails to fetch proposals, the run rejects with that error — the ETL pipeline must not silently swallow upstream failures", async () => {
    const reader: ReceiptETLReader = {
      fetchCleanProposals: vi.fn().mockRejectedValue(new Error("MongoDB connection lost")),
      fetchCleanReceipts: vi.fn().mockResolvedValue([]),
    };
    const { job } = buildPipeline(reader);

    await expect(job.run()).rejects.toThrow("MongoDB connection lost");
  });

  it("when the source reader fails to fetch receipts, the run rejects with that error — a partial fetch is not acceptable; either both sides succeed or the run fails completely", async () => {
    const reader: ReceiptETLReader = {
      fetchCleanProposals: vi.fn().mockResolvedValue([makeProposalInput("prop-001")]),
      fetchCleanReceipts: vi.fn().mockRejectedValue(new Error("Receipt collection unavailable")),
    };
    const { job } = buildPipeline(reader);

    await expect(job.run()).rejects.toThrow("Receipt collection unavailable");
  });

  it("a batch with two valid receipts and one receipt referencing an unknown proposal stages exactly two records — bad data is quarantined without blocking good data", async () => {
    const reader = makeReader(
      [makeProposalInput("prop-001")],
      [
        makeBaixadoReceiptInput("rcpt-ok-1", "prop-001", 1),
        makeBaixadoReceiptInput("rcpt-orphan", "prop-missing", 2),
        makeBaixadoReceiptInput("rcpt-ok-2", "prop-001", 3),
      ],
    );
    const { job, stagingRepo } = buildPipeline(reader);

    await job.run();

    expect(await stagingRepo.findAll()).toHaveLength(2);
  });

});
