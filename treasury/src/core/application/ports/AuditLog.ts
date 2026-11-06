/** REQ-802: who did it — an identified user or an identified external system, never nobody. */
export interface AuditActor {
  kind: "user" | "external_system";
  id: string;
}

export const userActor = (id: string): AuditActor => ({ kind: "user", id });

/** REQ-802, for every store: there is no audit entry without an author. */
export function assertIdentifiedAuthor(entry: { actor?: AuditActor; type: string }): void {
  if (!entry.actor?.id?.trim()) {
    throw new Error(`An audit entry needs an identified author (type: ${entry.type}).`);
  }
}

export interface AuditEntry {
  id: string;
  actor: AuditActor;
  intentId: string;
  at: string;
  type: string;
  detail?: string;
}

/**
 * The permanent audit of what is sent to the Ledger and how the Ledger answered (REQ-801, REQ-804).
 * Owned by the User App, never the Ledger. Append-only: the port has no way to change or remove an
 * entry. What happens before sending belongs to the ConversationLog.
 */
export interface AuditLog {
  record(entry: Omit<AuditEntry, "id">): Promise<void>;
  listByIntent(intentId: string): Promise<AuditEntry[]>;
}
