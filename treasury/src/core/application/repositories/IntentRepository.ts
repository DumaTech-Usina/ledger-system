import type { Intent } from "../../domain/entities/Intent";

/** Persistence boundary for intents. In-memory for the MVP; swappable for a real store later. */
export interface IntentRepository {
  save(intent: Intent): Promise<void>;
  findById(id: string): Promise<Intent | null>;
  listByUser(userId: string): Promise<Intent[]>;
}
