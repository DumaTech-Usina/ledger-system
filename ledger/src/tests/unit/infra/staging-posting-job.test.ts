import { describe, it, expect, vi } from "vitest";
import { StagingPostingJob } from "../../../infra/jobs/StagingPostingJob";
import { InMemoryStagingRepository } from "../../../infra/persistence/staging/InMemoryStagingRepository";
import { InMemoryRejectedEventRepository } from "../../../infra/persistence/rejected/InMemoryRejectedEventRepository";
import { StagingRecord } from "../../../core/application/dtos/StagingRecord";
import { CreateLedgerEventCommand } from "../../../core/application/dtos/CreateLedgerEventInput";
import { RejectLedgerEventUseCase } from "../../../core/application/use-cases/RejectLedgerEventUseCase";
import { NoOpAuditLogger } from "../../../infra/audit/NoOpAuditLogger";
import { makeValidStagingRecord } from "../../fixtures";

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildPipeline(record: StagingRecord) {
  const stagingRepo = new InMemoryStagingRepository([record]);
  const rejectedRepo = new InMemoryRejectedEventRepository();
  const rejectUseCase = new RejectLedgerEventUseCase(rejectedRepo, new NoOpAuditLogger());

  const capturedCommands: CreateLedgerEventCommand[] = [];
  const createUseCase = {
    execute: vi.fn(async (cmd: CreateLedgerEventCommand) => {
      capturedCommands.push(cmd);
      return {} as never;
    }),
  };

  const validator = {
    validate: vi.fn().mockResolvedValue([]),
  };

  const job = new StagingPostingJob(
    stagingRepo,
    validator as never,
    createUseCase as never,
    rejectUseCase,
  );

  return { job, capturedCommands };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("StagingPostingJob.toCreateCommand — assembling a ledger command from a validated staging record", () => {

  it("a staging record carrying a relatedEventId has that id forwarded verbatim into the ledger command — settlement events must preserve the causal link back to their originating event", async () => {
    const record = makeValidStagingRecord({
      id: "stg-with-related",
      relatedEventId: "evt-origin-99",
    });
    const { job, capturedCommands } = buildPipeline(record);

    await job.run();

    expect(capturedCommands[0].relatedEventId).toBe("evt-origin-99");
  });

  it("a staging record with reason.requiresFollowup set to true preserves that flag in the assembled command — operational alerts depend on this being faithfully forwarded", async () => {
    const record = makeValidStagingRecord({
      id: "stg-followup",
      reason: {
        type: "commission_payment",
        description: "Requires manual review",
        confidence: "low",
        requiresFollowup: true,
      },
    });
    const { job, capturedCommands } = buildPipeline(record);

    await job.run();

    expect(capturedCommands[0].reason?.requiresFollowup).toBe(true);
  });

  it("a staging record with a null reason produces a command with no reason field — system events without business context must be accepted without forcing an empty reason object", async () => {
    const record = makeValidStagingRecord({ id: "stg-no-reason", reason: null });
    const { job, capturedCommands } = buildPipeline(record);

    await job.run();

    expect(capturedCommands[0].reason).toBeUndefined();
  });

  it("a staging record with reporter.reporterName set to null preserves that null in the assembled command — anonymous reporters are valid and must not be silently dropped", async () => {
    const record = makeValidStagingRecord({
      id: "stg-anon-reporter",
      reporter: {
        reporterType: "system",
        reporterId: "etl-worker-1",
        reporterName: null,
        channel: "batch",
      },
    });
    const { job, capturedCommands } = buildPipeline(record);

    await job.run();

    expect(capturedCommands[0].reporter.reporterName).toBeNull();
  });

  it("a party without an amount field has that field omitted in the assembled command — optional party amounts must not be coerced into a defined value during assembly", async () => {
    const record = makeValidStagingRecord({
      id: "stg-party-no-amount",
      parties: [
        { partyId: "op-001", role: "payer",  direction: "neutral" },
        { partyId: "usina",  role: "payee",  direction: "neutral" },
      ],
    });
    const { job, capturedCommands } = buildPipeline(record);

    await job.run();

    const parties = capturedCommands[0].parties;
    expect(parties[0].amount).toBeUndefined();
    expect(parties[1].amount).toBeUndefined();
  });

  it("a staging record with a null relatedEventId produces a command where relatedEventId is null — distinguishing 'no related event' from 'not set' matters for ledger chain integrity", async () => {
    const record = makeValidStagingRecord({ id: "stg-null-related", relatedEventId: null });
    const { job, capturedCommands } = buildPipeline(record);

    await job.run();

    expect(capturedCommands[0].relatedEventId).toBeNull();
  });

});
