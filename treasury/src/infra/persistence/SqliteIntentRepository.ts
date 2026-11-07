import type Database from "better-sqlite3";
import { Intent, type IntentProps } from "../../core/domain/entities/Intent";
import { IntentStatus } from "../../core/domain/enums/IntentStatus";
import type { IntentRepository } from "../../core/application/repositories/IntentRepository";
import { openSqlite } from "./openSqlite";

/**
 * Intents in a SQLite file, so the link from an intent to the Ledger fact it produced (REQ-501)
 * survives a restart. The body is the aggregate as JSON: it is read by id or by user and never
 * searched by field. The upsert keeps the row's position, so a user's list keeps its order.
 */
export class SqliteIntentRepository implements IntentRepository {
  private readonly db: Database.Database;

  constructor(file: string) {
    this.db = openSqlite(file);
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS intents (
         id      VARCHAR PRIMARY KEY,
         user_id VARCHAR NOT NULL,
         body    TEXT NOT NULL
       );
       CREATE INDEX IF NOT EXISTS idx_intents_user_id ON intents (user_id);`,
    );
  }

  async save(intent: Intent): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO intents (id, user_id, body) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET body = excluded.body`,
      )
      .run(intent.id, intent.userId, JSON.stringify(intent.toJSON()));
  }

  async findById(id: string): Promise<Intent | null> {
    const row = this.db.prepare("SELECT body FROM intents WHERE id = ?").get(id) as Row | undefined;
    return row ? toIntent(row) : null;
  }

  async listAccepted(): Promise<Intent[]> {
    const rows = this.db.prepare("SELECT body FROM intents ORDER BY rowid ASC").all() as Row[];
    return rows.map(toIntent).filter((intent) => intent.status === IntentStatus.ACCEPTED);
  }

  async listByUser(userId: string): Promise<Intent[]> {
    const rows = this.db
      .prepare("SELECT body FROM intents WHERE user_id = ? ORDER BY rowid ASC")
      .all(userId) as Row[];
    return rows.map(toIntent);
  }

  close(): void {
    this.db.close();
  }
}

interface Row {
  body: string;
}

const toIntent = (row: Row): Intent => Intent.rehydrate(JSON.parse(row.body) as IntentProps);
