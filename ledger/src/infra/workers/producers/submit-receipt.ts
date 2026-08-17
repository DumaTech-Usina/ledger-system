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
