import 'dotenv/config';
import { env } from '../../../config/env';
import { getMongoDb } from '../../database/mongo-client';
import { MongoStagingRepository } from '../../persistence/mongodb/MongoStagingRepository';
import { RabbitMQPublisher } from '../../messaging/rabbitmq/RabbitMQPublisher';
import { StagingRelayJob } from '../../jobs/StagingRelayJob';
import { EventType } from '../../../core/domain/enums/EventType';

const RECEIPT_EVENT_TYPES = [
  EventType.COMMISSION_RECEIVED,
  EventType.COMMISSION_EXPECTED,
];

async function main(): Promise<void> {
  const db = await getMongoDb();
  const stagingRepo = new MongoStagingRepository(db);

  const publisher = new RabbitMQPublisher(env.RABBITMQ_URL);
  await publisher.connect();

  const relay = new StagingRelayJob(stagingRepo, publisher, 'staging.receipt', RECEIPT_EVENT_TYPES);

  console.log('[submit-receipt] starting...');
  await relay.startPolling(5000);
}

main().catch((err) => {
  console.error('[submit-receipt] fatal:', err);
  process.exit(1);
});
