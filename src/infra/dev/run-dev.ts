import { CreateLedgerEventUseCase } from "../../core/application/use-cases/CreateLedgerEventUseCase";
import { RejectLedgerEventUseCase } from "../../core/application/use-cases/RejectLedgerEventUseCase";
import { StagingRecordValidator } from "../../core/application/services/StagingRecordValidator";
import { StagingRecord } from "../../core/application/dtos/StagingRecord";
import { InMemoryLedgerEventRepository } from "../persistence/ledger/InMemoryLedgerEventRepository";
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

// ─── Position A — SETTLED: Comissão a Receber (originated Feb 15, settled Feb 20) ──

const a1: StagingRecord = {
  id: "stg-a1",
  status: "pending",
  eventType: "commission_received",
  economicEffect: "cash_in",
  occurredAt: d("2026-02-15T10:00:00Z"),
  amount: "4500.00",
  currency: "BRL",
  sourceSystem: "normalizer",
  sourceReference: "COM-A-ORIG",
  normalizationVersion: NORM_VERSION,
  normalizationWorkerId: WORKER,
  parties: [{ partyId: "party-partner-xyz", role: "payee", direction: "in", amount: "4500.00" }],
  objects: [{ objectId: "obj-com-rec-a", objectType: "commission_receivable", relation: "originates" }],
  reason: { type: "commission_payment", description: "Comissão mensal parceiro XYZ — originação", confidence: "high", requiresFollowup: false },
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
  parties: [{ partyId: "party-partner-xyz", role: "payee", direction: "in", amount: "4500.00" }],
  objects: [{ objectId: "obj-com-rec-a", objectType: "commission_receivable", relation: "settles" }],
  reason: { type: "commission_payment", description: "Comissão mensal parceiro XYZ — liquidação confirmada", confidence: "high", requiresFollowup: false },
  reporter: { reporterType: "system", reporterId: WORKER, channel: "batch" },
};

// ─── Position B — SETTLED: Adiantamento a Parceiro (originated Feb 20, settled Mar 05) ──

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
  parties: [{ partyId: "party-merchant-b", role: "payee", direction: "out", amount: "12000.00" }],
  objects: [{ objectId: "obj-adv-b", objectType: "advance", relation: "originates" }],
  reason: { type: "advance_payment", description: "Adiantamento capital de giro parceiro B", confidence: "high", requiresFollowup: false },
  reporter: { reporterType: "system", reporterId: WORKER, channel: "batch" },
};

const b2: StagingRecord = {
  id: "stg-b2",
  status: "pending",
  eventType: "advance_payment",
  economicEffect: "non_cash",
  occurredAt: d("2026-03-05T11:00:00Z"),
  amount: "12000.00",
  currency: "BRL",
  sourceSystem: "normalizer",
  sourceReference: "ADV-B-SETTLE",
  normalizationVersion: NORM_VERSION,
  normalizationWorkerId: WORKER,
  parties: [{ partyId: "party-merchant-b", role: "payee", direction: "neutral" }],
  objects: [{ objectId: "obj-adv-b", objectType: "advance", relation: "settles" }],
  reason: { type: "advance_payment", description: "Adiantamento capital de giro parceiro B — liquidado via repasse de comissão", confidence: "high", requiresFollowup: false },
  reporter: { reporterType: "system", reporterId: WORKER, channel: "batch" },
};

// ─── Position C — OPEN: Comissão a Receber sem liquidação (Mar 01) ───────────

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
  parties: [{ partyId: "party-partner-abc", role: "payee", direction: "in", amount: "2750.00" }],
  objects: [{ objectId: "obj-com-rec-c", objectType: "commission_receivable", relation: "originates" }],
  reason: { type: "commission_payment", description: "Comissão Q1 parceiro ABC — aguardando confirmação bancária", confidence: "medium", requiresFollowup: false },
  reporter: { reporterType: "system", reporterId: WORKER, channel: "batch" },
};

