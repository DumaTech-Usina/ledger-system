import 'reflect-metadata';
import 'dotenv/config';
import { env } from '../../../config/env';
import { AppDataSource } from '../../database/data-source';
import { getMongoDb, closeMongoDb } from '../../database/mongo-client';
import { TypeOrmLedgerEventRepository } from '../../persistence/typeorm/TypeOrmLedgerEventRepository';
import { MongoRejectedEventRepository } from '../../persistence/mongodb/MongoRejectedEventRepository';
import { MongoStagingRepository } from '../../persistence/mongodb/MongoStagingRepository';
import { FileAuditLogger } from '../../audit/FileAuditLogger';
import { StagingRecordValidator } from '../../../core/application/services/StagingRecordValidator';
import { CreateLedgerEventUseCase } from '../../../core/application/use-cases/CreateLedgerEventUseCase';
import { RejectLedgerEventUseCase } from '../../../core/application/use-cases/RejectLedgerEventUseCase';
import { ProcessStagingJob } from '../../jobs/ProcessStagingJob';
import { StagingWorker } from '../../messaging/rabbitmq/StagingWorker';

async function main(): Promise<void> {
  await AppDataSource.initialize();
  const mongoDb = await getMongoDb();

  const ledgerRepo   = new TypeOrmLedgerEventRepository(AppDataSource);
  const rejectedRepo = new MongoRejectedEventRepository(mongoDb);
  const stagingRepo  = new MongoStagingRepository(mongoDb);

  const audit        = new FileAuditLogger(env.AUDIT_LOG_DIR);
  const validator    = new StagingRecordValidator(ledgerRepo);
  const createUseCase = new CreateLedgerEventUseCase(ledgerRepo, audit);
  const rejectUseCase = new RejectLedgerEventUseCase(rejectedRepo, audit);

  const job    = new ProcessStagingJob(stagingRepo, validator, createUseCase, rejectUseCase);
  const worker = new StagingWorker(env.RABBITMQ_URL, job, ['staging.receipt', 'staging.advance']);

  const shutdown = async (signal: string) => {
    console.log(`[post-staging] ${signal} — shutting down`);
    await AppDataSource.destroy();
    await closeMongoDb();
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
