import 'reflect-metadata';
import 'dotenv/config';
import { env } from '../../../config/env';
import { getMongoDb, getMongoDatabase, closeMongoDb } from '../../database/mongo-client';
import { MongoStagingRepository } from '../../persistence/mongodb/MongoStagingRepository';
import { MongoReceiptETLReader } from '../../etl/MongoReceiptETLReader';
import { ReceiptStagingBuilder } from '../../../core/application/services/ReceiptStagingBuilder';
import { ReceiptETLJob } from '../../jobs/ReceiptETLJob';

async function main(): Promise<void> {
  const stagingDb = await getMongoDb();
  const etlDb = await getMongoDatabase(env.MONGO_ETL_DB);

  const stagingRepo = new MongoStagingRepository(stagingDb);
  const reader = new MongoReceiptETLReader(etlDb);
  const builder = new ReceiptStagingBuilder(stagingRepo, env.USINA_PARTY_ID, 'receipt-etl', console.warn.bind(console));
  const etl = new ReceiptETLJob(reader, builder);

  const shutdown = async (signal: string) => {
    console.log(`[ingest-receipt] ${signal} — shutting down`);
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
