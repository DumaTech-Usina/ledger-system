import { Collection, Db } from 'mongodb';
import { RejectedEventRepository } from '../../../core/application/repositories/RejectedEventRepository';
import { RejectedEvent } from '../../../core/domain/entities/RejectedEvent';
import { EventId } from '../../../core/domain/value-objects/EventId';
import { StagingId } from '../../../core/domain/value-objects/StagingId';
import { RejectionReason } from '../../../core/domain/value-objects/RejectionReason';
import { RejectionType } from '../../../core/domain/value-objects/RejectionType';
import { RejectedEventDocument } from './RejectedEventDocument';
import { Page, PageOptions } from '../../../core/application/dtos/Pagination';

const COLLECTION = 'rejected_events';

export class MongoRejectedEventRepository implements RejectedEventRepository {
  private readonly collection: Collection<RejectedEventDocument>;

  constructor(db: Db) {
    this.collection = db.collection<RejectedEventDocument>(COLLECTION);
  }

  async save(event: RejectedEvent): Promise<void> {
    const doc: RejectedEventDocument = {
      _id: event.id.value,
      stagingId: event.stagingId.value,
      rejectedAt: event.rejectedAt,
      rawPayload: event.rawPayload ?? null,
      reasons: event.reasons.map((r) => ({
        type: r.type,
        description: r.description,
      })),
    };

    await this.collection.insertOne(doc);
  }

  async findAll(): Promise<RejectedEvent[]> {
    const docs = await this.collection.find().toArray();
    return docs.map((doc) => this.toEntity(doc));
  }

  async findPaginated(options: PageOptions): Promise<Page<RejectedEvent>> {
    const offset = (options.page - 1) * options.limit;
    const [docs, total] = await Promise.all([
      this.collection.find().skip(offset).limit(options.limit).toArray(),
      this.collection.countDocuments(),
    ]);
    const totalPages = Math.ceil(total / options.limit) || 1;
    return {
      data: docs.map((doc) => this.toEntity(doc)),
      total,
      page: options.page,
      limit: options.limit,
      totalPages,
    };
  }

  private toEntity(doc: RejectedEventDocument): RejectedEvent {
    return RejectedEvent.reconstitute({
      id: new EventId(doc._id),
      stagingId: new StagingId(doc.stagingId),
      rejectedAt: doc.rejectedAt,
      rawPayload: doc.rawPayload ?? undefined,
      reasons: doc.reasons.map(
        (r) => new RejectionReason(r.type as RejectionType, r.description),
      ),
    });
  }
}
