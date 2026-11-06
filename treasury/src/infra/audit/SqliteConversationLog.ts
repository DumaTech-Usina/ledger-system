import { randomUUID } from "crypto";
import type Database from "better-sqlite3";
import type { ConversationEntry, ConversationLog } from "../../core/application/ports/ConversationLog";
import { openSqlite } from "../persistence/openSqlite";

/** The conversation's steps, in their own table: not audit, so no permanence guarantee (DEC-012). */
export class SqliteConversationLog implements ConversationLog {
  private readonly db: Database.Database;

  constructor(file: string) {
    this.db = openSqlite(file);
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS conversation_log (
         seq       INTEGER PRIMARY KEY AUTOINCREMENT,
         id        VARCHAR NOT NULL UNIQUE,
         intent_id VARCHAR NOT NULL,
         body      TEXT NOT NULL
       );
       CREATE INDEX IF NOT EXISTS idx_conversation_log_intent_id ON conversation_log (intent_id);`,
    );
  }

  async record(entry: Omit<ConversationEntry, "id">): Promise<void> {
    const stored: ConversationEntry = { id: randomUUID(), ...entry };
    this.db
      .prepare("INSERT INTO conversation_log (id, intent_id, body) VALUES (?, ?, ?)")
      .run(stored.id, stored.intentId, JSON.stringify(stored));
  }

  async listByIntent(intentId: string): Promise<ConversationEntry[]> {
    const rows = this.db
      .prepare("SELECT body FROM conversation_log WHERE intent_id = ? ORDER BY seq ASC")
      .all(intentId) as { body: string }[];
    return rows.map((row) => JSON.parse(row.body) as ConversationEntry);
  }

  close(): void {
    this.db.close();
  }
}
