import type Database from "better-sqlite3";
import { User, type UserProps } from "../../core/domain/entities/User";
import type { Role } from "../../core/domain/enums/Role";
import type { Permission } from "../../core/domain/enums/Permission";
import type { UserRepository } from "../../core/application/repositories/UserRepository";
import { openSqlite } from "./openSqlite";

/**
 * The users of §6. The promise of REQ-403 is in the schema: a trigger refuses any deletion, so a
 * signature always finds its author. One active user per e-mail; a deactivated one keeps its row.
 */
export class SqliteUserRepository implements UserRepository {
  private readonly db: Database.Database;

  constructor(file: string) {
    this.db = openSqlite(file);
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS users (
         seq           INTEGER PRIMARY KEY AUTOINCREMENT,
         id            VARCHAR NOT NULL UNIQUE,
         email         VARCHAR NOT NULL,
         name          VARCHAR,
         role          VARCHAR NOT NULL CHECK (role IN ('admin', 'finance_manager', 'viewer')),
         status        VARCHAR NOT NULL CHECK (status IN ('active', 'deactivated')),
         password_hash VARCHAR NOT NULL,
         password_salt VARCHAR NOT NULL,
         grants        TEXT NOT NULL,
         failed_logins INTEGER NOT NULL DEFAULT 0,
         locked_until  VARCHAR,
         created_at    VARCHAR NOT NULL
       );
       CREATE UNIQUE INDEX IF NOT EXISTS idx_users_active_email ON users (email) WHERE status = 'active';
       CREATE TRIGGER IF NOT EXISTS users_never_deleted BEFORE DELETE ON users
         BEGIN SELECT RAISE(ABORT, 'users are never deleted (REQ-403)'); END;`,
    );
  }

  async findActiveByEmail(email: string): Promise<User | null> {
    const row = this.db.prepare("SELECT * FROM users WHERE email = ? AND status = 'active'").get(email) as Row | undefined;
    return row ? toUser(row) : null;
  }

  async findById(id: string): Promise<User | null> {
    const row = this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as Row | undefined;
    return row ? toUser(row) : null;
  }

  async list(): Promise<User[]> {
    return (this.db.prepare("SELECT * FROM users ORDER BY seq ASC").all() as Row[]).map(toUser);
  }

  async save(user: User): Promise<void> {
    const p = user.toProps();
    this.db
      .prepare(
        `INSERT INTO users (id, email, name, role, status, password_hash, password_salt, grants, failed_logins, locked_until, created_at)
         VALUES (@id, @email, @name, @role, @status, @passwordHash, @passwordSalt, @grants, @failedLogins, @lockedUntil, @createdAt)
         ON CONFLICT (id) DO UPDATE SET
           name = excluded.name, role = excluded.role, status = excluded.status,
           password_hash = excluded.password_hash, password_salt = excluded.password_salt,
           grants = excluded.grants, failed_logins = excluded.failed_logins, locked_until = excluded.locked_until`,
      )
      .run({ ...p, grants: JSON.stringify(p.grants) });
  }
}

interface Row {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  password_hash: string;
  password_salt: string;
  grants: string;
  failed_logins: number;
  locked_until: string | null;
  created_at: string;
}

function toUser(row: Row): User {
  const props: UserProps = {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as Role,
    status: row.status as UserProps["status"],
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
    grants: JSON.parse(row.grants) as Permission[],
    failedLogins: row.failed_logins,
    lockedUntil: row.locked_until,
    createdAt: row.created_at,
  };
  return new User(props);
}
