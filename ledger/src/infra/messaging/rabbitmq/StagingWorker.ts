import amqp, { Channel, ChannelModel } from 'amqplib';
import { StagingRecord } from '../../../core/application/dtos/StagingRecord';
import { StagingMessageHandler } from '../../../core/application/ports/StagingMessageHandler';
import { sleep } from '../../utils/sleep';

const EXCHANGE = 'ledger';
const DLX = 'ledger.dlx';
const QUEUE = 'ledger.staging';
const DLQ = 'ledger.staging.dead';
const ROUTING_KEY = 'staging.receipt';

export class StagingWorker {
  constructor(
    private readonly amqpUrl: string,
    private readonly job: StagingMessageHandler,
  ) {}

  async start(): Promise<void> {
    while (true) {
      try {
        await this.connect();
      } catch (err) {
        console.error('[StagingWorker] disconnected, reconnecting in 5s...', err);
        await sleep(5000);
      }
    }
  }

  private async connect(): Promise<void> {
    const connection: ChannelModel = await amqp.connect(this.amqpUrl);
    const channel: Channel = await connection.createChannel();

    await channel.assertExchange(DLX, 'direct', { durable: true });
    await channel.assertQueue(DLQ, { durable: true });
    await channel.bindQueue(DLQ, DLX, ROUTING_KEY);

    await channel.assertExchange(EXCHANGE, 'direct', { durable: true });
    await channel.assertQueue(QUEUE, {
      durable: true,
      arguments: { 'x-dead-letter-exchange': DLX },
    });
    await channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);

    channel.prefetch(1);

    await channel.consume(QUEUE, async (msg) => {
      if (!msg) return;
      try {
        const record: StagingRecord = JSON.parse(msg.content.toString());
        await this.job.handle(record);
        channel.ack(msg);
      } catch (err) {
        console.error('[StagingWorker] failed to process message, sending to DLQ', err);
        channel.nack(msg, false, false);
      }
    });

    console.log('[StagingWorker] connected and waiting for messages');

    await new Promise<void>((_, reject) => {
      connection.on('close', () => reject(new Error('connection closed')));
      connection.on('error', reject);
      channel.on('close', () => reject(new Error('channel closed')));
      channel.on('error', reject);
    });
  }
}

