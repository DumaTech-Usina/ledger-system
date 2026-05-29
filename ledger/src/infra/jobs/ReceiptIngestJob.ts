import { ReceiptETLReader } from '../../core/application/ports/ReceiptETLReader';
import { EnrichedReceiptInput } from '../../core/application/dtos/EnrichedReceiptInput';
import { ReceiptStagingBuilder } from '../../core/application/services/ReceiptStagingBuilder';
import { sleep } from '../utils/sleep';

const RECEIPT_BATCH_SIZE = 500;

export class ReceiptIngestJob {
  constructor(
    private readonly reader: ReceiptETLReader,
    private readonly builder: ReceiptStagingBuilder,
  ) {}

  async run(): Promise<void> {
    // Receipts are streamed via a server-side $lookup cursor — proposals are
    // joined at the database level, so the Node process holds at most one batch.
    const buf: EnrichedReceiptInput[] = [];
    let staged = 0;

    for await (const enriched of this.reader.streamEnrichedReceipts()) {
      buf.push(enriched);
      if (buf.length >= RECEIPT_BATCH_SIZE) {
        await this.builder.run(buf.splice(0));
        staged += RECEIPT_BATCH_SIZE;
      }
    }

    if (buf.length > 0) {
      await this.builder.run(buf);
      staged += buf.length;
    }

    console.log(`[ReceiptIngestJob] done — streamed ${staged} receipts to staging`);
  }

  async startPolling(intervalMs = 30_000): Promise<void> {
    while (true) {
      try {
        await this.run();
      } catch (err) {
        console.error('[ReceiptIngestJob] error during run:', err);
      }
      await sleep(intervalMs);
    }
  }
}
