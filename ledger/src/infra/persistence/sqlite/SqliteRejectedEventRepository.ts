import { DataSource } from 'typeorm';
import { RejectedEventRepository } from '../../../core/application/repositories/RejectedEventRepository';
import { RejectedEvent } from '../../../core/domain/entities/RejectedEvent';
import { EventId } from '../../../core/domain/value-objects/EventId';
import { StagingId } from '../../../core/domain/value-objects/StagingId';
import { RejectionReason } from '../../../core/domain/value-objects/RejectionReason';
import { RejectionType } from '../../../core/domain/value-objects/RejectionType';
import { Page, PageOptions } from '../../../core/application/dtos/Pagination';

const TABLE = 'rejected_events';

interface RejectedRow {
  id: string;
  staging_id: string;
  rejected_at: string;
  payload: string;
}

/** What travels in the `payload` column: the parts of a refusal that are not indexed. */
interface RejectedPayload {
  rawPayload: unknown | null;
  reasons: Array<{ type: string; description: string }>;
}

/**
 * The book's refusals, in the book's own file.
 *
 * A rejection is a record of what this ledger DECLINED to assert and why — it belongs beside the
 * events it was refused entry to, not in a separate store that a backup could capture at a
 * different moment. Kept together, "what the book knows" and "what it refused" are always the same
 * point in time.
 *
 * Reasons stay embedded, as they were: a reason has no life outside the rejection that carries it.
 */
export class SqliteRejectedEventRepository implements RejectedEventRepository {
  constructor(private readonly dataSource: DataSource) {}

  async save(event: RejectedEvent): Promise<void> {
    const payload: RejectedPayload = {
      rawPayload: event.rawPayload ?? null,
      reasons: event.reasons.map((reason) => ({
        type: reason.type,
        description: reason.description,
      })),
    };
    await this.dataSource.query(
      `INSERT INTO ${TABLE} (id, staging_id, rejected_at, payload) VALUES (?, ?, ?, ?)`,
      [event.id.value, event.stagingId.value, event.rejectedAt.toISOString(), JSON.stringify(payload)],
    );
  }

  async findAll(): Promise<RejectedEvent[]> {
    const rows: RejectedRow[] = await this.dataSource.query(
      `SELECT id, staging_id, rejected_at, payload FROM ${TABLE}`,
    );
    return rows.map((row) => this.toEntity(row));
  }

  async findPaginated(options: PageOptions): Promise<Page<RejectedEvent>> {
    const offset = (options.page - 1) * options.limit;
    const [rows, counted] = await Promise.all([
      this.dataSource.query(
        `SELECT id, staging_id, rejected_at, payload FROM ${TABLE} LIMIT ? OFFSET ?`,
        [options.limit, offset],
      ) as Promise<RejectedRow[]>,
      this.dataSource.query(`SELECT COUNT(*) AS total FROM ${TABLE}`) as Promise<
        { total: number }[]
      >,
    ]);
    const total = Number(counted[0].total);
    return {
      data: rows.map((row) => this.toEntity(row)),
      total,
      page: options.page,
      limit: options.limit,
      totalPages: Math.ceil(total / options.limit) || 1,
    };
  }

  private toEntity(row: RejectedRow): RejectedEvent {
    const payload = JSON.parse(row.payload) as RejectedPayload;
    return RejectedEvent.reconstitute({
      id: new EventId(row.id),
      stagingId: new StagingId(row.staging_id),
      rejectedAt: new Date(row.rejected_at),
      rawPayload: payload.rawPayload ?? undefined,
      reasons: payload.reasons.map(
        (reason) => new RejectionReason(reason.type as RejectionType, reason.description),
      ),
    });
  }
}
