import type Database from "better-sqlite3";
import type { BankStatement, BankStatementStore } from "../../core/application/services/BankStatements";
import { openSqlite } from "./openSqlite";

/**
 * The statement balances the CFO informed (REQ-675), in the operations SQLite file. Append-only: a
 * newer reading never rewrites an older one, so the history of the bank check stays as it was.
 */
export class SqliteBankStatementStore implements BankStatementStore {
  private readonly db: Database.Database;

  constructor(file: string) {
    this.db = openSqlite(file);
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS bank_statements (
         id          VARCHAR PRIMARY KEY,
         institution VARCHAR NOT NULL,
         day         VARCHAR NOT NULL,
         amount      VARCHAR NOT NULL,
         informed_by VARCHAR NOT NULL,
         informed_at VARCHAR NOT NULL
       );
       CREATE INDEX IF NOT EXISTS bank_statements_institution ON bank_statements (institution, day, informed_at);
       CREATE TRIGGER IF NOT EXISTS bank_statements_no_delete BEFORE DELETE ON bank_statements
       BEGIN SELECT RAISE(ABORT, 'statement balances are never deleted'); END;
       CREATE TRIGGER IF NOT EXISTS bank_statements_no_update BEFORE UPDATE ON bank_statements
       BEGIN SELECT RAISE(ABORT, 'statement balances are never rewritten'); END;`,
    );
  }

  async add(s: BankStatement): Promise<void> {
    this.db
      .prepare("INSERT INTO bank_statements (id, institution, day, amount, informed_by, informed_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(s.id, s.institution, s.day, s.amount, s.informedBy, s.informedAt);
  }

  async latest(): Promise<BankStatement[]> {
    const rows = this.db
      .prepare(
        `SELECT * FROM bank_statements b
          WHERE NOT EXISTS (
            SELECT 1 FROM bank_statements n
             WHERE n.institution = b.institution
               AND (n.day > b.day OR (n.day = b.day AND (n.informed_at > b.informed_at OR (n.informed_at = b.informed_at AND n.rowid > b.rowid))))
          )`,
      )
      .all() as Row[];
    return rows.map(toStatement);
  }

  async of(institution: string, limit: number): Promise<BankStatement[]> {
    const rows = this.db
      .prepare("SELECT * FROM bank_statements WHERE institution = ? ORDER BY day DESC, informed_at DESC, rowid DESC LIMIT ?")
      .all(institution, limit) as Row[];
    return rows.map(toStatement);
  }
}

interface Row {
  id: string;
  institution: string;
  day: string;
  amount: string;
  informed_by: string;
  informed_at: string;
}

const toStatement = (r: Row): BankStatement => ({
  id: r.id,
  institution: r.institution,
  day: r.day,
  amount: r.amount,
  informedBy: r.informed_by,
  informedAt: r.informed_at,
});
