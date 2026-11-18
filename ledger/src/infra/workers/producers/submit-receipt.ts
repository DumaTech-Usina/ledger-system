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
import "dotenv/config";
import { env } from "../../../config/env";
import { AppDataSource, ensureDatabaseDirectory } from "../../database/data-source";
import { SqliteStagingRepository } from "../../persistence/sqlite/SqliteStagingRepository";
import { RabbitMQPublisher } from "../../messaging/rabbitmq/RabbitMQPublisher";
import { StagingSubmitJob } from "../../jobs/StagingSubmitJob";
import { EventType } from "../../../core/domain/enums/EventType";

const RECEIPT_EVENT_TYPES = [
  EventType.COMMISSION_RECEIVED,
  EventType.COMMISSION_EXPECTED,
];

async function main(): Promise<void> {
  ensureDatabaseDirectory();
  await AppDataSource.initialize();
  const stagingRepo = new SqliteStagingRepository(AppDataSource);

  const publisher = new RabbitMQPublisher(env.RABBITMQ_URL);
  await publisher.connect();

  const submit = new StagingSubmitJob(
    stagingRepo,
    publisher,
    "staging.receipt",
    RECEIPT_EVENT_TYPES,
  );

  console.log("[submit-receipt] starting...");
  await submit.startPolling(5000);
}

main().catch((err) => {
  console.error("[submit-receipt] fatal:", err);
  process.exit(1);
});
