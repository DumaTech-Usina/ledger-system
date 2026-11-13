import type Database from "better-sqlite3";
import type { Invite, InviteStatus } from "../../core/domain/entities/Invite";
import type { Role } from "../../core/domain/enums/Role";
import type { InviteRepository } from "../../core/application/repositories/InviteRepository";
import { openSqlite } from "./openSqlite";

/** Invites (§6.3). The link's token is never stored, only its hash (REQ-416). */
export class SqliteInviteRepository implements InviteRepository {
  private readonly db: Database.Database;

  constructor(file: string) {
    this.db = openSqlite(file);
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS invites (
         seq        INTEGER PRIMARY KEY AUTOINCREMENT,
         id         VARCHAR NOT NULL UNIQUE,
         email      VARCHAR NOT NULL,
         role       VARCHAR NOT NULL,
         token_hash VARCHAR NOT NULL UNIQUE,
         invited_by VARCHAR NOT NULL CHECK (length(trim(invited_by)) > 0),
         invited_at VARCHAR NOT NULL,
         expires_at VARCHAR NOT NULL,
         status     VARCHAR NOT NULL CHECK (status IN ('pending', 'accepted', 'replaced'))
       );
       CREATE INDEX IF NOT EXISTS idx_invites_email ON invites (email);`,
    );
  }

  async save(invite: Invite): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO invites (id, email, role, token_hash, invited_by, invited_at, expires_at, status)
         VALUES (@id, @email, @role, @tokenHash, @invitedBy, @invitedAt, @expiresAt, @status)
         ON CONFLICT (id) DO UPDATE SET status = excluded.status`,
      )
      .run(invite);
  }

  async findByTokenHash(tokenHash: string): Promise<Invite | null> {
    const row = this.db.prepare("SELECT * FROM invites WHERE token_hash = ?").get(tokenHash) as Row | undefined;
    return row ? toInvite(row) : null;
  }

  async listPending(): Promise<Invite[]> {
    return (this.db.prepare("SELECT * FROM invites WHERE status = 'pending' ORDER BY seq ASC").all() as Row[]).map(toInvite);
  }
}

interface Row {
  id: string;
  email: string;
  role: string;
  token_hash: string;
  invited_by: string;
  invited_at: string;
  expires_at: string;
  status: string;
}

const toInvite = (row: Row): Invite => ({
  id: row.id,
  email: row.email,
  role: row.role as Role,
  tokenHash: row.token_hash,
  invitedBy: row.invited_by,
  invitedAt: row.invited_at,
  expiresAt: row.expires_at,
  status: row.status as InviteStatus,
});
