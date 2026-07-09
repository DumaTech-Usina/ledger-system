import { Intent, type IntentProps } from "../../core/domain/entities/Intent";
import type { IntentRepository } from "../../core/application/repositories/IntentRepository";

/** MVP persistence. Stores plain props so rehydration produces a fresh entity each read. */
export class InMemoryIntentRepository implements IntentRepository {
  private readonly store = new Map<string, IntentProps>();

  async save(intent: Intent): Promise<void> {
    this.store.set(intent.id, intent.toJSON());
  }

  async findById(id: string): Promise<Intent | null> {
    const props = this.store.get(id);
    return props ? Intent.rehydrate(props) : null;
  }

  async listByUser(userId: string): Promise<Intent[]> {
    return [...this.store.values()]
      .filter((p) => p.userId === userId)
      .map((p) => Intent.rehydrate(p));
  }
}
