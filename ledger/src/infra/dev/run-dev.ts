import { CreateLedgerEventUseCase } from "../../core/application/use-cases/CreateLedgerEventUseCase";
import { RejectLedgerEventUseCase } from "../../core/application/use-cases/RejectLedgerEventUseCase";
import { FileAuditLogger } from "../audit/FileAuditLogger";
import { StagingRecordValidator } from "../../core/application/services/StagingRecordValidator";
import { CashEventListingService } from "../../core/application/services/CashEventListingService";
import { CashPositionService } from "../../core/application/services/CashPositionService";
import { CashStatementService } from "../../core/application/services/CashStatementService";
import { PositionProjectionService } from "../../core/application/services/PositionProjectionService";
import { StagingRecord } from "../../core/application/dtos/StagingRecord";
import { InMemoryLedgerEventRepository } from "../persistence/memory/InMemoryLedgerEventRepository";
import { InMemoryRejectedEventRepository } from "../persistence/rejected/InMemoryRejectedEventRepository";
import { InMemoryStagingRepository } from "../persistence/staging/InMemoryStagingRepository";
import { ProcessStagingJob } from "../jobs/ProcessStagingJob";
import { createServer } from "../../presentation/web/api/server";

// ─── Seed helpers ─────────────────────────────────────────────────────────────

const WORKER = "normalizer-worker-42";
const NORM_VERSION = "1.0.0";

function d(iso: string): string {
  return new Date(iso).toISOString();
}

// ─── Position A — Comissão originada e depois recebida da operadora ──

const a1: StagingRecord = {
  id: "stg-a1",
  status: "pending",
  eventType: "commission_received",
  economicEffect: "cash_in",
  occurredAt: d("2026-02-20T14:00:00Z"),
  amount: "4500.00",
  currency: "BRL",
  sourceSystem: "normalizer",
  sourceReference: "COM-A-SETTLE",
  normalizationVersion: NORM_VERSION,
  normalizationWorkerId: WORKER,
  parties: [
    {
      partyId: "party-operadora-a",
      role: "payer",
      direction: "neutral",
    },
    {
      partyId: "party-usina",
      role: "payee",
      direction: "in",
      amount: "4500.00",
    },
  ],
  objects: [
    {
      objectId: "obj-com-rec-a",
      objectType: "commission_receivable",
      relation: "settles",
    },
  ],
  reason: {
    type: "commission_payment",
    description: "Pagamento de comissão recebido da operadora",
    confidence: "high",
    requiresFollowup: false,
  },
  reporter: { reporterType: "system", reporterId: WORKER, channel: "batch" },
};

const a2: StagingRecord = {
  id: "stg-a2",
  status: "pending",
  eventType: "commission_received",
  economicEffect: "cash_in",
  occurredAt: d("2026-02-20T14:00:00Z"),
  amount: "4500.00",
  currency: "BRL",
  sourceSystem: "normalizer",
  sourceReference: "COM-A-SETTLE",
  normalizationVersion: NORM_VERSION,
  normalizationWorkerId: WORKER,
  parties: [
    {
      partyId: "party-partner-xyz",
      role: "payee",
      direction: "in",
      amount: "4500.00",
    },
  ],
  objects: [
    {
      objectId: "obj-com-rec-a",
      objectType: "commission_receivable",
      relation: "settles",
    },
  ],
  reason: {
    type: "commission_payment",
    description: "Pagamento de comissão recebido da operadora",
    confidence: "high",
    requiresFollowup: false,
  },
  reporter: { reporterType: "system", reporterId: WORKER, channel: "batch" },
};

// ─── Position B — Adiantamento ao corretor e posterior compensação ──

