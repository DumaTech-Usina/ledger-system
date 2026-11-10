import amqp, { type Channel, type ChannelModel } from "amqplib";
import { SIGNAL_ROUTE } from "../../../core/application/messaging/insuranceSignalMessage";
import type { ReceiveSignalMessageUseCase } from "../../../core/application/use-cases/ReceiveSignalMessage";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Reads `treasury.signals`, one message at a time, in the Ledger's own layout (StagingWorker):
 * registered or duplicate → ack; invalid → nack without requeue, so it lands in the dead-letter queue
 * with the reason logged. Reconnects on its own when the broker goes away.
 */
export class RabbitMQSignalConsumer {
  constructor(
    private readonly amqpUrl: string,
    private readonly receive: ReceiveSignalMessageUseCase,
  ) {}

  async start(): Promise<void> {
    while (true) {
      try {
        await this.connect();
      } catch (err) {
        console.error("[signals] disconnected, reconnecting in 5s...", err instanceof Error ? err.message : err);
        await sleep(5000);
      }
    }
  }

  private async connect(): Promise<void> {
    const connection: ChannelModel = await amqp.connect(this.amqpUrl);
    const channel: Channel = await connection.createChannel();
    const r = SIGNAL_ROUTE;

    await channel.assertExchange(r.deadLetterExchange, "direct", { durable: true });
    await channel.assertQueue(r.deadLetterQueue, { durable: true });
    await channel.bindQueue(r.deadLetterQueue, r.deadLetterExchange, r.routingKey);

    await channel.assertExchange(r.exchange, "direct", { durable: true });
    await channel.assertQueue(r.queue, { durable: true, arguments: { "x-dead-letter-exchange": r.deadLetterExchange } });
    await channel.bindQueue(r.queue, r.exchange, r.routingKey);
    await channel.prefetch(1);

    await channel.consume(r.queue, async (msg) => {
      if (!msg) return;
      try {
        const outcome = await this.receive.execute(msg.content.toString());
        if (outcome.outcome === "invalid") {
          console.error(`[signals] invalid message → DLQ: ${outcome.reason}`);
          channel.nack(msg, false, false);
          return;
        }
        console.log(`[signals] ${outcome.outcome}: ${outcome.messageId}`);
        channel.ack(msg);
      } catch (err) {
        console.error("[signals] failed to process message → DLQ", err);
        channel.nack(msg, false, false);
      }
    });
    console.log(`[signals] waiting for messages on ${r.queue}`);

    await new Promise<void>((_, reject) => {
      connection.on("close", () => reject(new Error("connection closed")));
      connection.on("error", reject);
      channel.on("close", () => reject(new Error("channel closed")));
      channel.on("error", reject);
    });
  }
}
