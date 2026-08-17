import 'reflect-metadata';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { DataSource } from 'typeorm';
import { env } from '../../config/env';
import { LedgerEventObjectModel } from '../persistence/typeorm/models/LedgerEventObjectModel';
import { LedgerEventModel } from '../persistence/typeorm/models/LedgerEventModel';
import { LedgerEventPartyModel } from '../persistence/typeorm/models/LedgerEventPartyModel';
import { InitialSchema1744848000000 } from './migrations/1744848000000-InitialSchema';

/** Every migration, in order. Listed rather than globbed — see the note on `migrations` below. */
export const MIGRATIONS = [InitialSchema1744848000000];

export const AppDataSource = new DataSource({
  type: 'better-sqlite3',
  database: env.DB_FILE,

  /**
   * WAL lets readers proceed while a write is in flight, and `busy_timeout` makes a concurrent
   * writer wait for the lock instead of failing on it. SQLite serializes writes to one at a time;
   * this book is append-only and written by a single process, so the serialization costs nothing
   * and the durability guarantee is the same as any journaled database.
   *
   * `foreign_keys` is OFF by default in SQLite — the ON DELETE CASCADE declared on the child tables
   * would silently do nothing without this.
   */
  prepareDatabase: (db) => {
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
    // FULL rather than NORMAL: this is a system of record, and an event acknowledged to a caller
    // must survive the machine losing power, not merely the process dying.
    db.pragma('synchronous = FULL');
  },

  /** Always false — schema changes go through migrations only */
  synchronize: false,

  logging: env.DB_LOGGING,

  entities: [
    LedgerEventModel,
    LedgerEventPartyModel,
    LedgerEventObjectModel,
  ],

  /**
   * Imported rather than globbed. A glob is resolved with `require` against the compiled output,
   * which is fragile across the dev runner (tsx) and the built image; the explicit list is the same
   * in both, and a migration missing from it fails as a missing table on the first query.
   */
  migrations: MIGRATIONS,
  migrationsRun: env.DB_MIGRATIONS_RUN,
});

/** Creates the directory the book's file lives in, so a first boot on a fresh volume works. */
export function ensureDatabaseDirectory(file: string = env.DB_FILE): void {
  if (file === ':memory:') return;
  mkdirSync(dirname(file), { recursive: true });
}
