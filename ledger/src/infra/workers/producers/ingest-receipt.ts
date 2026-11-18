/**
 * RETIRED (2026-11-17, treasury/docs/requisitos_refinados.md REQ-289). Do not run.
 *
 * This pipeline wrote the health system's receipts straight into the Ledger: a "BAIXADO" receipt
 * became cash in, with no one confirming and no bank seen, and no obligation to the broker or the
 * supervisor was recorded (LedgerFinancialAudit.md, CRITICAL 5 and HIGH 11). The health system now
 * enters through the Treasury's external signal (§4.7), where each fact is confirmed by a user and
 * the receipt is only recorded once the bank shows it. Running both would count the same money twice.
 *
 * Removed from `npm run dev:full`; the code goes once the pilot is over ("aposentar aos poucos").
 */
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
  // REQ-289: retired. Refuses to start, so it cannot run beside the health signal by accident.
  if (process.env.ALLOW_RETIRED_RECEIPT_INGEST !== 'true') {
    console.error('[ingest-receipt] retired (REQ-289): the health system enters through the Treasury signal (§4.7).');
    process.exit(1);
  }
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
