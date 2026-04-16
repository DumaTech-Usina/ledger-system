import 'reflect-metadata';
import { AppDataSource } from './infra/database/data-source';
import { getMongoDb, closeMongoDb } from './infra/database/mongo-client';
import { TypeOrmLedgerEventRepository } from './infra/persistence/typeorm/TypeOrmLedgerEventRepository';
import { MongoRejectedEventRepository } from './infra/persistence/mongodb/MongoRejectedEventRepository';
import { MongoStagingRepository } from './infra/persistence/mongodb/MongoStagingRepository';
import { StagingRecordValidator } from './core/application/services/StagingRecordValidator';
import { CreateLedgerEventUseCase } from './core/application/use-cases/CreateLedgerEventUseCase';
import { RejectLedgerEventUseCase } from './core/application/use-cases/RejectLedgerEventUseCase';
import { ProcessStagingJob } from './infra/jobs/ProcessStagingJob';
import { createServer } from './presentation/web/api/server';
import { FileAuditLogger } from './infra/audit/FileAuditLogger';
import { env } from './config/env';

async function bootstrap(): Promise<void> {
  // ── Databases ──────────────────────────────────────────────────────────────
  await AppDataSource.initialize();
  const mongoDb = await getMongoDb();

  // ── Repositories ───────────────────────────────────────────────────────────
  const ledgerRepo = new TypeOrmLedgerEventRepository(AppDataSource);
  const rejectedRepo = new MongoRejectedEventRepository(mongoDb);
  const stagingRepo = new MongoStagingRepository(mongoDb);

  // ── Application ────────────────────────────────────────────────────────────
  const audit = new FileAuditLogger(env.AUDIT_LOG_DIR);
  const validator = new StagingRecordValidator(ledgerRepo);
  const createUseCase = new CreateLedgerEventUseCase(ledgerRepo, audit);
  const rejectUseCase = new RejectLedgerEventUseCase(rejectedRepo, audit);
  const job = new ProcessStagingJob(stagingRepo, validator, createUseCase, rejectUseCase);

  // ── Staging job (runs once on boot, extend to interval/cron as needed) ─────
  await job.run();

  // ── HTTP server ────────────────────────────────────────────────────────────
  const app = createServer({ ledgerRepo, rejectedRepo, stagingRepo });

  const server = app.listen(env.SERVER_PORT, () => {
    console.log(`Ledger service running on port ${env.SERVER_PORT}`);
  });

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    console.log(`${signal} received — shutting down`);
    server.close(async () => {
      await AppDataSource.destroy();
      await closeMongoDb();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err: unknown) => {
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
