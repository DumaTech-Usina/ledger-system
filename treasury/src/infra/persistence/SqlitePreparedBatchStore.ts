import type Database from "better-sqlite3";
import {
  isStanding,
  type BatchPayment,
  type PreparedBatch,
  type PreparedBatchStore,
} from "../../core/application/services/PreparedBatches";
import { openSqlite } from "./openSqlite";

/**
 * Prepared batches in a SQLite file (REQ-652, §17 R1): a batch outlives a restart. The body is the
 * batch as JSON; `standing` and `paid_at` are kept beside it only so the two lists are indexed reads.
 * A batch is a Treasury draft, never a fact — but once paid it holds the outcome of each line, so
 * there is no delete path.
 */
export class SqlitePreparedBatchStore implements PreparedBatchStore {
  private readonly db: Database.Database;

  constructor(file: string) {
    this.db = openSqlite(file);
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS prepared_batches (
         batch_id VARCHAR PRIMARY KEY,
         standing INTEGER NOT NULL,
         paid_at  VARCHAR,
         body     TEXT NOT NULL
       );
       CREATE INDEX IF NOT EXISTS prepared_batches_standing ON prepared_batches (standing);
       CREATE INDEX IF NOT EXISTS prepared_batches_paid_at ON prepared_batches (paid_at);
       CREATE TRIGGER IF NOT EXISTS prepared_batches_no_delete BEFORE DELETE ON prepared_batches
       BEGIN SELECT RAISE(ABORT, 'prepared batches are never deleted'); END;`,
    );
  }

  async save(batch: PreparedBatch): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO prepared_batches (batch_id, standing, paid_at, body) VALUES (?, ?, ?, ?)
         ON CONFLICT(batch_id) DO UPDATE SET standing = excluded.standing, paid_at = excluded.paid_at, body = excluded.body`,
      )
      .run(batch.batchId, isStanding(batch) ? 1 : 0, batch.payment?.recordedAt ?? null, JSON.stringify(batch));
  }

  async get(batchId: string): Promise<PreparedBatch | null> {
    const row = this.db.prepare("SELECT body FROM prepared_batches WHERE batch_id = ?").get(batchId) as { body: string } | undefined;
    return row ? (JSON.parse(row.body) as PreparedBatch) : null;
  }

  async standing(): Promise<PreparedBatch[]> {
    const rows = this.db.prepare("SELECT body FROM prepared_batches WHERE standing = 1 ORDER BY rowid").all() as { body: string }[];
    return rows.map((row) => JSON.parse(row.body) as PreparedBatch);
  }

  async paid(limit: number): Promise<PreparedBatch[]> {
    const rows = this.db
      .prepare("SELECT body FROM prepared_batches WHERE paid_at IS NOT NULL ORDER BY paid_at DESC, rowid DESC LIMIT ?")
      .all(limit) as { body: string }[];
    return rows.map((row) => JSON.parse(row.body) as PreparedBatch);
  }

  async claimForPayment(batchId: string, payment: BatchPayment): Promise<boolean> {
    // One statement, guarded on `standing`: of two concurrent claims, exactly one changes the row.
    const claim = this.db.transaction(() => {
      const row = this.db.prepare("SELECT body FROM prepared_batches WHERE batch_id = ? AND standing = 1").get(batchId) as
        | { body: string }
        | undefined;
      if (!row) return false;
      const batch = { ...(JSON.parse(row.body) as PreparedBatch), payment };
      const changed = this.db
        .prepare("UPDATE prepared_batches SET standing = 0, paid_at = ?, body = ? WHERE batch_id = ? AND standing = 1")
        .run(payment.recordedAt, JSON.stringify(batch), batchId).changes;
      return changed === 1;
    });
    return claim();
  }

  close(): void {
    this.db.close();
  }
}
