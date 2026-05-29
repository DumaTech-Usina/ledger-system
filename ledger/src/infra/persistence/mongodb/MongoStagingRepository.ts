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

  async save(record: StagingRecord): Promise<void> {
    const doc: StagingRecordDocument = {
      _id: record.id,
      status: record.status,
      eventType: record.eventType,
      economicEffect: record.economicEffect,
      occurredAt: record.occurredAt,
      sourceAt: record.sourceAt ?? null,
      amount: record.amount,
      currency: record.currency,
      description: record.description ?? null,
      sourceSystem: record.sourceSystem,
      sourceReference: record.sourceReference,
      normalizationVersion: record.normalizationVersion,
      normalizationWorkerId: record.normalizationWorkerId,
      previousHash: record.previousHash ?? null,
      parties: record.parties ?? null,
      objects: record.objects ?? null,
      reason: record.reason ?? null,
      reporter: record.reporter,
    };
    await this.collection.updateOne(
      { sourceReference: record.sourceReference },
      { $setOnInsert: doc },
      { upsert: true },
    );
  }

  async claimPending(targetStatus: 'processing' | 'queued', limit = 100, eventTypes?: string[]): Promise<StagingRecord[]> {
    const filter: Record<string, unknown> = { status: 'pending' };
    if (eventTypes?.length) filter['eventType'] = { $in: eventTypes };
    const results: StagingRecord[] = [];
    for (let i = 0; i < limit; i++) {
      const doc = await this.collection.findOneAndUpdate(
        filter,
        { $set: { status: targetStatus } },
        { returnDocument: 'after' },
      );
      if (!doc) break;
      results.push(this.toDto(doc));
    }
    return results;
  }

  async markAsAccepted(id: string): Promise<void> {
    await this.collection.updateOne({ _id: id }, { $set: { status: 'accepted' } });
  }

  async markAsRejected(id: string): Promise<void> {
    await this.collection.updateOne({ _id: id }, { $set: { status: 'rejected' } });
  }

  async markAsPending(id: string): Promise<void> {
    await this.collection.updateOne({ _id: id }, { $set: { status: 'pending' } });
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
