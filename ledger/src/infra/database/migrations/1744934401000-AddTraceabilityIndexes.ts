import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTraceabilityIndexes1744934401000 implements MigrationInterface {
  name = 'AddTraceabilityIndexes1744934401000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // findByObjectId — join on ledger_event_objects.object_id
    await queryRunner.query(`
      CREATE INDEX "IDX_ledger_event_objects_object_id"
        ON "ledger_event_objects" ("object_id")
    `);

    // findByPartyId — join on ledger_event_parties.party_id
    await queryRunner.query(`
      CREATE INDEX "IDX_ledger_event_parties_party_id"
        ON "ledger_event_parties" ("party_id")
    `);

    // findByObjectId / findByPartyId — join back to parent event
    await queryRunner.query(`
      CREATE INDEX "IDX_ledger_event_objects_event_id"
        ON "ledger_event_objects" ("event_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ledger_event_parties_event_id"
        ON "ledger_event_parties" ("event_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_ledger_event_parties_event_id"`);
    await queryRunner.query(`DROP INDEX "IDX_ledger_event_objects_event_id"`);
    await queryRunner.query(`DROP INDEX "IDX_ledger_event_parties_party_id"`);
    await queryRunner.query(`DROP INDEX "IDX_ledger_event_objects_object_id"`);
  }
}
