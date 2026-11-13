import type Database from "better-sqlite3";
import type { AccessLog, AccessLogEntry, AccessLogKind } from "../../core/application/ports/AccessLog";
import { openSqlite } from "../persistence/openSqlite";

/**
 * The permanent record of user management (REQ-404, REQ-420, REQ-807). As with the operations audit,
 * the promises are in the schema: no entry without an author, and no change or deletion afterwards.
 */
export class SqliteAccessLog implements AccessLog {
  private readonly db: Database.Database;

  constructor(file: string) {
    this.db = openSqlite(file);
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS access_log (
         seq            INTEGER PRIMARY KEY AUTOINCREMENT,
         at             VARCHAR NOT NULL,
         kind           VARCHAR NOT NULL,
         actor_id       VARCHAR NOT NULL CHECK (length(trim(actor_id)) > 0),
         target_user_id VARCHAR,
         email          VARCHAR,
         before_value   VARCHAR,
         after_value    VARCHAR
       );
       CREATE TRIGGER IF NOT EXISTS access_log_no_update BEFORE UPDATE ON access_log
         BEGIN SELECT RAISE(ABORT, 'access_log is append-only'); END;
       CREATE TRIGGER IF NOT EXISTS access_log_no_delete BEFORE DELETE ON access_log
         BEGIN SELECT RAISE(ABORT, 'access_log is append-only'); END;`,
    );
  }

  async append(entry: AccessLogEntry): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO access_log (at, kind, actor_id, target_user_id, email, before_value, after_value)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(entry.at, entry.kind, entry.actorId, entry.targetUserId, entry.email, entry.before, entry.after);
  }

  async list(): Promise<AccessLogEntry[]> {
    const rows = this.db.prepare("SELECT * FROM access_log ORDER BY seq ASC").all() as Row[];
    return rows.map((r) => ({
      at: r.at,
      kind: r.kind as AccessLogKind,
      actorId: r.actor_id,
      targetUserId: r.target_user_id,
      email: r.email,
      before: r.before_value,
      after: r.after_value,
    }));
  }
}

interface Row {
  at: string;
  kind: string;
  actor_id: string;
  target_user_id: string | null;
  email: string | null;
  before_value: string | null;
  after_value: string | null;
}
