import type { Intent } from "../../domain/entities/Intent";

/** Persistence boundary for intents. In-memory for the MVP; swappable for a real store later. */
export interface IntentRepository {
  save(intent: Intent): Promise<void>;
  findById(id: string): Promise<Intent | null>;
  listByUser(userId: string): Promise<Intent[]>;
  /** Everyone's intents the Ledger accepted: the facts that came through here. */
  listAccepted(): Promise<Intent[]>;
  /** Intents proposed from an external record with this source reference (REQ-265), oldest first. */
  findByOriginReference(sourceReference: string): Promise<Intent[]>;
}
