import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRelatedEventId1744934400000 implements MigrationInterface {
  name = 'AddRelatedEventId1744934400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ledger_events"
        ADD COLUMN "related_event_id" VARCHAR
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ledger_events_related_event_id"
        ON "ledger_events" ("related_event_id")
        WHERE "related_event_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_ledger_events_related_event_id"`);
    await queryRunner.query(`ALTER TABLE "ledger_events" DROP COLUMN "related_event_id"`);
  }
}
