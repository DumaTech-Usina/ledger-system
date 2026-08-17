import "dotenv/config";
import { env } from "../../../config/env";
import { AppDataSource, ensureDatabaseDirectory } from "../../database/data-source";
import { SqliteStagingRepository } from "../../persistence/sqlite/SqliteStagingRepository";
import { RabbitMQPublisher } from "../../messaging/rabbitmq/RabbitMQPublisher";
import { StagingSubmitJob } from "../../jobs/StagingSubmitJob";
import { EventType } from "../../../core/domain/enums/EventType";

const ADVANCE_EVENT_TYPES = [
  EventType.ADVANCE_PAYMENT,
  EventType.ADVANCE_SETTLEMENT,
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
    "staging.advance",
    ADVANCE_EVENT_TYPES,
  );

  console.log("[submit-advance] starting...");
  await submit.startPolling(5000);
}

main().catch((err) => {
  console.error("[submit-advance] fatal:", err);
  process.exit(1);
});
