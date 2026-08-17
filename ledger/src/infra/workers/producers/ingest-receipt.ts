import 'reflect-metadata';
import 'dotenv/config';
import { env } from '../../../config/env';
import { getMongoDatabase, closeMongoDb } from '../../database/mongo-client';
import { AppDataSource, ensureDatabaseDirectory } from '../../database/data-source';
import { SqliteStagingRepository } from '../../persistence/sqlite/SqliteStagingRepository';
import { MongoReceiptETLReader } from '../../etl/MongoReceiptETLReader';
import { ReceiptStagingBuilder } from '../../../core/application/services/ReceiptStagingBuilder';
import { ReceiptIngestJob } from '../../jobs/ReceiptIngestJob';

async function main(): Promise<void> {
  ensureDatabaseDirectory();
  await AppDataSource.initialize();
  const etlDb = await getMongoDatabase(env.MONGO_ETL_DB);

  const stagingRepo = new SqliteStagingRepository(AppDataSource);
  const reader = new MongoReceiptETLReader(etlDb);
  const builder = new ReceiptStagingBuilder(stagingRepo, env.USINA_PARTY_ID, 'receipt-etl', console.warn.bind(console));
  const etl = new ReceiptIngestJob(reader, builder);

  const shutdown = async (signal: string) => {
    console.log(`[ingest-receipt] ${signal} — shutting down`);
    await AppDataSource.destroy();
    await closeMongoDb();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  console.log(`[ingest-receipt] starting — polling ${env.MONGO_ETL_DB} every 30s`);
  await etl.startPolling(30_000);
}

main().catch((err) => {
  console.error('[ingest-receipt] fatal:', err);
  process.exit(1);
});
