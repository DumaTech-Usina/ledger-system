import { EventReason } from "../../domain/entities/EventReason";
import { EventReporter } from "../../domain/entities/EventReporter";
import { LedgerEventObject } from "../../domain/entities/LedgerEconomicObject";
import { LedgerEvent } from "../../domain/entities/LedgerEvent";
import { LedgerEventParty } from "../../domain/entities/LedgerEventParty";
import { EVENT_CONTRACTS } from "../../domain/contracts/EventContract";
import { Relation } from "../../domain/enums/Relation";
import { EventHash } from "../../domain/value-objects/EventHash";
import { EventId } from "../../domain/value-objects/EventId";
import { Money } from "../../domain/value-objects/Money";
import { NormalizationMetadata } from "../../domain/value-objects/NormalizationMetadata";
import { ObjectId } from "../../domain/value-objects/ObjectId";
import { PartyId } from "../../domain/value-objects/PartyId";
import { CreateLedgerEventCommand } from "../dtos/CreateLedgerEventInput";
import { LedgerEventRepository } from "../repositories/LedgerEventRepository";
import { EventSource } from "../../domain/value-objects/EventSource";
import { IAuditLogger } from "../services/IAuditLogger";

export class CreateLedgerEventUseCase {
  constructor(
    private readonly repository: LedgerEventRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async execute(command: CreateLedgerEventCommand): Promise<LedgerEvent> {
    if (command.commandId) {
      const existing = await this.repository.getByCommandId(command.commandId);
      if (existing) return existing;
    }

    // Pillar 8 — idempotency: source reference must be unique across the ledger
    if (await this.repository.existsBySourceReference(command.sourceReference)) {
      throw new Error(`Duplicate source reference: ${command.sourceReference}`);
    }

    const id = new EventId(crypto.randomUUID());

    const money = Money.fromDecimal(command.amount, command.currency);

    // Pillar 10 — entity identity: validate relatedEventId existence and type
    // Pillar 1  — conservation: enforce over-settlement guard
    const contract = EVENT_CONTRACTS[command.eventType];
    let originEvent: LedgerEvent | null = null;

    if (command.relatedEventId) {
      originEvent = await this.repository.getById(command.relatedEventId);

      if (!originEvent) {
        throw new Error(`Origin event not found: ${command.relatedEventId}`);
      }

      if (contract?.allowedOriginTypes && !contract.allowedOriginTypes.includes(originEvent.eventType)) {
        throw new Error(
          `relatedEventId must point to a ${contract.allowedOriginTypes.join(" or ")} event, ` +
          `but found ${originEvent.eventType}`,
        );
      }
    }

    const hasSettlesRelation = command.objects.some((o) => o.relation === Relation.SETTLES);

    if (originEvent && hasSettlesRelation) {
      const existing = await this.repository.findByRelatedEventId(command.relatedEventId!);
      const alreadySettled = existing
        .filter((e) => e.getObjects().some((o) => o.relation === Relation.SETTLES))
        .reduce((acc, e) => acc + e.amount.toUnits(), 0n);

      if (alreadySettled + money.toUnits() > originEvent.amount.toUnits()) {
        throw new Error(
          `Over-settlement: total settled would exceed origin amount of ${originEvent.amount.toString()}`,
        );
      }
    }

    const normalization = new NormalizationMetadata(
      command.normalizationVersion,
      command.normalizationWorkerId,
    );

    const source = new EventSource(
      command.sourceSystem,
      command.sourceReference,
    );

    const previousHash: EventHash | null = await this.repository.getLastEventHash();

    const parties = command.parties.map(
      (p) =>
        new LedgerEventParty(
          new PartyId(p.partyId),
          p.role,
          p.direction,
          p.amount ? Money.fromDecimal(p.amount, command.currency) : null,
        ),
    );

    const objects = command.objects.map(
      (o) =>
        new LedgerEventObject(
          new ObjectId(o.objectId),
          o.objectType,
          o.relation,
        ),
    );

    const reason = command.reason
      ? new EventReason(
          command.reason.type,
          command.reason.description,
          command.reason.confidence,
          command.reason.requiresFollowup,
        )
      : null;

    const reporter = new EventReporter(
      command.reporter.reporterType,
      command.reporter.reporterId,
      command.reporter.reporterName ?? null,
      new Date(),
      command.reporter.channel,
    );

    const event = LedgerEvent.create({
      id,
      eventType: command.eventType,
      economicEffect: command.economicEffect,
      occurredAt: command.occurredAt,
      sourceAt: command.sourceAt ?? null,
      amount: money,
      description: command.description ?? null,
      source,
      normalization,
      previousHash,
      commandId: command.commandId ?? null,
      relatedEventId: command.relatedEventId ?? null,

      parties,
      objects,
      reason,
      reporter,
    });

    await this.repository.save(event);

    await this.audit.log({
      action: "LEDGER_EVENT_CREATED",
      timestamp: event.recordedAt.toISOString(),
      sourceSystem: command.sourceSystem,
      sourceReference: command.sourceReference,
      eventId: event.id.value,
      eventType: event.eventType,
      economicEffect: event.economicEffect,
      commandId: event.commandId,
    });

    return event;
  }
}
