import amqp, { Channel, ChannelModel } from 'amqplib';
import { MessagePublisher } from '../../../core/application/ports/MessagePublisher';

const EXCHANGE = 'ledger';

export class RabbitMQPublisher implements MessagePublisher {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;

  constructor(private readonly amqpUrl: string) {}

  async connect(): Promise<void> {
    const conn = await amqp.connect(this.amqpUrl);
    this.connection = conn;
    this.channel = await conn.createChannel();
    await this.channel.assertExchange(EXCHANGE, 'direct', { durable: true });
  }

  async publish(routingKey: string, payload: unknown): Promise<void> {
    if (!this.channel) throw new Error('RabbitMQPublisher: call connect() first');
    const content = Buffer.from(JSON.stringify(payload));
    this.channel.publish(EXCHANGE, routingKey, content, { persistent: true });
  }

  async close(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }
}
