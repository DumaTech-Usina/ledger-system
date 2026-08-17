import { DataSource, EntityManager } from 'typeorm';
import { StagingRepository } from '../../../core/application/repositories/StagingRepository';
import { StagingRecord } from '../../../core/application/dtos/StagingRecord';
import { Page, PageOptions } from '../../../core/application/dtos/Pagination';

const TABLE = 'staging_records';

/** `?` placeholders for a list bound one value per element. */
const placeholders = (count: number): string => new Array(count).fill('?').join(', ');

interface StagingRow {
  id: string;
  status: string;
  payload: string;
}

/**
 * Staging records, in the book's own file.
 *
 * A staging record is a CANDIDATE — something proposed to the book and not yet asserted by it. Its
 * fields are therefore not yet known to be well-formed, and normalizing them into typed columns
 * would state more about the record than staging is entitled to state. So the record travels whole,
 * as JSON in `payload`, and only what the pipeline actually selects on — the status, the event type,
 * the source reference — is lifted into columns where an index can reach it.
 *
 * `status` is the one field the column owns rather than the payload: it is what the claim and the
 * mark operations write, so a payload copy could disagree with it. Reads always take the column's.
 */
export class SqliteStagingRepository implements StagingRepository {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Insert-if-absent, keyed on the source reference — never an update.
   *
   * The same external fact arriving twice must not overwrite the record already staged for it: the
   * pipeline may have advanced its status since, and a second ingestion pass would reset it and
   * post the event a second time. `INSERT OR IGNORE` is exactly that reading — the row that is
   * already there is the one that stays.
   */
  async save(record: StagingRecord): Promise<void> {
    await this.dataSource.query(
      `INSERT OR IGNORE INTO ${TABLE} (id, status, event_type, source_reference, payload)
       VALUES (?, ?, ?, ?, ?)`,
      [
        record.id,
        record.status,
        record.eventType ?? '',
        record.sourceReference ?? record.id,
        JSON.stringify(record),
      ],
    );
  }

  /**
   * Takes up to `limit` pending records and marks them claimed, so no second reader can take the
   * same one.
   *
   * The select and the update run in ONE transaction. SQLite serializes writers, so the transaction
   * holds the write lock across both statements and the window in which two claimers could see the
   * same pending row does not exist — the guarantee Mongo's `findOneAndUpdate` gave, obtained here
   * without the record-at-a-time round trip it needed.
   */
  async claimPending(
    targetStatus: 'processing' | 'queued',
    limit = 100,
    eventTypes?: string[],
  ): Promise<StagingRecord[]> {
    return this.dataSource.transaction(async (manager: EntityManager) => {
      const typeFilter = eventTypes?.length
        ? ` AND event_type IN (${placeholders(eventTypes.length)})`
        : '';
      const rows: StagingRow[] = await manager.query(
        `SELECT id, status, payload FROM ${TABLE}
          WHERE status = 'pending'${typeFilter}
          LIMIT ?`,
        [...(eventTypes ?? []), limit],
      );
      if (rows.length === 0) return [];

      const ids = rows.map((row) => row.id);
      await manager.query(
        `UPDATE ${TABLE} SET status = ? WHERE id IN (${placeholders(ids.length)})`,
        [targetStatus, ...ids],
      );

      // The claimed status, not the one just read — the caller is handed the record as it now
      // stands, which is what a claim means.
      return rows.map((row) => this.toDto({ ...row, status: targetStatus }));
    });
  }

  async markAsAccepted(id: string): Promise<void> {
    await this.setStatus(id, 'accepted');
  }

  async markAsRejected(id: string): Promise<void> {
    await this.setStatus(id, 'rejected');
  }

  async markAsPending(id: string): Promise<void> {
    await this.setStatus(id, 'pending');
  }

  async findAll(): Promise<StagingRecord[]> {
    const rows: StagingRow[] = await this.dataSource.query(
      `SELECT id, status, payload FROM ${TABLE}`,
    );
    return rows.map((row) => this.toDto(row));
  }

  async findPaginated(options: PageOptions): Promise<Page<StagingRecord>> {
    const offset = (options.page - 1) * options.limit;
    const [rows, counted] = await Promise.all([
      this.dataSource.query(
        `SELECT id, status, payload FROM ${TABLE} LIMIT ? OFFSET ?`,
        [options.limit, offset],
      ) as Promise<StagingRow[]>,
      this.dataSource.query(`SELECT COUNT(*) AS total FROM ${TABLE}`) as Promise<
        { total: number }[]
      >,
    ]);
    const total = Number(counted[0].total);
    return {
      data: rows.map((row) => this.toDto(row)),
      total,
      page: options.page,
      limit: options.limit,
      totalPages: Math.ceil(total / options.limit) || 1,
    };
  }

  private async setStatus(id: string, status: string): Promise<void> {
    await this.dataSource.query(`UPDATE ${TABLE} SET status = ? WHERE id = ?`, [status, id]);
  }

  private toDto(row: StagingRow): StagingRecord {
    const payload = JSON.parse(row.payload) as StagingRecord;
    return { ...payload, id: row.id, status: row.status as StagingRecord['status'] };
  }
}
