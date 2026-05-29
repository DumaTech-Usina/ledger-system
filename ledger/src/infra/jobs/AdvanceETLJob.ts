import type { AdvanceReportReader } from '../../core/application/ports/AdvanceReportReader'
import type { AdvancePostingJob } from './AdvancePostingJob'
import { sleep } from '../utils/sleep'

export class AdvanceETLJob {
  constructor(
    private readonly reader: AdvanceReportReader,
    private readonly postingJob: AdvancePostingJob,
  ) {}

  async run(): Promise<void> {
    let staged = 0
    for await (const advance of this.reader.streamCleanAdvances()) {
      await this.postingJob.run(advance)
      staged++
    }
    console.log(`[AdvanceETLJob] done — processed ${staged} advance report(s) to staging`)
  }

  async startPolling(intervalMs = 30_000): Promise<void> {
    while (true) {
      try {
        await this.run()
      } catch (err) {
        console.error('[AdvanceETLJob] error during run:', err)
      }
      await sleep(intervalMs)
    }
  }
}