const b1: StagingRecord = {
  id: "stg-b1",
  status: "pending",
  eventType: "advance_payment",
  economicEffect: "cash_out",
  occurredAt: d("2026-02-20T09:00:00Z"),
  amount: "12000.00",
  currency: "BRL",
  sourceSystem: "normalizer",
  sourceReference: "ADV-B-ORIG",
  normalizationVersion: NORM_VERSION,
  normalizationWorkerId: WORKER,
  parties: [
    {
      partyId: "party-usina",
      role: "payer",
      direction: "out",
      amount: "12000.00",
    },
    {
      partyId: "party-merchant-b",
      role: "payee",
      direction: "neutral",
    },
  ],
  objects: [
    { objectId: "obj-adv-b", objectType: "advance", relation: "originates" },
  ],
  reason: {
    type: "advance_payment",
    description: "Adiantamento pago ao parceiro sobre comissão futura",
    confidence: "high",
    requiresFollowup: false,
  },
  reporter: { reporterType: "system", reporterId: WORKER, channel: "batch" },
};

const b2: StagingRecord = {
  id: "stg-b2",
  status: "pending",
  eventType: "commission_split",
  economicEffect: "cash_internal",
  occurredAt: d("2026-03-05T11:00:00Z"),
  amount: "12000.00",
  currency: "BRL",
  sourceSystem: "normalizer",
  sourceReference: "ADV-B-SETTLE",
  normalizationVersion: NORM_VERSION,
  normalizationWorkerId: WORKER,
  parties: [
    {
      partyId: "party-usina",
      role: "payer",
      direction: "out",
      amount: "12000.00",
    },
    {
      partyId: "party-merchant-b",
      role: "payee",
      direction: "in",
      amount: "12000.00",
    },
  ],
  objects: [
    {
      objectId: "obj-adv-b",
      objectType: "advance",
      relation: "adjusts",
    },
  ],
  reason: {
    type: "commission_split",
    description: "Compensação do adiantamento via comissão",
    confidence: "high",
    requiresFollowup: false,
  },
  reporter: {
    reporterType: "system",
    reporterId: WORKER,
    channel: "batch",
  },
};

// ─── Position C — Comissão aguardando pagamento ──

const c1: StagingRecord = {
  id: "stg-c1",
  status: "pending",
  eventType: "commission_received",
  economicEffect: "cash_in",
  occurredAt: d("2026-03-01T08:30:00Z"),
  amount: "2750.00",
  currency: "BRL",
  sourceSystem: "normalizer",
  sourceReference: "COM-C-ORIG",
  normalizationVersion: NORM_VERSION,
  normalizationWorkerId: WORKER,
  parties: [
    {
      partyId: "party-operadora-c",
      role: "payer",
      direction: "neutral",
    },
    {
      partyId: "party-usina",
      role: "payee",
      direction: "in",
      amount: "2750.00",
    },
  ],
  objects: [
    {
      objectId: "obj-com-rec-c",
      objectType: "commission_receivable",
      relation: "settles",
    },
  ],
  reason: {
    type: "commission_payment",
    description: "Pagamento de comissão identificado",
    confidence: "medium",
    requiresFollowup: true,
  },
  reporter: { reporterType: "system", reporterId: WORKER, channel: "batch" },
};

const c2: StagingRecord = {
  id: "stg-c2",
  status: "pending",
  eventType: "commission_received",
  economicEffect: "cash_in",
  occurredAt: d("2026-03-11T10:00:00Z"),
  amount: "2750.00",
  currency: "BRL",
  sourceSystem: "normalizer",
  sourceReference: "COM-C-SETTLE",
  normalizationVersion: NORM_VERSION,
  normalizationWorkerId: WORKER,
  parties: [
    {
      partyId: "party-operadora-c",
      role: "payer",
      direction: "neutral",
    },
    {
      partyId: "party-usina",
      role: "payee",
      direction: "in",
      amount: "2750.00",
    },
  ],
  objects: [
    {
      objectId: "obj-com-rec-c",
      objectType: "commission_receivable",
      relation: "settles",
    },
  ],
  reason: {
    type: "commission_payment",
    description: "Pagamento da comissão confirmado",
    confidence: "high",
    requiresFollowup: false,
  },
  reporter: { reporterType: "system", reporterId: WORKER, channel: "batch" },
};

// ─── Position D — Adiantamento não liquidado ──

