export type AuditAction = "LEDGER_EVENT_CREATED" | "STAGING_RECORD_REJECTED";

export interface AuditEntry {
  action: AuditAction;
  timestamp: string; // ISO-8601
  sourceSystem: string;

  // LEDGER_EVENT_CREATED
  eventId?: string;
  eventType?: string;
  economicEffect?: string;
  sourceReference?: string;
  commandId?: string | null;

  // STAGING_RECORD_REJECTED
  stagingId?: string;
  reasons?: string[];
}

export interface IAuditLogger {
  log(entry: AuditEntry): Promise<void>;
}
