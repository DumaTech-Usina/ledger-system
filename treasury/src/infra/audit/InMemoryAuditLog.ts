import { randomUUID } from "crypto";
import type { AuditLog, AuditEntry } from "../../core/application/ports/AuditLog";

/** MVP append-only audit store. Entries are only ever appended, never mutated. */
export class InMemoryAuditLog implements AuditLog {
  private readonly entries: AuditEntry[] = [];

  async record(entry: Omit<AuditEntry, "id">): Promise<void> {
    this.entries.push({ id: randomUUID(), ...entry });
  }

  async listByIntent(intentId: string): Promise<AuditEntry[]> {
    return this.entries.filter((e) => e.intentId === intentId);
  }
}
