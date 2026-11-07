import type Database from "better-sqlite3";
import type { IdentityLink } from "../../core/domain/value-objects/IdentityLink";
import type { IdentityLinkRepository } from "../../core/application/repositories/IdentityLinkRepository";
import { openSqlite } from "./openSqlite";

/**
 * The identity mapping. The promise is in the schema (REJ-331): triggers refuse any change or removal,
 * and one identifier holds one link. Undoing a wrong link is still DEC-015; when it is decided, it
 * will be a new fact, not an edit.
 */
export class SqliteIdentityLinkRepository implements IdentityLinkRepository {
  private readonly db: Database.Database;

  constructor(file: string) {
    this.db = openSqlite(file);
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS identity_links (
         seq             INTEGER PRIMARY KEY AUTOINCREMENT,
         id              VARCHAR NOT NULL UNIQUE,
         from_identifier VARCHAR NOT NULL UNIQUE,
         to_party_id     VARCHAR NOT NULL,
         linked_by       VARCHAR NOT NULL CHECK (length(trim(linked_by)) > 0),
         linked_at       VARCHAR NOT NULL
       );
       CREATE TRIGGER IF NOT EXISTS identity_links_no_update BEFORE UPDATE ON identity_links
         BEGIN SELECT RAISE(ABORT, 'identity_links is append-only'); END;
       CREATE TRIGGER IF NOT EXISTS identity_links_no_delete BEFORE DELETE ON identity_links
         BEGIN SELECT RAISE(ABORT, 'identity_links is append-only'); END;`,
    );
  }

  async append(link: IdentityLink): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO identity_links (id, from_identifier, to_party_id, linked_by, linked_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(link.id, link.fromIdentifier, link.toPartyId, link.linkedBy, link.linkedAt);
  }

  async findAll(): Promise<IdentityLink[]> {
    const rows = this.db.prepare("SELECT * FROM identity_links ORDER BY seq ASC").all() as Row[];
    return rows.map((row) => ({
      id: row.id,
      fromIdentifier: row.from_identifier,
      toPartyId: row.to_party_id,
      linkedBy: row.linked_by,
      linkedAt: row.linked_at,
    }));
  }

  close(): void {
    this.db.close();
  }
}

interface Row {
  id: string;
  from_identifier: string;
  to_party_id: string;
  linked_by: string;
  linked_at: string;
}
