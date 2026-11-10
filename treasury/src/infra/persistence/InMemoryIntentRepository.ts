import { Intent, type IntentProps } from "../../core/domain/entities/Intent";
import { IntentStatus } from "../../core/domain/enums/IntentStatus";
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

  async listAccepted(): Promise<Intent[]> {
    return [...this.store.values()]
      .filter((p) => p.status === IntentStatus.ACCEPTED)
      .map((p) => Intent.rehydrate(p));
  }

  async findByOriginReference(sourceReference: string): Promise<Intent[]> {
    return [...this.store.values()]
      .filter((p) => p.origin?.sourceReference === sourceReference)
      .map((p) => Intent.rehydrate(p));
  }

  async listByUser(userId: string): Promise<Intent[]> {
    return [...this.store.values()]
      .filter((p) => p.userId === userId)
      .map((p) => Intent.rehydrate(p));
  }
}
