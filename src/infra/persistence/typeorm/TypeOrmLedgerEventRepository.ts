import { DataSource, Repository } from 'typeorm';
import { LedgerEventRepository } from '../../../core/application/repositories/LedgerEventRepository';
import { LedgerEvent } from '../../../core/domain/entities/LedgerEvent';
import { LedgerEventParty } from '../../../core/domain/entities/LedgerEventParty';
import { LedgerEventObject } from '../../../core/domain/entities/LedgerEconomicObject';
import { EventReason } from '../../../core/domain/entities/EventReason';
import { EventReporter } from '../../../core/domain/entities/EventReporter';
import { EconomicEffect } from '../../../core/domain/enums/EconomicEffect';
import { EventType } from '../../../core/domain/enums/EventType';
import { Direction } from '../../../core/domain/enums/Direction';
import { PartyRole } from '../../../core/domain/enums/PartyRole';
import { ObjectType } from '../../../core/domain/enums/ObjectType';
import { Relation } from '../../../core/domain/enums/Relation';
import { ReporterType } from '../../../core/domain/enums/ReporterType';
import { ConfidenceLevel } from '../../../core/domain/enums/ConfidenceLevel';
import { ReasonType } from '../../../core/domain/enums/ReasonType';
import { EventHash } from '../../../core/domain/value-objects/EventHash';
import { EventId } from '../../../core/domain/value-objects/EventId';
import { Money } from '../../../core/domain/value-objects/Money';
import { EventSource } from '../../../core/domain/value-objects/EventSource';
import { NormalizationMetadata } from '../../../core/domain/value-objects/NormalizationMetadata';
import { ObjectId } from '../../../core/domain/value-objects/ObjectId';
import { PartyId } from '../../../core/domain/value-objects/PartyId';
import { LedgerEventModel } from './models/LedgerEventModel';
import { LedgerEventPartyModel } from './models/LedgerEventPartyModel';
import { LedgerEventObjectModel } from './models/LedgerEventObjectModel';
import { Page, PageOptions } from '../../../core/application/dtos/Pagination';

export class TypeOrmLedgerEventRepository implements LedgerEventRepository {
  private readonly repo: Repository<LedgerEventModel>;

  constructor(dataSource: DataSource) {
    this.repo = dataSource.getRepository(LedgerEventModel);
  }

  async save(event: LedgerEvent): Promise<void> {
    const model = this.toModel(event);
    await this.repo.save(model);
  }

  async getById(id: string): Promise<LedgerEvent | null> {
    const row = await this.repo.findOneBy({ id });
    return row ? this.toEntity(row) : null;
  }

  async getByHash(hash: string): Promise<LedgerEvent | null> {
    const row = await this.repo.findOneBy({ hash });
    return row ? this.toEntity(row) : null;
  }

  async getByCommandId(commandId: string): Promise<LedgerEvent | null> {
    const row = await this.repo.findOneBy({ commandId });
    return row ? this.toEntity(row) : null;
  }

  async getLastEventHash(): Promise<EventHash | null> {
    const row = await this.repo.findOne({
      where: {},
      order: { recordedAt: 'DESC' },
      select: ['hash'],
    });

    return row ? EventHash.fromValue(row.hash) : null;
  }

  async existsBySourceReference(sourceReference: string): Promise<boolean> {
    return this.repo.existsBy({ sourceReference });
  }

  async findByObjectId(objectId: string): Promise<LedgerEvent[]> {
    const rows = await this.repo
      .createQueryBuilder('e')
      .innerJoin('e.objects', 'o', 'o.objectId = :objectId', { objectId })
      .orderBy('e.recordedAt', 'ASC')
      .getMany();
    return rows.map((row) => this.toEntity(row));
  }

  async findByRelatedEventId(relatedEventId: string): Promise<LedgerEvent[]> {
    const rows = await this.repo.find({
      where: { relatedEventId },
      order: { recordedAt: 'ASC' },
    });
    return rows.map((row) => this.toEntity(row));
  }

  async findByPartyId(partyId: string): Promise<LedgerEvent[]> {
    const rows = await this.repo
      .createQueryBuilder('e')
      .innerJoin('e.parties', 'p', 'p.partyId = :partyId', { partyId })
      .orderBy('e.recordedAt', 'ASC')
      .getMany();
    return rows.map((row) => this.toEntity(row));
  }

  async findAll(): Promise<LedgerEvent[]> {
    const rows = await this.repo.find();
    return rows.map((row) => this.toEntity(row));
  }

