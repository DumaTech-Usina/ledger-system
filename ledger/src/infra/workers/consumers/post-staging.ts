import 'reflect-metadata';
import 'dotenv/config';
import { env } from '../../../config/env';
import { AppDataSource, ensureDatabaseDirectory } from '../../database/data-source';
import { TypeOrmLedgerEventRepository } from '../../persistence/typeorm/TypeOrmLedgerEventRepository';
import { SqliteRejectedEventRepository } from '../../persistence/sqlite/SqliteRejectedEventRepository';
import { SqliteStagingRepository } from '../../persistence/sqlite/SqliteStagingRepository';
import { FileAuditLogger } from '../../audit/FileAuditLogger';
import { StagingRecordValidator } from '../../../core/application/services/StagingRecordValidator';
import { ReceiptLineageResolver } from '../../../core/application/services/ReceiptLineageResolver';
import { CreateLedgerEventUseCase } from '../../../core/application/use-cases/CreateLedgerEventUseCase';
import { RejectLedgerEventUseCase } from '../../../core/application/use-cases/RejectLedgerEventUseCase';
import { StagingPostingJob } from '../../jobs/StagingPostingJob';
import { StagingWorker } from '../../messaging/rabbitmq/StagingWorker';

async function main(): Promise<void> {
  ensureDatabaseDirectory();
  await AppDataSource.initialize();

  const ledgerRepo   = new TypeOrmLedgerEventRepository(AppDataSource);
  const rejectedRepo = new SqliteRejectedEventRepository(AppDataSource);
  const stagingRepo  = new SqliteStagingRepository(AppDataSource);

  const audit        = new FileAuditLogger(env.AUDIT_LOG_DIR);
  const validator    = new StagingRecordValidator(ledgerRepo);
  const createUseCase = new CreateLedgerEventUseCase(ledgerRepo, audit);
  const rejectUseCase = new RejectLedgerEventUseCase(rejectedRepo, audit);
  const lineageResolver = new ReceiptLineageResolver(ledgerRepo);

  const job    = new StagingPostingJob(stagingRepo, validator, createUseCase, rejectUseCase, lineageResolver);
  const worker = new StagingWorker(env.RABBITMQ_URL, job, ['staging.receipt', 'staging.advance']);

  const shutdown = async (signal: string) => {
    console.log(`[post-staging] ${signal} — shutting down`);
    await AppDataSource.destroy();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  console.log('[post-staging] starting...');
  await worker.start();
}

main().catch((err) => {
  console.error('[post-staging] fatal:', err);
  process.exit(1);
});
