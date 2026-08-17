import "reflect-metadata";
import { AppDataSource, ensureDatabaseDirectory } from "./infra/database/data-source";
import { TypeOrmLedgerEventRepository } from "./infra/persistence/typeorm/TypeOrmLedgerEventRepository";
import { SqliteRejectedEventRepository } from "./infra/persistence/sqlite/SqliteRejectedEventRepository";
import { SqliteStagingRepository } from "./infra/persistence/sqlite/SqliteStagingRepository";
import { StagingRecordValidator } from "./core/application/services/StagingRecordValidator";
import { SubmitCandidateUseCase } from "./core/application/use-cases/SubmitCandidateUseCase";
import { ReceiptLineageResolver } from "./core/application/services/ReceiptLineageResolver";
import { CashEventListingService } from "./core/application/services/CashEventListingService";
import { CashPositionService } from "./core/application/services/CashPositionService";
import { CashStatementService } from "./core/application/services/CashStatementService";
import { PositionProjectionService } from "./core/application/services/PositionProjectionService";
import { CreateLedgerEventUseCase } from "./core/application/use-cases/CreateLedgerEventUseCase";
import { RejectLedgerEventUseCase } from "./core/application/use-cases/RejectLedgerEventUseCase";
import { StagingPostingJob } from "./infra/jobs/StagingPostingJob";
import { createServer } from "./presentation/web/api/server";
import { FileAuditLogger } from "./infra/audit/FileAuditLogger";
import { env } from "./config/env";

async function bootstrap(): Promise<void> {
  // ── The book's file ────────────────────────────────────────────────────────
  // One SQLite database holds the confirmed events, the candidates awaiting promotion and the
  // refusals. The directory is created first so a first boot on an empty volume works.
  ensureDatabaseDirectory();
  await AppDataSource.initialize();

  // ── Repositories ───────────────────────────────────────────────────────────
  const ledgerRepo = new TypeOrmLedgerEventRepository(AppDataSource);
  const rejectedRepo = new SqliteRejectedEventRepository(AppDataSource);
  const stagingRepo = new SqliteStagingRepository(AppDataSource);

  // ── Application ────────────────────────────────────────────────────────────
  const audit = new FileAuditLogger(env.AUDIT_LOG_DIR);
  const positionService = new PositionProjectionService(ledgerRepo);
  const cashPositionService = new CashPositionService(ledgerRepo);
  const cashStatementService = new CashStatementService(
    ledgerRepo,
    env.USINA_PARTY_ID,
  );
  const cashListingService = new CashEventListingService(ledgerRepo);
  const validator = new StagingRecordValidator(ledgerRepo);
  const createUseCase = new CreateLedgerEventUseCase(ledgerRepo, audit);
  const rejectUseCase = new RejectLedgerEventUseCase(rejectedRepo, audit);
  const lineageResolver = new ReceiptLineageResolver(ledgerRepo);
  const job = new StagingPostingJob(
    stagingRepo,
    validator,
    createUseCase,
    rejectUseCase,
    lineageResolver,
  );

  // ── Staging job (runs once on boot, extend to interval/cron as needed) ─────
  await job.run();

  // ── Readiness probe ────────────────────────────────────────────────────────
  // Pings the book's file; a failure is reported as `false`, never thrown, so /ready
  // can return 503 (route traffic away) without crashing the process.
  const readiness = async () => {
    const database = await AppDataSource.query("SELECT 1")
      .then(() => true)
      .catch(() => false);
    return { database };
  };

  // ── User App submission ──────────────────────────────────────────────────────
  const submitCandidate = new SubmitCandidateUseCase(validator, createUseCase, ledgerRepo);

  // ── HTTP server ────────────────────────────────────────────────────────────
  const app = createServer({
    ledgerRepo,
    rejectedRepo,
    stagingRepo,
    positionService,
    usinaPartyId: env.USINA_PARTY_ID,
    cashPositionService,
    cashStatementService,
    cashListingService,
    readiness,
    submitCandidate,
    serviceToken: env.LEDGER_SUBMIT_TOKEN,
  });

  const server = app.listen(env.SERVER_PORT, () => {
    console.log(`Ledger service running on port ${env.SERVER_PORT}`);
  });

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    console.log(`${signal} received — shutting down`);
    server.close(async () => {
      await AppDataSource.destroy();
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

bootstrap().catch((err: unknown) => {
  console.error("Fatal error during bootstrap:", err);
  process.exit(1);
});
