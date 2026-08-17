import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import type { Party } from "../../core/domain/entities/Party";
import type { PartyRepository } from "../../core/application/repositories/PartyRepository";

/**
 * The durable Party Directory, in a SQLite file.
 *
 * A party is stored as one row whose body is the aggregate itself, as JSON — aliases, external ids
 * and attributes nest exactly as the aggregate holds them, so nothing is normalized away and
 * nothing is reassembled on read. The Directory is queried by id and listed whole; it is never
 * searched by attribute in SQL, so columns for those fields would buy nothing and would have to be
 * kept in step with a shape that is still moving.
 *
 * `party_id` is the primary key. That is the property that matters and the reason this store must
 * be durable at all: an id that has reached an immutable Ledger event can never be lost here, or
 * the event would name a counterparty this system can no longer identify.
 */
export class SqlitePartyRepository implements PartyRepository {
  private readonly db: Database.Database;

  constructor(file: string, private readonly table = "parties") {
    if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
    this.db = new Database(file);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("busy_timeout = 5000");
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS "${this.table}" (
         party_id VARCHAR PRIMARY KEY,
         body     TEXT NOT NULL
       )`,
    );
  }

  /**
   * Idempotent on the PartyId: saving the same party twice replaces its body and never creates a
   * second row. A duplicate id here would be a second identity for one counterparty, which is the
   * one thing the Directory exists to prevent.
   */
  async save(party: Party): Promise<void> {
    const { partyId, ...rest } = party;
    this.db
      .prepare(
        `INSERT INTO "${this.table}" (party_id, body) VALUES (?, ?)
         ON CONFLICT(party_id) DO UPDATE SET body = excluded.body`,
      )
      .run(partyId, JSON.stringify(rest));
  }

  async findById(partyId: string): Promise<Party | null> {
    const row = this.db
      .prepare(`SELECT party_id, body FROM "${this.table}" WHERE party_id = ?`)
      .get(partyId) as PartyRow | undefined;
    return row ? toParty(row) : null;
  }

  async findAll(): Promise<Party[]> {
    // Sorted by id so the cascade sees a stable order regardless of insertion history.
    const rows = this.db
      .prepare(`SELECT party_id, body FROM "${this.table}" ORDER BY party_id ASC`)
      .all() as PartyRow[];
    return rows.map(toParty);
  }

  close(): void {
    this.db.close();
  }
}

interface PartyRow {
  party_id: string;
  body: string;
}

function toParty(row: PartyRow): Party {
  const rest = JSON.parse(row.body) as Omit<Party, "partyId">;
  return {
    partyId: row.party_id,
    ...rest,
    aliases: [...rest.aliases],
    externalIds: rest.externalIds.map((external) => ({ ...external })),
    attributes: { ...rest.attributes },
  };
}
