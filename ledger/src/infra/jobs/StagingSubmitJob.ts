import { StagingRepository } from '../../core/application/repositories/StagingRepository';
import { MessagePublisher } from '../../core/application/ports/MessagePublisher';
import { sleep } from '../utils/sleep';

export class StagingSubmitJob {
  constructor(
    private readonly stagingRepo: StagingRepository,
    private readonly publisher: MessagePublisher,
    private readonly routingKey: string,
    private readonly eventTypes?: string[],
  ) {}

  async run(): Promise<void> {
    const records = await this.stagingRepo.claimPending('queued', 100, this.eventTypes);
    if (records.length > 0) {
      console.log(`[StagingSubmitJob] submitting ${records.length} record(s)`);
    }
    for (const record of records) {
      try {
        await this.publisher.publish(this.routingKey, record);
      } catch (err) {
        console.error(`[StagingSubmitJob] failed to publish ${record.id}, rolling back to pending`, err);
        await this.stagingRepo.markAsPending(record.id);
      }
    }
  }

  async startPolling(intervalMs = 5000): Promise<void> {
    console.log(`[StagingSubmitJob] polling every ${intervalMs}ms`);
    while (true) {
      try {
        await this.run();
      } catch (err) {
        console.error('[StagingSubmitJob] run error', err);
      }
      await sleep(intervalMs);
    }
  }
}
