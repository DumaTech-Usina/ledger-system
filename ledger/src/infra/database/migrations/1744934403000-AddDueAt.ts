import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `due_at` — when an originated obligation falls due, as stated by the external fact that
 * established it (an invoice's terms, a tax assessment).
 *
 * Nullable and deliberately NOT backfilled. Every event recorded before this column existed carries
 * no due date, and that is the truthful value: those obligations never stated terms to this book.
 * Deriving one from `occurred_at` would be the ledger inventing a fact to fill its own gap, and the
 * aging figures computed downstream would then be measuring an invention.
 *
 * The index is partial. Only rows that actually carry a due date are ever ordered or filtered by it,
 * so indexing the nulls would cost writes on every event in the book to serve no read.
 */
export class AddDueAt1744934403000 implements MigrationInterface {
  name = 'AddDueAt1744934403000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ledger_events"
        ADD COLUMN "due_at" TIMESTAMPTZ
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ledger_events_due_at"
        ON "ledger_events" ("due_at")
        WHERE "due_at" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_ledger_events_due_at"`);
    await queryRunner.query(`
      ALTER TABLE "ledger_events"
        DROP COLUMN "due_at"
    `);
  }
}