// ─── Position D — OPEN: Adiantamento não liquidado (Mar 01) ─────────────────

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
  parties: [{ partyId: "party-merchant-d", role: "payee", direction: "out", amount: "8500.00" }],
  objects: [{ objectId: "obj-adv-d", objectType: "advance", relation: "originates" }],
  reason: { type: "advance_payment", description: "Adiantamento parceiro D — pendente de liquidação", confidence: "high", requiresFollowup: false },
  reporter: { reporterType: "system", reporterId: WORKER, channel: "batch" },
};

// ─── Position E — REVERSED: Isenção de comissão estornada (Mar 08 → Mar 09) ──

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
  parties: [{ partyId: "party-partner-xyz", role: "payee", direction: "neutral" }],
  objects: [{ objectId: "obj-com-ent-e", objectType: "commission_entitlement", relation: "settles" }],
  reason: { type: "commission_waiver", description: "Isenção de comissão — acordo contratual Q1", confidence: "high", requiresFollowup: false },
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
  parties: [{ partyId: "party-partner-xyz", role: "payee", direction: "neutral" }],
  objects: [{ objectId: "obj-com-ent-e", objectType: "commission_entitlement", relation: "reverses" }],
  reason: { type: "commission_waiver", description: "Estorno da isenção — contrato renegociado", confidence: "high", requiresFollowup: false },
  reporter: { reporterType: "integration", reporterId: "ops-team", channel: "manual-override" },
};

// ─── Position C — settlement (closes position C, Mar 11) ─────────────────────

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
  parties: [{ partyId: "party-partner-abc", role: "payee", direction: "in", amount: "2750.00" }],
  objects: [{ objectId: "obj-com-rec-c", objectType: "commission_receivable", relation: "settles" }],
  reason: { type: "commission_payment", description: "Comissão Q1 parceiro ABC — confirmação bancária recebida", confidence: "high", requiresFollowup: false },
  reporter: { reporterType: "system", reporterId: WORKER, channel: "batch" },
};

// ─── Position G — OPEN: Conta a pagar recente (now) ──────────────────────────

const g1: StagingRecord = {
  id: "stg-g1",
  status: "pending",
  eventType: "advance_payment",
  economicEffect: "cash_out",
  occurredAt: new Date().toISOString(),
  amount: "6200.00",
  currency: "BRL",
  sourceSystem: "normalizer",
  sourceReference: "ADV-G-NOW",
  normalizationVersion: NORM_VERSION,
  normalizationWorkerId: WORKER,
  parties: [{ partyId: "party-merchant-g", role: "payee", direction: "out", amount: "6200.00" }],
  objects: [{ objectId: "obj-adv-g", objectType: "advance", relation: "originates" }],
  reason: { type: "advance_payment", description: "Adiantamento urgente parceiro G — aprovado agora", confidence: "high", requiresFollowup: false },
  reporter: { reporterType: "integration", reporterId: "ops-team", channel: "manual-override" },
};

// ─── Position F — OPEN >30 days: Adiantamento antigo (Jan 10) ────────────────

const f1: StagingRecord = {
  id: "stg-f1",
  status: "pending",
  eventType: "advance_payment",
  economicEffect: "cash_out",
  occurredAt: d("2026-01-10T08:00:00Z"),
  amount: "25000.00",
  currency: "BRL",
  sourceSystem: "normalizer",
  sourceReference: "ADV-F-OLD",
  normalizationVersion: NORM_VERSION,
  normalizationWorkerId: WORKER,
  parties: [{ partyId: "party-merchant-f", role: "payee", direction: "out", amount: "25000.00" }],
  objects: [{ objectId: "obj-adv-f", objectType: "advance", relation: "originates" }],
  reason: { type: "advance_payment", description: "Adiantamento parceiro F — pendente liquidação há mais de 30 dias", confidence: "high", requiresFollowup: false },
  reporter: { reporterType: "system", reporterId: WORKER, channel: "batch" },
};

// ─── Rejected records ─────────────────────────────────────────────────────────

