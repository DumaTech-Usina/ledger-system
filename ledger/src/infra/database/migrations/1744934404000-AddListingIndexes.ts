import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Indexes for the read paths that list the book.
 *
 * Why these did not exist: `occurred_at` and `recorded_at` carry `@Index()` on the model, but the
 * data source runs with `synchronize: false` — decorators never reach the schema, only migrations
 * do. Every listing that ordered or filtered by time was therefore sorting the whole table, and no
 * migration had ever declared those indexes. This closes that gap and adds the composites the
 * position aggregate and the cash statement actually use.
 *
 * Read-only change: no column is added, no row is touched, nothing about what the book RECORDS
 * changes. An index is a statement about how a fact is found, never about the fact.
 *
 * Plain `CREATE INDEX` rather than `CONCURRENTLY`: TypeORM runs a migration inside a transaction,
 * and `CONCURRENTLY` cannot. It takes a brief write lock — acceptable on an append-only table, and
 * the honest trade rather than splitting the migration out of its transaction.
 */
export class AddListingIndexes1744934404000 implements MigrationInterface {
  name = 'AddListingIndexes1744934404000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // The recording-order axis: `sortBy=recordedAt` on /api/events, and the position listing's
    // `created_at` (MIN recorded_at per object) both read it.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ledger_events_recorded_at"
        ON "ledger_events" ("recorded_at")
    `);

    // The cash statement's keyset: it orders by (occurred_at, id) and, since the listing learned to
    // answer for the whole book, may run without the party join to narrow it first.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ledger_events_effect_occurred_at_id"
        ON "ledger_events" ("economic_effect", "occurred_at", "id")
    `);

    // Ordering by occurrence outside the cash listing (the event feed).
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ledger_events_occurred_at_id"
        ON "ledger_events" ("occurred_at", "id")
    `);

    // Narrows the position aggregate to the objects of a selected type before it groups anything.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ledger_event_objects_type_object_id"
        ON "ledger_event_objects" ("object_type", "object_id")
    `);

    // "Which of these objects has ever been settled" — one lookup instead of one read per object.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ledger_event_objects_object_id_relation"
        ON "ledger_event_objects" ("object_id", "relation")
    `);

    // The retraction guard probes objects of a candidate event by relation; both of its nested
    // NOT EXISTS land here.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ledger_event_objects_event_id_relation"
        ON "ledger_event_objects" ("event_id", "relation")
    `);

    // The statement join: a party's movements are the rows where it is the side that moved cash.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ledger_event_parties_party_id_direction"
        ON "ledger_event_parties" ("party_id", "direction")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ledger_event_parties_party_id_direction"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ledger_event_objects_event_id_relation"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ledger_event_objects_object_id_relation"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ledger_event_objects_type_object_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ledger_events_occurred_at_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ledger_events_effect_occurred_at_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ledger_events_recorded_at"`);
  }
}