const d1: StagingRecord = {
  id: "stg-d1",
  status: "pending",
  eventType: "advance_payment",
  economicEffect: "cash_out",
  occurredAt: d("2026-03-01T09:00:00Z"),
  amount: "8500.00",
  currency: "BRL",
  sourceSystem: "normalizer",
  sourceReference: "ADV-D-ORIG",
  normalizationVersion: NORM_VERSION,
  normalizationWorkerId: WORKER,
  parties: [
    {
      partyId: "party-usina",
      role: "payer",
      direction: "out",
      amount: "8500.00",
    },
  ],
  objects: [
    {
      objectId: "obj-adv-d",
      objectType: "advance",
      relation: "originates",
    },
  ],
  reason: {
    type: "advance_payment",
    description: "Adiantamento pago aguardando compensação futura",
    confidence: "high",
    requiresFollowup: false,
  },
  reporter: {
    reporterType: "integration",
    reporterId: "ops-team",
    channel: "manual-override",
  },
};

// ─── Position E — Isenção e estorno de comissão ──

const e1: StagingRecord = {
  id: "stg-e1",
  status: "pending",
  eventType: "commission_waiver",
  economicEffect: "non_cash",
  occurredAt: d("2026-03-08T10:00:00Z"),
  amount: "3000.00",
  currency: "BRL",
  sourceSystem: "normalizer",
  sourceReference: "WAIVER-E-ORIG",
  normalizationVersion: NORM_VERSION,
  normalizationWorkerId: WORKER,
  parties: [
    {
      partyId: "party-partner-xyz",
      role: "payee",
      direction: "neutral",
    },
  ],
  objects: [
    {
      objectId: "obj-com-ent-e",
      objectType: "commission_entitlement",
      relation: "settles",
    },
  ],
  reason: {
    type: "commission_waiver",
    description: "Isenção concedida de comissão",
    confidence: "high",
    requiresFollowup: false,
  },
  reporter: { reporterType: "system", reporterId: WORKER, channel: "batch" },
};

const e2: StagingRecord = {
  id: "stg-e2",
  status: "pending",
  eventType: "commission_waiver",
  economicEffect: "non_cash",
  occurredAt: d("2026-03-09T11:00:00Z"),
  amount: "3000.00",
  currency: "BRL",
  sourceSystem: "normalizer",
  sourceReference: "WAIVER-E-REV",
  normalizationVersion: NORM_VERSION,
  normalizationWorkerId: WORKER,
  previousHash: "dev-reversal-placeholder",
  parties: [
    {
      partyId: "party-partner-xyz",
      role: "payee",
      direction: "neutral",
    },
  ],
  objects: [
    {
      objectId: "obj-com-ent-e",
      objectType: "commission_entitlement",
      relation: "reverses",
    },
  ],
  reason: {
    type: "commission_waiver",
    description: "Estorno da isenção de comissão",
    confidence: "high",
    requiresFollowup: false,
  },
  reporter: {
    reporterType: "integration",
    reporterId: "ops-team",
    channel: "manual-override",
  },
};

// ─────────────────────────────────────────────────────────────
// Comissão recebida da operadora
// ─────────────────────────────────────────────────────────────

const commissionReceived: StagingRecord = {
  id: "stg-001",
  status: "pending",
  eventType: "commission_received",
  economicEffect: "cash_in",
  occurredAt: d("2026-03-01T10:00:00Z"),
  amount: "5000.00",
  currency: "BRL",
  sourceSystem: "normalizer",
  sourceReference: "COM-001",
  normalizationVersion: NORM_VERSION,
  normalizationWorkerId: WORKER,
  parties: [
    {
      partyId: "party-operadora",
      role: "payer",
      direction: "neutral",
    },
    {
      partyId: "party-usina",
      role: "payee",
      direction: "in",
      amount: "5000.00",
    },
  ],
  objects: [
    {
      objectId: "obj-commission-001",
      objectType: "commission_receivable",
      relation: "settles",
    },
  ],
  reason: {
    type: "commission_payment",
    description: "Recebimento de comissão da operadora",
    confidence: "high",
    requiresFollowup: false,
  },
  reporter: { reporterType: "system", reporterId: WORKER, channel: "batch" },
};

