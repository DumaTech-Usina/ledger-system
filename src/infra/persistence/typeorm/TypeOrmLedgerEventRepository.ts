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
import { PositionAggregate, PositionAggregateOptions } from '../../../core/application/dtos/PositionAggregate';
import { EconomicOutcome, PositionStatus } from '../../../core/application/dtos/PositionSummary';

function statusToSql(status: PositionStatus): string {
  switch (status) {
    case 'open':
      return `(NOT has_reversal AND (total_originated = 0 OR total_settled + total_adjusted = 0))`;
    case 'partially_settled':
      return `(NOT has_reversal AND total_originated > 0 AND total_settled + total_adjusted > 0 AND total_settled + total_adjusted < total_originated)`;
    case 'fully_settled':
      return `(NOT has_reversal AND total_originated > 0 AND total_settled + total_adjusted >= total_originated)`;
    case 'reversed':
      return `has_reversal = true`;
  }
}

function outcomeToSql(outcome: EconomicOutcome): string {
  switch (outcome) {
    case 'pending':
      return `(NOT has_reversal AND (total_originated = 0 OR total_settled + total_adjusted < total_originated))`;
    case 'cancelled':
      return `has_reversal = true`;
    case 'gain':
      return `(NOT has_reversal AND total_originated > 0 AND total_settled + total_adjusted >= total_originated AND non_cash_closed = 0)`;
    case 'full_loss':
      return `(NOT has_reversal AND total_originated > 0 AND total_settled + total_adjusted >= total_originated AND cash_recovered = 0)`;
    case 'partial_loss':
      return `(NOT has_reversal AND total_originated > 0 AND total_settled + total_adjusted >= total_originated AND cash_recovered > 0 AND non_cash_closed > 0)`;
  }
}

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

  async findAllObjectIds(): Promise<string[]> {
    const rows = await this.repo.manager
      .getRepository(LedgerEventObjectModel)
      .createQueryBuilder('o')
      .select('DISTINCT o.objectId', 'objectId')
      .getRawMany<{ objectId: string }>();
    return rows.map((r) => r.objectId);
  }

  async findPositionAggregates(options: PositionAggregateOptions): Promise<Page<PositionAggregate>> {
    const page  = Math.max(1, options.page  ?? 1);
    const limit = Math.min(Math.max(1, options.limit ?? 50), 200);
    const offset = (page - 1) * limit;

    const filterParams: unknown[] = [];
    const conditions: string[] = [];

    if (options.objectType) {
      filterParams.push(options.objectType);
      conditions.push(`object_type = $${filterParams.length}`);
    }
    if (options.status)  conditions.push(statusToSql(options.status));
    if (options.outcome) conditions.push(outcomeToSql(options.outcome));

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const cteSql = `
      WITH aggs AS (
        SELECT
          o.object_id                                                                                    AS object_id,
          MAX(o.object_type)                                                                             AS object_type,
          MAX(e.amount_currency)                                                                         AS currency,
          COALESCE(SUM(CASE WHEN o.relation = 'originates' THEN e.amount_units ELSE 0::bigint END), 0)  AS total_originated,
          COALESCE(SUM(CASE WHEN o.relation = 'settles'    THEN e.amount_units ELSE 0::bigint END), 0)  AS total_settled,
          COALESCE(SUM(CASE WHEN o.relation = 'adjusts'    THEN e.amount_units ELSE 0::bigint END), 0)  AS total_adjusted,
          COALESCE(SUM(CASE WHEN o.relation = 'settles' AND e.economic_effect = 'cash_in'  THEN e.amount_units ELSE 0::bigint END), 0) AS cash_recovered,
          COALESCE(SUM(CASE WHEN o.relation = 'settles' AND e.economic_effect = 'non_cash' THEN e.amount_units ELSE 0::bigint END), 0) AS non_cash_closed,
          COALESCE(SUM(CASE WHEN o.relation = 'references' AND e.economic_effect = 'cash_in'  THEN e.amount_units ELSE 0::bigint END), 0) AS ref_cash_in,
          COALESCE(SUM(CASE WHEN o.relation = 'references' AND e.economic_effect = 'cash_out' THEN e.amount_units ELSE 0::bigint END), 0) AS ref_cash_out,
          BOOL_OR(o.relation = 'reverses')                                                              AS has_reversal,
          COUNT(DISTINCT e.id)                                                                           AS event_count,
          MAX(e.occurred_at)                                                                             AS last_event_at
        FROM ledger_events e
        JOIN ledger_event_objects o ON o.event_id = e.id
        GROUP BY o.object_id
      )
    `;

    const [countResult] = await this.repo.manager.query(
      `${cteSql} SELECT COUNT(*) AS total FROM aggs ${whereClause}`,
      filterParams,
    );
    const total = parseInt(countResult.total as string, 10);
    const totalPages = Math.ceil(total / limit) || 1;

    const dataParams = [...filterParams, limit, offset];
    const pLimit  = filterParams.length + 1;
    const pOffset = filterParams.length + 2;
    const rows: Record<string, unknown>[] = await this.repo.manager.query(
      `${cteSql} SELECT * FROM aggs ${whereClause} ORDER BY last_event_at DESC LIMIT $${pLimit} OFFSET $${pOffset}`,
      dataParams,
    );

    const data: PositionAggregate[] = rows.map((row) => ({
      objectId:             row.object_id as string,
      objectType:           row.object_type as ObjectType,
      currency:             row.currency as string,
      totalOriginatedUnits: BigInt(row.total_originated as string),
      totalSettledUnits:    BigInt(row.total_settled    as string),
      totalAdjustedUnits:   BigInt(row.total_adjusted   as string),
      cashRecoveredUnits:   BigInt(row.cash_recovered   as string),
      nonCashClosedUnits:   BigInt(row.non_cash_closed  as string),
      refCashInUnits:       BigInt(row.ref_cash_in      as string),
      refCashOutUnits:      BigInt(row.ref_cash_out     as string),
      hasReversal:          row.has_reversal as boolean,
      eventCount:           parseInt(row.event_count as string, 10),
      lastEventAt:          new Date(row.last_event_at as string),
    }));

    return { data, total, page, limit, totalPages };
  }

  async findPaginated(options: PageOptions): Promise<Page<LedgerEvent>> {
    const offset = (options.page - 1) * options.limit;
    const sortCol: keyof LedgerEventModel =
      options.sortBy === 'occurredAt' ? 'occurredAt' : 'recordedAt';
    const sortDir = options.sortOrder ?? 'ASC';
    const [rows, total] = await this.repo.findAndCount({
      skip: offset,
      take: options.limit,
      order: { [sortCol]: sortDir },
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
