import { EventReason } from "../../domain/entities/EventReason";
import { EventReporter } from "../../domain/entities/EventReporter";
import { LedgerEventObject } from "../../domain/entities/LedgerEconomicObject";
import { LedgerEvent } from "../../domain/entities/LedgerEvent";
import { LedgerEventParty } from "../../domain/entities/LedgerEventParty";
import { EventHash } from "../../domain/value-objects/EventHash";
import { EventId } from "../../domain/value-objects/EventId";
import { Money } from "../../domain/value-objects/Money";
import { NormalizationMetadata } from "../../domain/value-objects/NormalizationMetadata";
import { ObjectId } from "../../domain/value-objects/ObjectId";
import { PartyId } from "../../domain/value-objects/PartyId";
import { CreateLedgerEventCommand } from "../dtos/CreateLedgerEventInput";
import { LedgerEventRepository } from "../repositories/LedgerEventRepository";
import { EventSource } from "../../domain/value-objects/EventSource";

export class CreateLedgerEventUseCase {
  constructor(private readonly repository: LedgerEventRepository) {}

  async execute(command: CreateLedgerEventCommand): Promise<LedgerEvent> {
    const id = new EventId(crypto.randomUUID());

    const money = Money.fromDecimal(command.amount, command.currency);

    const normalization = new NormalizationMetadata(
      command.normalizationVersion,
      command.normalizationWorkerId,
    );

    const source = new EventSource(
      command.sourceSystem,
      command.sourceReference,
    );

    const previousHash = command.previousHash
      ? EventHash.generateCanonical(command.previousHash)
      : await this.repository.getLastEventHash();

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

      parties,
      objects,
      reason,
      reporter,
    });

    await this.repository.save(event);

    return event;
  }
}
