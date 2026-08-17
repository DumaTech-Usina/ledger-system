import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The book's schema, on SQLite.
 *
 * One migration rather than the six this replaced: the earlier ones described the schema's history
 * on PostgreSQL, and that history says nothing about a SQLite file that starts empty. Replaying an
 * `ALTER TABLE ADD COLUMN` sequence to arrive at a table no database ever held in its intermediate
 * shapes would be ceremony, not lineage. The shape recorded here is the shape the code reads.
 *
 * Timestamps are TEXT holding ISO-8601 UTC — see `iso-date.transformer.ts` for why that format and
 * not SQLite's own. Money is INTEGER: SQLite's INTEGER is 64-bit, the same width PostgreSQL BIGINT
 * gave, so no precision is traded away.
 *
 * The staging and rejected tables join the events in the same file. They were separate stores
 * before (a Mongo alongside a Postgres) for no reason the model ever asserted: a staging record is
 * a candidate for this book and a rejected one is this book's refusal, and both are read only ever
 * beside it. One file also makes "back up the book" a single, atomic thing to say.
 */
export class InitialSchema1744848000000 implements MigrationInterface {
  name = 'InitialSchema1744848000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── The book ───────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "ledger_events" (
        "id"                       VARCHAR    NOT NULL,
        "event_type"               VARCHAR    NOT NULL,
        "economic_effect"          VARCHAR    NOT NULL,
        "occurred_at"              VARCHAR    NOT NULL,
        "recorded_at"              VARCHAR    NOT NULL,
        "source_at"                VARCHAR,
        "due_at"                   VARCHAR,
        "amount_units"             INTEGER    NOT NULL,
        "amount_currency"          VARCHAR(3) NOT NULL,
        "description"              VARCHAR,
        "source_system"            VARCHAR    NOT NULL,
        "source_reference"         VARCHAR    NOT NULL,
        "normalization_version"    VARCHAR    NOT NULL,
        "normalization_worker_id"  VARCHAR    NOT NULL,
        "hash"                     VARCHAR    NOT NULL,
        "previous_hash"            VARCHAR,
        "command_id"               VARCHAR,
        "related_event_id"         VARCHAR,
        "reporter_type"            VARCHAR    NOT NULL,
        "reporter_id"              VARCHAR    NOT NULL,
        "reporter_name"            VARCHAR,
        "reported_at"              VARCHAR    NOT NULL,
        "reporter_channel"         VARCHAR    NOT NULL,
        "reason_type"              VARCHAR,
        "reason_description"       VARCHAR,
        "reason_confidence"        VARCHAR,
        "reason_requires_followup" BOOLEAN,
        CONSTRAINT "PK_ledger_events" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_ledger_events_hash" UNIQUE ("hash"),
        CONSTRAINT "UQ_ledger_events_command_id" UNIQUE ("command_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "ledger_event_parties" (
        "id"              INTEGER     NOT NULL,
        "event_id"        VARCHAR     NOT NULL,
        "party_id"        VARCHAR     NOT NULL,
        "role"            VARCHAR     NOT NULL,
        "direction"       VARCHAR     NOT NULL,
        "amount_units"    INTEGER,
        "amount_currency" VARCHAR(3),
        CONSTRAINT "PK_ledger_event_parties" PRIMARY KEY ("id" AUTOINCREMENT),
        CONSTRAINT "FK_ledger_event_parties_event"
          FOREIGN KEY ("event_id") REFERENCES "ledger_events" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "ledger_event_objects" (
        "id"          INTEGER  NOT NULL,
        "event_id"    VARCHAR  NOT NULL,
        "object_id"   VARCHAR  NOT NULL,
        "object_type" VARCHAR  NOT NULL,
        "relation"    VARCHAR  NOT NULL,
        CONSTRAINT "PK_ledger_event_objects" PRIMARY KEY ("id" AUTOINCREMENT),
        CONSTRAINT "FK_ledger_event_objects_event"
          FOREIGN KEY ("event_id") REFERENCES "ledger_events" ("id") ON DELETE CASCADE
      )
    `);

    // ── Traceability: the lineage lookups ──────────────────────────────────────
    await queryRunner.query(`CREATE INDEX "IDX_ledger_event_objects_object_id" ON "ledger_event_objects" ("object_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_ledger_event_objects_event_id" ON "ledger_event_objects" ("event_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_ledger_event_parties_party_id"  ON "ledger_event_parties"  ("party_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_ledger_event_parties_event_id"  ON "ledger_event_parties"  ("event_id")`);

    // Partial, in both cases: only the rows that carry the column are ever ordered or filtered by
    // it, so indexing the nulls would cost a write on every event to serve no read.
    await queryRunner.query(`
      CREATE INDEX "IDX_ledger_events_related_event_id"
        ON "ledger_events" ("related_event_id") WHERE "related_event_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_ledger_events_due_at"
        ON "ledger_events" ("due_at") WHERE "due_at" IS NOT NULL
    `);

    // ── Listing paths ──────────────────────────────────────────────────────────
    // The recording-order axis: `sortBy=recordedAt` on /api/events, and the position listing's
    // `created_at` (MIN recorded_at per object) both read it.
    await queryRunner.query(`CREATE INDEX "IDX_ledger_events_recorded_at" ON "ledger_events" ("recorded_at")`);
    // The cash statement's keyset: it orders by (occurred_at, id), with or without the party join.
    await queryRunner.query(`CREATE INDEX "IDX_ledger_events_effect_occurred_at_id" ON "ledger_events" ("economic_effect", "occurred_at", "id")`);
    // Ordering by occurrence outside the cash listing (the event feed).
    await queryRunner.query(`CREATE INDEX "IDX_ledger_events_occurred_at_id" ON "ledger_events" ("occurred_at", "id")`);
    // Narrows the position aggregate to the objects of a selected type before it groups anything.
    await queryRunner.query(`CREATE INDEX "IDX_ledger_event_objects_type_object_id" ON "ledger_event_objects" ("object_type", "object_id")`);
    // "Which of these objects has ever been settled" — one lookup instead of one read per object.
    await queryRunner.query(`CREATE INDEX "IDX_ledger_event_objects_object_id_relation" ON "ledger_event_objects" ("object_id", "relation")`);
    // The retraction guard probes objects of a candidate event by relation; both nested NOT EXISTS land here.
    await queryRunner.query(`CREATE INDEX "IDX_ledger_event_objects_event_id_relation" ON "ledger_event_objects" ("event_id", "relation")`);
    // The statement join: a party's movements are the rows where it is the side that moved cash.
    await queryRunner.query(`CREATE INDEX "IDX_ledger_event_parties_party_id_direction" ON "ledger_event_parties" ("party_id", "direction")`);

    // ── Candidates awaiting promotion ──────────────────────────────────────────
    // The record's own fields stay in `payload`: staging is a holding area for something not yet
    // asserted, and normalizing an unvalidated shape into columns would claim more about it than is
    // known. Only what the pipeline SELECTS on is lifted out.
    await queryRunner.query(`
      CREATE TABLE "staging_records" (
        "id"               VARCHAR NOT NULL,
        "status"           VARCHAR NOT NULL,
        "event_type"       VARCHAR NOT NULL,
        "source_reference" VARCHAR NOT NULL,
        "payload"          TEXT    NOT NULL,
        CONSTRAINT "PK_staging_records" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_staging_records_source_reference" UNIQUE ("source_reference")
      )
    `);
    // `claimPending` reads exactly this: pending records, optionally of certain types.
    await queryRunner.query(`CREATE INDEX "IDX_staging_records_status_event_type" ON "staging_records" ("status", "event_type")`);

    // ── The book's refusals ────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "rejected_events" (
        "id"          VARCHAR NOT NULL,
        "staging_id"  VARCHAR NOT NULL,
        "rejected_at" VARCHAR NOT NULL,
        "payload"     TEXT    NOT NULL,
        CONSTRAINT "PK_rejected_events" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_rejected_events_rejected_at" ON "rejected_events" ("rejected_at")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "rejected_events"`);
    await queryRunner.query(`DROP TABLE "staging_records"`);
    await queryRunner.query(`DROP TABLE "ledger_event_objects"`);
    await queryRunner.query(`DROP TABLE "ledger_event_parties"`);
    await queryRunner.query(`DROP TABLE "ledger_events"`);
  }
}
