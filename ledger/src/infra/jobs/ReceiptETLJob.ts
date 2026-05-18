import { ReceiptETLReader } from '../../core/application/ports/ReceiptETLReader';
import { ProposalContextNormalizer } from '../../core/application/services/ProposalContextNormalizer';
import { ReceiptStagingBuilder } from '../../core/application/services/ReceiptStagingBuilder';
import { sleep } from '../utils/sleep';

export class ReceiptETLJob {
  constructor(
    private readonly reader: ReceiptETLReader,
    private readonly normalizer: ProposalContextNormalizer,
    private readonly builder: ReceiptStagingBuilder,
  ) {}

  async run(): Promise<void> {
    const [proposalInputs, receiptInputs] = await Promise.all([
      this.reader.fetchCleanProposals(),
      this.reader.fetchCleanReceipts(),
    ]);

    console.log(
      `[ReceiptETLJob] fetched ${proposalInputs.length} proposals, ${receiptInputs.length} receipts`,
    );

    const contexts = this.normalizer.normalize(proposalInputs);
    const contextMap = new Map(contexts.map((c) => [c.proposalId, c]));

    await this.builder.run(receiptInputs, contextMap);

    console.log(`[ReceiptETLJob] done — ${receiptInputs.length} receipts posted to staging`);
  }

  async startPolling(intervalMs = 30_000): Promise<void> {
    while (true) {
      try {
        await this.run();
      } catch (err) {
        console.error('[ReceiptETLJob] error during run:', err);
      }
      await sleep(intervalMs);
    }
  }
}
