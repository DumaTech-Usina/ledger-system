import amqp, { type ConfirmChannel, type ChannelModel } from "amqplib";
import type { MessagePublisherPort } from "../../../core/application/ports/MessagePublisherPort";
import { SIGNAL_ROUTE } from "../../../core/application/messaging/insuranceSignalMessage";

/**
 * Publishes to the Treasury's exchange, like the Ledger's publisher does to its own. A confirm
 * channel: `publish` resolves only once the broker has taken the message, so a pass that ends without
 * error really delivered what it says it published.
 */
export class RabbitMQPublisher implements MessagePublisherPort {
  private connection: ChannelModel | null = null;
  private channel: ConfirmChannel | null = null;

  constructor(private readonly amqpUrl: string) {}

  async connect(): Promise<void> {
    this.connection = await amqp.connect(this.amqpUrl);
    this.channel = await this.connection.createConfirmChannel();
    await this.channel.assertExchange(SIGNAL_ROUTE.exchange, "direct", { durable: true });
  }

  async publish(routingKey: string, message: { messageId: string; type: string }): Promise<void> {
    if (!this.channel) throw new Error("RabbitMQPublisher: call connect() first");
    this.channel.publish(SIGNAL_ROUTE.exchange, routingKey, Buffer.from(JSON.stringify(message)), {
      persistent: true,
      contentType: "application/json",
      messageId: message.messageId,
      type: message.type,
    });
    await this.channel.waitForConfirms();
  }

  async close(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }
}
