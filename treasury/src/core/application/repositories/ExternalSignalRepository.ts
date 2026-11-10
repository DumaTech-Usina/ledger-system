import type { ExternalSignal } from "../../domain/entities/ExternalSignal";

/** Signals are only added, never changed (REQ-260). */
export interface ExternalSignalRepository {
  add(signal: ExternalSignal): Promise<void>;
  /** Most recent first. */
  list(): Promise<ExternalSignal[]>;
}
