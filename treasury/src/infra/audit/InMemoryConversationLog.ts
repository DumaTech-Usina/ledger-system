import { randomUUID } from "crypto";
import type { ConversationEntry, ConversationLog } from "../../core/application/ports/ConversationLog";

export class InMemoryConversationLog implements ConversationLog {
  private readonly entries: ConversationEntry[] = [];

  async record(entry: Omit<ConversationEntry, "id">): Promise<void> {
    this.entries.push({ id: randomUUID(), ...entry });
  }

  async listByIntent(intentId: string): Promise<ConversationEntry[]> {
    return this.entries.filter((e) => e.intentId === intentId);
  }
}
