import { Collection, Db } from 'mongodb';
import { StagingRepository } from '../../../core/application/repositories/StagingRepository';
import { StagingRecord } from '../../../core/application/dtos/StagingRecord';
import { StagingRecordDocument } from './StagingRecordDocument';
import { Page, PageOptions } from '../../../core/application/dtos/Pagination';

const COLLECTION = 'staging_records';

export class MongoStagingRepository implements StagingRepository {
  private readonly collection: Collection<StagingRecordDocument>;

  constructor(db: Db) {
    this.collection = db.collection<StagingRecordDocument>(COLLECTION);
  }

  async claimPendingRecords(limit = 100): Promise<StagingRecord[]> {
    const docs = await this.collection
      .find({ status: 'pending' })
      .limit(limit)
      .toArray();
    const ids = docs.map((d) => d._id);
    if (ids.length > 0) {
      await this.collection.updateMany({ _id: { $in: ids } }, { $set: { status: 'processing' } });
    }
    return docs.map((doc) => this.toDto(doc));
  }

  async markAsAccepted(id: string): Promise<void> {
    await this.collection.updateOne({ _id: id }, { $set: { status: 'accepted' } });
  }

  async markAsRejected(id: string): Promise<void> {
    await this.collection.updateOne({ _id: id }, { $set: { status: 'rejected' } });
  }

  async findAll(): Promise<StagingRecord[]> {
    const docs = await this.collection.find().toArray();
    return docs.map((doc) => this.toDto(doc));
  }

  async findPaginated(options: PageOptions): Promise<Page<StagingRecord>> {
    const offset = (options.page - 1) * options.limit;
    const [docs, total] = await Promise.all([
      this.collection.find().skip(offset).limit(options.limit).toArray(),
      this.collection.countDocuments(),
    ]);
    const totalPages = Math.ceil(total / options.limit) || 1;
    return {
      data: docs.map((doc) => this.toDto(doc)),
      total,
      page: options.page,
      limit: options.limit,
      totalPages,
    };
  }

  private toDto(doc: StagingRecordDocument): StagingRecord {
    return {
      id: doc._id,
      status: doc.status,
      eventType: doc.eventType,
      economicEffect: doc.economicEffect,
      occurredAt: doc.occurredAt,
      sourceAt: doc.sourceAt,
      amount: doc.amount,
      currency: doc.currency,
      description: doc.description,
      sourceSystem: doc.sourceSystem,
      sourceReference: doc.sourceReference,
      normalizationVersion: doc.normalizationVersion,
      normalizationWorkerId: doc.normalizationWorkerId,
      previousHash: doc.previousHash,
      parties: doc.parties ?? undefined,
      objects: doc.objects ?? undefined,
      reason: doc.reason,
      reporter: doc.reporter,
    };
  }
}
