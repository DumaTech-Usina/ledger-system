import { randomUUID } from "crypto";
import type Database from "better-sqlite3";
import {
  assertIdentifiedAuthor,
  type AuditEntry,
  type AuditLog,
} from "../../core/application/ports/AuditLog";
import { openSqlite } from "../persistence/openSqlite";

/**
 * The permanent audit (REQ-801). The promises live in the schema, so that no code path, present or
 * future, and no one with a connection can quietly break them: the author columns refuse an entry
 * without one (REQ-802), and triggers refuse any change or deletion of what was written (REJ-801).
 */
export class SqliteAuditLog implements AuditLog {
  private readonly db: Database.Database;

  constructor(file: string) {
    this.db = openSqlite(file);
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS audit_log (
         seq        INTEGER PRIMARY KEY AUTOINCREMENT,
         id         VARCHAR NOT NULL UNIQUE,
         intent_id  VARCHAR NOT NULL,
         at         VARCHAR NOT NULL,
         type       VARCHAR NOT NULL,
         detail     TEXT,
         actor_kind VARCHAR NOT NULL CHECK (actor_kind IN ('user', 'external_system')),
         actor_id   VARCHAR NOT NULL CHECK (length(trim(actor_id)) > 0)
       );
       CREATE INDEX IF NOT EXISTS idx_audit_log_intent_id ON audit_log (intent_id);
       CREATE TRIGGER IF NOT EXISTS audit_log_no_update BEFORE UPDATE ON audit_log
         BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
       CREATE TRIGGER IF NOT EXISTS audit_log_no_delete BEFORE DELETE ON audit_log
         BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;`,
    );
  }

  async record(entry: Omit<AuditEntry, "id">): Promise<void> {
    assertIdentifiedAuthor(entry);
    this.db
      .prepare(
        `INSERT INTO audit_log (id, intent_id, at, type, detail, actor_kind, actor_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        randomUUID(),
        entry.intentId,
        entry.at,
        entry.type,
        entry.detail ?? null,
        entry.actor.kind,
        entry.actor.id,
      );
  }

  async listByIntent(intentId: string): Promise<AuditEntry[]> {
    const rows = this.db
      .prepare("SELECT * FROM audit_log WHERE intent_id = ? ORDER BY seq ASC")
      .all(intentId) as Row[];
    return rows.map((row) => ({
      id: row.id,
      intentId: row.intent_id,
      at: row.at,
      type: row.type,
      ...(row.detail === null ? {} : { detail: row.detail }),
      actor: { kind: row.actor_kind, id: row.actor_id },
    }));
  }

  close(): void {
    this.db.close();
  }
}

interface Row {
  id: string;
  intent_id: string;
  at: string;
  type: string;
  detail: string | null;
  actor_kind: "user" | "external_system";
  actor_id: string;
}
