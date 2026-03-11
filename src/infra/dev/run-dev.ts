import { CreateLedgerEventUseCase } from "../../core/application/use-cases/CreateLedgerEventUseCase";
import { RejectLedgerEventUseCase } from "../../core/application/use-cases/RejectLedgerEventUseCase";
import { StagingRecordValidator } from "../../core/application/services/StagingRecordValidator";
import { StagingRecord } from "../../core/application/dtos/StagingRecord";
import { InMemoryLedgerEventRepository } from "../persistence/ledger/InMemoryLedgerEventRepository";
import { InMemoryRejectedEventRepository } from "../persistence/rejected/InMemoryRejectedEventRepository";
import { InMemoryStagingRepository } from "../persistence/staging/InMemoryStagingRepository";
import { ProcessStagingJob } from "../jobs/ProcessStagingJob";

// ─── Seed data ───────────────────────────────────────────────────────────────

/**
 * Record 1 — valid COMMISSION_RECEIVED event.
 * Satisfies all semantic contracts and flow rules.
 */
const validRecord: StagingRecord = {
  id: "staging-001",
  status: "pending",
  eventType: "commission_received",
  economicEffect: "cash_in",
  occurredAt: new Date("2026-03-01T09:00:00.000Z").toISOString(),
  amount: "1500.00",
  currency: "BRL",
  sourceSystem: "normalizer",
  sourceReference: "EXT-REF-001",
  normalizationVersion: "1.0.0",
  normalizationWorkerId: "worker-42",
  parties: [
    {
      partyId: "party-company-abc",
      role: "payee",
      direction: "in",
      amount: "1500.00",
    },
  ],
  objects: [
    {
      objectId: "obj-commission-receivable-001",
      objectType: "commission_receivable",
      relation: "settles",
    },
  ],
  reason: {
    type: "commission_payment",
    description: "Monthly commission payment from partner ABC",
    confidence: "high",
    requiresFollowup: false,
  },
  reporter: {
    reporterType: "system",
    reporterId: "normalizer-worker-42",
    channel: "batch",
  },
};

/**
 * Record 2 — invalid amount.
 * Amount "1500.999" has 3 decimal places which exceeds the 2-place limit.
 */
const invalidAmountRecord: StagingRecord = {
  id: "staging-002",
  status: "pending",
  eventType: "payroll_payment",
  economicEffect: "cash_out",
  occurredAt: new Date("2026-03-01T09:05:00.000Z").toISOString(),
  amount: "1500.999",
  currency: "BRL",
  sourceSystem: "normalizer",
  sourceReference: "EXT-REF-002",
  normalizationVersion: "1.0.0",
  normalizationWorkerId: "worker-42",
  parties: [
    {
      partyId: "party-employee-001",
      role: "payee",
      direction: "out",
      amount: "1500.999",
    },
  ],
  objects: [
    {
      objectId: "obj-payroll-001",
      objectType: "payroll",
      relation: "settles",
    },
  ],
  reason: {
    type: "payroll_payment",
    description: "March payroll disbursement",
    confidence: "high",
    requiresFollowup: false,
  },
  reporter: {
    reporterType: "system",
    reporterId: "normalizer-worker-42",
    channel: "batch",
  },
};

/**
 * Record 3 — duplicate sourceReference.
 * Same EXT-REF-001 as record 1, which will already be registered by the time
 * this record is processed.
 */
const duplicateRecord: StagingRecord = {
  id: "staging-003",
  status: "pending",
  eventType: "commission_received",
  economicEffect: "cash_in",
  occurredAt: new Date("2026-03-01T09:10:00.000Z").toISOString(),
  amount: "1500.00",
  currency: "BRL",
  sourceSystem: "normalizer",
  sourceReference: "EXT-REF-001", // ← same reference as record 1
  normalizationVersion: "1.0.0",
  normalizationWorkerId: "worker-42",
  parties: [
    {
      partyId: "party-company-abc",
      role: "payee",
      direction: "in",
      amount: "1500.00",
    },
  ],
  objects: [
    {
      objectId: "obj-commission-receivable-001",
      objectType: "commission_receivable",
      relation: "settles",
    },
  ],
  reason: {
    type: "commission_payment",
    description: "Monthly commission payment from partner ABC (resubmission)",
    confidence: "high",
    requiresFollowup: false,
  },
  reporter: {
    reporterType: "system",
    reporterId: "normalizer-worker-42",
    channel: "batch",
  },
};

// ─── Wiring ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const ledgerRepo = new InMemoryLedgerEventRepository();
  const rejectedRepo = new InMemoryRejectedEventRepository();
  const stagingRepo = new InMemoryStagingRepository([
    validRecord,
    invalidAmountRecord,
    duplicateRecord,
  ]);

  const validator = new StagingRecordValidator(ledgerRepo);
  const createUseCase = new CreateLedgerEventUseCase(ledgerRepo);
  const rejectUseCase = new RejectLedgerEventUseCase(rejectedRepo);

  const job = new ProcessStagingJob(stagingRepo, validator, createUseCase, rejectUseCase);

  console.log("=".repeat(60));
  console.log("  ProcessStagingJob — dev simulation");
  console.log("=".repeat(60));
  console.log(`  Seeded ${3} staging records\n`);

  await job.run();

  // ─── Report outcomes ──────────────────────────────────────────────────────

  const seeds = [validRecord, invalidAmountRecord, duplicateRecord];

  console.log("─".repeat(60));
  console.log("  Outcomes");
  console.log("─".repeat(60));

  for (const seed of seeds) {
    const registered = ledgerRepo
      .getAll()
      .find((e) => e.source.reference === seed.sourceReference);

    const rejected = rejectedRepo
      .getAll()
      .find((e) => e.stagingId.value === seed.id);

    if (registered) {
      console.log(
        `[REGISTERED] staging=${seed.id} | ref=${seed.sourceReference} | hash=${registered.hash.value.slice(0, 16)}...`,
      );
    } else if (rejected) {
      const reasons = rejected.reasons
        .map((r) => `${r.type}: ${r.description}`)
        .join("\n               ");
      console.log(
        `[REJECTED]   staging=${seed.id} | ref=${seed.sourceReference}\n               ${reasons}`,
      );
    } else {
      console.log(`[UNKNOWN]    staging=${seed.id} — no outcome recorded`);
    }
  }

  console.log("─".repeat(60));
  console.log(
    `  Done — registered: ${ledgerRepo.getAll().length}, rejected: ${rejectedRepo.getAll().length}`,
  );
  console.log("=".repeat(60));
}

main().catch((err: unknown) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
