import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommandId1744934402000 implements MigrationInterface {
  name = 'AddCommandId1744934402000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ledger_events"
        ADD COLUMN "command_id" VARCHAR,
        ADD CONSTRAINT "UQ_ledger_events_command_id" UNIQUE ("command_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ledger_events"
        DROP CONSTRAINT "UQ_ledger_events_command_id",
        DROP COLUMN "command_id"
    `);
  }
}
