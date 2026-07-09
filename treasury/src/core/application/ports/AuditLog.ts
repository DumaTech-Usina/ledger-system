export interface AuditEntry {
  id: string;
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
