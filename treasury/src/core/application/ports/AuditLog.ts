/** REQ-802: who did it — an identified user or an identified external system, never nobody. */
export interface AuditActor {
  kind: "user" | "external_system";
  id: string;
}

export const userActor = (id: string): AuditActor => ({ kind: "user", id });

export interface AuditEntry {
  id: string;
  actor: AuditActor;
  intentId: string;
  at: string;
  type: string;
  detail?: string;
}

/**
 * Append-only human-action / provenance journal. Owned by the User App (never the Ledger, which
 * keeps its own financial-event audit). Records every step of an intent's life for traceability.
 */
export interface AuditLog {
  record(entry: Omit<AuditEntry, "id">): Promise<void>;
  listByIntent(intentId: string): Promise<AuditEntry[]>;
}