  async findPaginated(options: PageOptions): Promise<Page<LedgerEvent>> {
    const offset = (options.page - 1) * options.limit;
    const [rows, total] = await this.repo.findAndCount({
      skip: offset,
      take: options.limit,
      order: { recordedAt: 'ASC' },
    });
    const totalPages = Math.ceil(total / options.limit) || 1;
    return {
      data: rows.map((row) => this.toEntity(row)),
      total,
      page: options.page,
      limit: options.limit,
      totalPages,
    };
  }

  // ── Mapping ──────────────────────────────────────────────────────────────

  private toModel(event: LedgerEvent): LedgerEventModel {
    const reporter = event.getReporter();
    const reason = event.getReason();

    const model = new LedgerEventModel();
    model.id = event.id.value;
    model.eventType = event.eventType;
    model.economicEffect = event.economicEffect;
    model.occurredAt = event.occurredAt;
    model.recordedAt = event.recordedAt;
    model.sourceAt = event.sourceAt;
    model.amountUnits = event.amount.toUnits();
    model.amountCurrency = event.amount.currency;
    model.description = event.description;
    model.sourceSystem = event.source.system;
    model.sourceReference = event.source.reference;
    model.normalizationVersion = event.normalization.version;
    model.normalizationWorkerId = event.normalization.workerId;
    model.hash = event.hash.value;
    model.previousHash = event.previousHash?.value ?? null;
    model.commandId = event.commandId;
    model.relatedEventId = event.relatedEventId;

    model.reporterType = reporter.reporterType;
    model.reporterId = reporter.reporterId;
    model.reporterName = reporter.reporterName;
    model.reportedAt = reporter.reportedAt;
    model.reporterChannel = reporter.channel;

    model.reasonType = reason?.type ?? null;
    model.reasonDescription = reason?.description ?? null;
    model.reasonConfidence = reason?.confidence ?? null;
    model.reasonRequiresFollowup = reason?.requiresFollowup ?? null;

    model.parties = event.getParties().map((p) => {
      const pm = new LedgerEventPartyModel();
      pm.eventId = event.id.value;
      pm.partyId = p.partyId.value;
      pm.role = p.role;
      pm.direction = p.direction;
      pm.amountUnits = p.amount?.toUnits() ?? null;
      pm.amountCurrency = p.amount?.currency ?? null;
      return pm;
    });

    model.objects = event.getObjects().map((o) => {
      const om = new LedgerEventObjectModel();
      om.eventId = event.id.value;
      om.objectId = o.objectId.value;
      om.objectType = o.objectType;
      om.relation = o.relation;
      return om;
    });

    return model;
  }

  private toEntity(row: LedgerEventModel): LedgerEvent {
    const reporter = new EventReporter(
      row.reporterType as ReporterType,
      row.reporterId,
      row.reporterName,
      row.reportedAt,
      row.reporterChannel,
    );

    const reason =
      row.reasonType && row.reasonDescription && row.reasonConfidence
        ? new EventReason(
            row.reasonType as ReasonType,
            row.reasonDescription,
            row.reasonConfidence as ConfidenceLevel,
            row.reasonRequiresFollowup ?? false,
          )
        : null;

    const parties: LedgerEventParty[] = row.parties.map(
      (p) =>
        new LedgerEventParty(
          new PartyId(p.partyId),
          p.role as PartyRole,
          p.direction as Direction,
          p.amountUnits !== null && p.amountCurrency
            ? Money.fromUnits(p.amountUnits, p.amountCurrency)
            : null,
        ),
    );

    const objects: LedgerEventObject[] = row.objects.map(
      (o) =>
        new LedgerEventObject(
          new ObjectId(o.objectId),
          o.objectType as ObjectType,
          o.relation as Relation,
        ),
    );

    return LedgerEvent.reconstitute({
      id: new EventId(row.id),
      eventType: row.eventType as EventType,
      economicEffect: row.economicEffect as EconomicEffect,
      occurredAt: row.occurredAt,
      recordedAt: row.recordedAt,
      sourceAt: row.sourceAt,
      amount: Money.fromUnits(row.amountUnits!, row.amountCurrency),
      description: row.description,
      source: new EventSource(row.sourceSystem, row.sourceReference),
      normalization: new NormalizationMetadata(row.normalizationVersion, row.normalizationWorkerId),
      hash: EventHash.fromValue(row.hash),
      previousHash: row.previousHash ? EventHash.fromValue(row.previousHash) : null,
      commandId: row.commandId,
      relatedEventId: row.relatedEventId,
      parties,
      objects,
      reason,
      reporter,
    });
  }
}