// ─────────────────────────────────────────────────────────────
// Adiantamento ao corretor
// ─────────────────────────────────────────────────────────────

const advancePayment: StagingRecord = {
  id: "stg-003",
  status: "pending",
  eventType: "advance_payment",
  economicEffect: "cash_out",
  occurredAt: d("2026-03-02T09:00:00Z"),
  amount: "2000.00",
  currency: "BRL",
  sourceSystem: "normalizer",
  sourceReference: "ADV-001",
  normalizationVersion: NORM_VERSION,
  normalizationWorkerId: WORKER,
  parties: [
    {
      partyId: "party-usina",
      role: "payer",
      direction: "out",
      amount: "2000.00",
    },
  ],
  objects: [
    {
      objectId: "obj-advance-001",
      objectType: "advance",
      relation: "originates",
    },
  ],
  reason: {
    type: "advance_payment",
    description: "Adiantamento ao corretor sobre comissão futura",
    confidence: "high",
    requiresFollowup: false,
  },
  reporter: {
    reporterType: "integration",
    reporterId: "ops",
    channel: "manual",
  },
};

// ─────────────────────────────────────────────────────────────
// Compensação do adiantamento via comissão
// ─────────────────────────────────────────────────────────────

const advanceSettlement: StagingRecord = {
  id: "stg-004",
  status: "pending",
  eventType: "advance_settlement",
  economicEffect: "non_cash",
  occurredAt: d("2026-03-10T10:00:00Z"),
  amount: "2000.00",
  currency: "BRL",
  sourceSystem: "normalizer",
  sourceReference: "ADV-SET-001",
  normalizationVersion: NORM_VERSION,
  normalizationWorkerId: WORKER,
  parties: [
    {
      partyId: "party-corretor-001",
      role: "debtor",
      direction: "neutral",
    },
  ],
  objects: [
    {
      objectId: "obj-advance-001",
      objectType: "advance",
      relation: "settles",
    },
  ],
  reason: {
    type: "advance_settlement",
    description: "Compensação do adiantamento com comissão",
    confidence: "high",
    requiresFollowup: false,
  },
  reporter: { reporterType: "system", reporterId: WORKER, channel: "batch" },
};

// ─────────────────────────────────────────────────────────────
// Multa paga pela Usina
// ─────────────────────────────────────────────────────────────

const finePayment: StagingRecord = {
  id: "stg-005",
  status: "pending",
  eventType: "penalty_payment",
  economicEffect: "cash_out",
  occurredAt: d("2026-03-05T11:00:00Z"),
  amount: "750.00",
  currency: "BRL",
  sourceSystem: "normalizer",
  sourceReference: "FINE-001",
  normalizationVersion: NORM_VERSION,
  normalizationWorkerId: WORKER,
  parties: [
    {
      partyId: "party-usina",
      role: "payer",
      direction: "out",
      amount: "750.00",
    },
  ],
  objects: [
    {
      objectId: "obj-fine-001",
      objectType: "penalty",
      relation: "settles",
    },
  ],
  reason: {
    type: "penalty_payment",
    description: "Pagamento de multa à operadora",
    confidence: "high",
    requiresFollowup: false,
  },
  reporter: {
    reporterType: "integration",
    reporterId: "ops",
    channel: "manual",
  },
};

// ─────────────────────────────────────────────────────────────
// Despesa operacional
// ─────────────────────────────────────────────────────────────

const infraExpense: StagingRecord = {
  id: "stg-006",
  status: "pending",
  eventType: "infrastructure_expense",
  economicEffect: "cash_out",
  occurredAt: d("2026-03-06T08:00:00Z"),
  amount: "1200.00",
  currency: "BRL",
  sourceSystem: "normalizer",
  sourceReference: "INFRA-001",
  normalizationVersion: NORM_VERSION,
  normalizationWorkerId: WORKER,
  parties: [
    {
      partyId: "party-usina",
      role: "payer",
      direction: "out",
      amount: "1200.00",
    },
  ],
  objects: [
    {
      objectId: "obj-infra-001",
      objectType: "infrastructure_cost",
      relation: "settles",
    },
  ],
  reason: {
    type: "infrastructure_expense",
    description: "Pagamento de infraestrutura e servidores",
    confidence: "high",
    requiresFollowup: false,
  },
  reporter: { reporterType: "system", reporterId: WORKER, channel: "batch" },
};

