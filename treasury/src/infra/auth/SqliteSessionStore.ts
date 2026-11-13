import { createHash, randomBytes } from "node:crypto";
import type Database from "better-sqlite3";
import type { SessionStore } from "../../core/application/ports/SessionStore";
import type { Clock } from "../../core/application/ports/Clock";
import { SESSION_TTL_MS } from "../../core/domain/policies/accessPolicy";
import { openSqlite } from "../persistence/openSqlite";

const hashOf = (token: string) => createHash("sha256").update(token, "utf8").digest("hex");

/**
 * Sessions that outlive a restart of the Treasury (REQ-412). Only the token's hash is stored
 * (REQ-416): a copy of the file opens no session.
 */
export class SqliteSessionStore implements SessionStore {
  private readonly db: Database.Database;

  constructor(file: string, private readonly clock: Clock, private readonly ttlMs: number = SESSION_TTL_MS) {
    this.db = openSqlite(file);
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS sessions (
         token_hash VARCHAR PRIMARY KEY,
         user_id    VARCHAR NOT NULL,
         created_at VARCHAR NOT NULL,
         expires_at INTEGER NOT NULL
       );
       CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);`,
    );
  }

  async create(userId: string): Promise<string> {
    const token = randomBytes(32).toString("base64url");
    const now = this.now();
    this.db
      .prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
      .run(hashOf(token), userId, new Date(now).toISOString(), now + this.ttlMs);
    this.db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now); // housekeeping, not a rule
    return token;
  }

  async userIdFor(token: string): Promise<string | null> {
    const row = this.db.prepare("SELECT user_id, expires_at FROM sessions WHERE token_hash = ?").get(hashOf(token)) as
      | { user_id: string; expires_at: number }
      | undefined;
    if (!row) return null;
    if (row.expires_at <= this.now()) {
      await this.destroy(token);
      return null;
    }
    return row.user_id;
  }

  async destroy(token: string): Promise<void> {
    this.db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashOf(token));
  }

  async destroyAllFor(userId: string): Promise<void> {
    this.db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  }

  private now(): number {
    return Date.parse(this.clock.now());
  }
}
