import 'dotenv/config';
import { env } from '../../config/env';
import { getMongoDb } from '../database/mongo-client';
import { MongoStagingRepository } from '../persistence/mongodb/MongoStagingRepository';
import { RabbitMQPublisher } from '../messaging/rabbitmq/RabbitMQPublisher';
import { StagingRelayJob } from '../jobs/StagingRelayJob';

async function main(): Promise<void> {
  const db = await getMongoDb();
  const stagingRepo = new MongoStagingRepository(db);

  const publisher = new RabbitMQPublisher(env.RABBITMQ_URL);
  await publisher.connect();

  const relay = new StagingRelayJob(stagingRepo, publisher);

  console.log('[run-staging-relay] starting...');
  await relay.startPolling(5000);
}

main().catch((err) => {
  console.error('[run-staging-relay] fatal:', err);
  process.exit(1);
});