const r1: StagingRecord = {
  id: "stg-r1",
  status: "pending",
  eventType: "payroll_payment",
  economicEffect: "cash_out",
  occurredAt: d("2026-03-10T09:00:00Z"),
  amount: "9999.999",        // invalid: 3 decimal places
  currency: "BRL",
  sourceSystem: "normalizer",
  sourceReference: "PAY-R1-BAD",
  normalizationVersion: NORM_VERSION,
  normalizationWorkerId: WORKER,
  parties: [{ partyId: "party-employee-001", role: "payee", direction: "out", amount: "9999.999" }],
  objects: [{ objectId: "obj-payroll-r1", objectType: "payroll", relation: "settles" }],
  reason: { type: "payroll_payment", description: "Folha março — valor com formato inválido", confidence: "high", requiresFollowup: false },
  reporter: { reporterType: "system", reporterId: WORKER, channel: "batch" },
};

const r2: StagingRecord = {
  id: "stg-r2",
  status: "pending",
  eventType: "commission_received",
  economicEffect: "cash_in",
  occurredAt: d("2026-03-11T07:00:00Z"),
  amount: "4500.00",
  currency: "BRL",
  sourceSystem: "normalizer",
  sourceReference: "COM-A-ORIG",  // duplicate of stg-a1 sourceReference
  normalizationVersion: NORM_VERSION,
  normalizationWorkerId: WORKER,
  parties: [{ partyId: "party-partner-xyz", role: "payee", direction: "in", amount: "4500.00" }],
  objects: [{ objectId: "obj-com-rec-a", objectType: "commission_receivable", relation: "originates" }],
  reason: { type: "commission_payment", description: "Reenvio acidental pelo normalizador", confidence: "high", requiresFollowup: false },
  reporter: { reporterType: "system", reporterId: WORKER, channel: "batch" },
};

const r3: StagingRecord = {
  id: "stg-r3",
  status: "pending",
  eventType: "infrastructure_expense",
  economicEffect: "cash_out",
  occurredAt: d("2026-03-11T08:00:00Z"),
  amount: "1200.00",
  currency: "BRL",
  // sourceSystem intentionally omitted → INVALID_SCHEMA
  sourceReference: "INFRA-R3-NOSS",
  normalizationVersion: NORM_VERSION,
  normalizationWorkerId: WORKER,
  parties: [{ partyId: "party-vendor-cloud", role: "payee", direction: "out", amount: "1200.00" }],
  objects: [{ objectId: "obj-infra-r3", objectType: "infrastructure_cost", relation: "settles" }],
  reason: { type: "infrastructure_expense", description: "Custo cloud — sistema de origem ausente no payload", confidence: "medium", requiresFollowup: false },
  reporter: { reporterType: "system", reporterId: WORKER, channel: "batch" },
};

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const ledgerRepo = new InMemoryLedgerEventRepository();
  const rejectedRepo = new InMemoryRejectedEventRepository();

  const allSeeds = [a1, a2, b1, b2, c1, c2, d1, e1, e2, f1, g1, r1, r2, r3];
  const stagingRepo = new InMemoryStagingRepository(allSeeds);

  const validator = new StagingRecordValidator(ledgerRepo);
  const createUseCase = new CreateLedgerEventUseCase(ledgerRepo);
  const rejectUseCase = new RejectLedgerEventUseCase(rejectedRepo);
  const job = new ProcessStagingJob(stagingRepo, validator, createUseCase, rejectUseCase);

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
    const reg = allEvents.find((e) => e.source.reference === seed.sourceReference);
    const rej = allRejected.find((e) => e.stagingId.value === seed.id);

    if (reg) {
      console.log(`  [OK] ${seed.id.padEnd(10)} ${seed.sourceReference}`);
    } else if (rej) {
      const types = rej.reasons.map((r) => r.type).join(", ");
      console.log(`  [RJ] ${seed.id.padEnd(10)} ${seed.sourceReference} — ${types}`);
    }
  }

  console.log("─".repeat(64));
  console.log(`  Registrados: ${allEvents.length}  |  Rejeitados: ${allRejected.length}`);
  console.log("=".repeat(64));

  const PORT = 3000;
  const app = createServer({ ledgerRepo, rejectedRepo, stagingRepo });

  app.listen(PORT, () => {
    console.log(`\n  Dashboard financeiro disponível em http://localhost:${PORT}`);
    console.log("  Pressione Ctrl+C para encerrar.\n");
  });
}

main().catch((err: unknown) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
