import type { AdvanceReportReader } from '../../core/application/ports/AdvanceReportReader'
import type { AdvanceStagingJob } from './AdvanceStagingJob'
import { sleep } from '../utils/sleep'

export class AdvanceIngestJob {
  constructor(
    private readonly reader: AdvanceReportReader,
    private readonly stagingJob: AdvanceStagingJob,
  ) {}

  async run(): Promise<void> {
    let staged = 0
    for await (const advance of this.reader.streamCleanAdvances()) {
      await this.stagingJob.run(advance)
      staged++
    }
    console.log(`[AdvanceIngestJob] done — processed ${staged} advance report(s) to staging`)
  }

  async startPolling(intervalMs = 30_000): Promise<void> {
    while (true) {
      try {
        await this.run()
      } catch (err) {
        console.error('[AdvanceIngestJob] error during run:', err)
      }
      await sleep(intervalMs)
    }
  }
}