// ─────────────────────────────────────────────────────────────
// Reversão de multa
// ─────────────────────────────────────────────────────────────

const fineReversal: StagingRecord = {
  id: "stg-007",
  status: "pending",
  eventType: "penalty_payment",
  economicEffect: "non_cash",
  occurredAt: d("2026-03-07T10:00:00Z"),
  amount: "750.00",
  currency: "BRL",
  sourceSystem: "normalizer",
  sourceReference: "FINE-REV-001",
  normalizationVersion: NORM_VERSION,
  normalizationWorkerId: WORKER,
  previousHash: "dev-placeholder",
  parties: [
    {
      partyId: "party-operadora",
      role: "issuer",
      direction: "neutral",
    },
  ],
  objects: [
    {
      objectId: "obj-fine-001",
      objectType: "penalty",
      relation: "reverses",
    },
  ],
  reason: {
    type: "penalty_reversal",
    description: "Estorno de multa após revisão contratual",
    confidence: "high",
    requiresFollowup: false,
  },
  reporter: {
    reporterType: "integration",
    reporterId: "ops",
    channel: "manual",
  },
};

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const ledgerRepo = new InMemoryLedgerEventRepository();
  const rejectedRepo = new InMemoryRejectedEventRepository();

  const allSeeds = [
    a1,
    a2,
    b1,
    b2,
    c1,
    c2,
    d1,
    e1,
    e2,
    commissionReceived,
    advancePayment,
  ];
  const stagingRepo = new InMemoryStagingRepository(allSeeds);

  const audit = new FileAuditLogger("./logs/audit");
  const validator = new StagingRecordValidator(ledgerRepo);
  const createUseCase = new CreateLedgerEventUseCase(ledgerRepo, audit);
  const rejectUseCase = new RejectLedgerEventUseCase(rejectedRepo, audit);
  const job = new ProcessStagingJob(
    stagingRepo,
    validator,
    createUseCase,
    rejectUseCase,
  );

  console.log("=".repeat(64));
  console.log("  ProcessStagingJob — simulação financeira");
  console.log("=".repeat(64));
  console.log(`  ${allSeeds.length} registros de staging carregados\n`);

  await job.run();

  const allEvents = await ledgerRepo.findAll();
  const allRejected = await rejectedRepo.findAll();

  console.log("─".repeat(64));
  console.log("  Resultados");
  console.log("─".repeat(64));

  for (const seed of allSeeds) {
    const reg = allEvents.find(
      (e) => e.source.reference === seed.sourceReference,
    );
    const rej = allRejected.find((e) => e.stagingId.value === seed.id);

    if (reg) {
      console.log(`  [OK] ${seed.id.padEnd(10)} ${seed.sourceReference}`);
    } else if (rej) {
      const types = rej.reasons.map((r) => r.type).join(", ");
      console.log(
        `  [RJ] ${seed.id.padEnd(10)} ${seed.sourceReference} — ${types}`,
      );
    }
  }

  console.log("─".repeat(64));
  console.log(
    `  Registrados: ${allEvents.length}  |  Rejeitados: ${allRejected.length}`,
  );
  console.log("=".repeat(64));

  const PORT = 3000;
  const positionService    = new PositionProjectionService(ledgerRepo);
  const cashPositionService  = new CashPositionService(ledgerRepo);
  const cashStatementService = new CashStatementService(ledgerRepo, "party-usina");
  const cashListingService   = new CashEventListingService(ledgerRepo);
  const app = createServer({ ledgerRepo, rejectedRepo, stagingRepo, positionService, usinaPartyId: "party-usina", cashPositionService, cashStatementService, cashListingService });

  app.listen(PORT, () => {
    console.log(
      `\n  Dashboard financeiro disponível em http://localhost:${PORT}`,
    );
    console.log("  Pressione Ctrl+C para encerrar.\n");
  });
}

main().catch((err: unknown) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
