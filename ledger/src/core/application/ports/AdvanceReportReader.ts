import type { EnrichedAdvanceInput } from '../dtos/EnrichedAdvanceInput'

export interface AdvanceReportReader {
  /** Streams CLEAN advance reports from aspirant_advance_canonical.
   *  Status filtering is applied server-side; callers receive only postable records. */
  streamCleanAdvances(): AsyncIterable<EnrichedAdvanceInput>
}
