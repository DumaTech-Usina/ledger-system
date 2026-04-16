import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1744848000000 implements MigrationInterface {
  name = 'InitialSchema1744848000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "ledger_events" (
        "id"                       VARCHAR        NOT NULL,
        "event_type"               VARCHAR        NOT NULL,
        "economic_effect"          VARCHAR        NOT NULL,
        "occurred_at"              TIMESTAMPTZ    NOT NULL,
        "recorded_at"              TIMESTAMPTZ    NOT NULL,
        "source_at"                TIMESTAMPTZ,
        "amount_units"             BIGINT         NOT NULL,
        "amount_currency"          VARCHAR(3)     NOT NULL,
        "description"              VARCHAR,
        "source_system"            VARCHAR        NOT NULL,
        "source_reference"         VARCHAR        NOT NULL,
        "normalization_version"    VARCHAR        NOT NULL,
        "normalization_worker_id"  VARCHAR        NOT NULL,
        "hash"                     VARCHAR        NOT NULL,
        "previous_hash"            VARCHAR,
        "reporter_type"            VARCHAR        NOT NULL,
        "reporter_id"              VARCHAR        NOT NULL,
        "reporter_name"            VARCHAR,
        "reported_at"              TIMESTAMPTZ    NOT NULL,
        "reporter_channel"         VARCHAR        NOT NULL,
        "reason_type"              VARCHAR,
        "reason_description"       VARCHAR,
        "reason_confidence"        VARCHAR,
        "reason_requires_followup" BOOLEAN,
        CONSTRAINT "PK_ledger_events" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_ledger_events_hash" UNIQUE ("hash")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "ledger_event_parties" (
        "id"              SERIAL      NOT NULL,
        "event_id"        VARCHAR     NOT NULL,
        "party_id"        VARCHAR     NOT NULL,
        "role"            VARCHAR     NOT NULL,
        "direction"       VARCHAR     NOT NULL,
        "amount_units"    BIGINT,
        "amount_currency" VARCHAR(3),
        CONSTRAINT "PK_ledger_event_parties" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ledger_event_parties_event"
          FOREIGN KEY ("event_id") REFERENCES "ledger_events" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "ledger_event_objects" (
        "id"          SERIAL   NOT NULL,
        "event_id"    VARCHAR  NOT NULL,
        "object_id"   VARCHAR  NOT NULL,
        "object_type" VARCHAR  NOT NULL,
        "relation"    VARCHAR  NOT NULL,
        CONSTRAINT "PK_ledger_event_objects" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ledger_event_objects_event"
          FOREIGN KEY ("event_id") REFERENCES "ledger_events" ("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "ledger_event_objects"`);
    await queryRunner.query(`DROP TABLE "ledger_event_parties"`);
    await queryRunner.query(`DROP TABLE "ledger_events"`);
  }
}
