import type Database from "better-sqlite3";
import { ExternalSignal, type ExternalSignalProps } from "../../core/domain/entities/ExternalSignal";
import type { ExternalSignalRepository } from "../../core/application/repositories/ExternalSignalRepository";
import { openSqlite } from "./openSqlite";

/**
 * Signals in a SQLite file. Insert only: there is no update path, so a signal cannot be rewritten
 * (REQ-260). The body is the aggregate as JSON, read back whole.
 */
export class SqliteExternalSignalRepository implements ExternalSignalRepository {
  private readonly db: Database.Database;

  constructor(file: string) {
    this.db = openSqlite(file);
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS external_signals (
         id   VARCHAR PRIMARY KEY,
         body TEXT NOT NULL
       );`,
    );
  }

  async add(signal: ExternalSignal): Promise<void> {
    this.db.prepare("INSERT INTO external_signals (id, body) VALUES (?, ?)").run(signal.id, JSON.stringify(signal.toJSON()));
  }

  async latestFor(kind: string, recordId: string): Promise<ExternalSignal | null> {
    const row = this.db
      .prepare(
        `SELECT body FROM external_signals
         WHERE json_extract(body, '$.kind') = ? AND json_extract(body, '$.recordId') = ?
         ORDER BY rowid DESC LIMIT 1`,
      )
      .get(kind, recordId) as { body: string } | undefined;
    return row ? ExternalSignal.rehydrate(JSON.parse(row.body) as ExternalSignalProps) : null;
  }

  async list(): Promise<ExternalSignal[]> {
    const rows = this.db.prepare("SELECT body FROM external_signals ORDER BY rowid DESC").all() as { body: string }[];
    return rows.map((row) => ExternalSignal.rehydrate(JSON.parse(row.body) as ExternalSignalProps));
  }

  close(): void {
    this.db.close();
  }
}
