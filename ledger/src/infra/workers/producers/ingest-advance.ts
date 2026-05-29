import 'reflect-metadata';
import 'dotenv/config';
import { env } from '../../../config/env';
import { getMongoDb, getMongoDatabase, closeMongoDb } from '../../database/mongo-client';
import { MongoStagingRepository } from '../../persistence/mongodb/MongoStagingRepository';
import { MongoAdvanceReportReader } from '../../etl/MongoAdvanceReportReader';
import { AdvanceStagingJob } from '../../jobs/AdvanceStagingJob';
import { AdvanceIngestJob } from '../../jobs/AdvanceIngestJob';

async function main(): Promise<void> {
  const stagingDb = await getMongoDb();
  const etlDb = await getMongoDatabase(env.MONGO_ETL_DB);

  const stagingRepo = new MongoStagingRepository(stagingDb);
  const reader = new MongoAdvanceReportReader(etlDb);
  const stagingJob = new AdvanceStagingJob(stagingRepo, env.USINA_PARTY_ID, 'advance-etl', console.warn.bind(console));
  const etl = new AdvanceIngestJob(reader, stagingJob);

  const shutdown = async (signal: string) => {
    console.log(`[ingest-advance] ${signal} — shutting down`);
    await closeMongoDb();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  console.log(`[ingest-advance] starting — polling ${env.MONGO_ETL_DB} every 30s`);
  await etl.startPolling(30_000);
}

main().catch((err) => {
  console.error('[ingest-advance] fatal:', err);
  process.exit(1);
});
