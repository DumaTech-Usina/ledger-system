import type { ExternalSignal } from "../../domain/entities/ExternalSignal";

/** Signals are only added, never changed (REQ-260). */
export interface ExternalSignalRepository {
  add(signal: ExternalSignal): Promise<void>;
  /** Most recent first. */
  list(): Promise<ExternalSignal[]>;
  /**
   * One page, most recent first, starting after `before` (an opaque cursor from a previous page).
   * Each item carries the cursor that resumes right after it.
   */
  listPage(options: { before?: string; limit: number }): Promise<{ signal: ExternalSignal; cursor: string }[]>;
  /** The most recent reading of this record, of this kind. */
  latestFor(kind: string, recordId: string): Promise<ExternalSignal | null>;
}
