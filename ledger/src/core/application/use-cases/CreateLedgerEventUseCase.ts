import { EventReason } from "../../domain/entities/EventReason";
import { EventReporter } from "../../domain/entities/EventReporter";
import { LedgerEventObject } from "../../domain/entities/LedgerEconomicObject";
import { LedgerEvent } from "../../domain/entities/LedgerEvent";
import { LedgerEventParty } from "../../domain/entities/LedgerEventParty";
import { EVENT_CONTRACTS } from "../../domain/contracts/EventContract";
import { retractedEventIds } from "../dtos/retractionUtils";
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

    // Pillar 10 — rectification: a retraction speaks about ONE standing assertion.
    //
    // Two rules need the ledger, so they cannot live in InvariantPolicy (which sees only the event):
    //
    //  - one standing retraction per target. Without it, two retractions on the same event are
    //    ambiguous — a repeat or a double negative? With it, retractions form a chain, never a tree,
    //    and the chain can be folded deterministically by every reader;
    //  - depth 1 (approved). A retraction may be retracted; a retraction OF a retraction may not.
    //    This caps the fold at two hops, so no reader ever needs a recursive walk.
    const isRetraction = command.objects.some((o) => o.relation === Relation.RETRACTS);

    if (originEvent && isRetraction) {
      const carriesRetraction = (e: LedgerEvent) =>
        e.getObjects().some((o) => o.relation === Relation.RETRACTS);

      const existingRetractions = (await this.repository.findByRelatedEventId(command.relatedEventId!))
        .filter(carriesRetraction);

      if (existingRetractions.length > 0) {
        throw new Error(
          `Event ${command.relatedEventId} has already been retracted by ${existingRetractions[0].id.value}`,
        );
      }

      if (carriesRetraction(originEvent) && originEvent.relatedEventId) {
        const retractedByTarget = await this.repository.getById(originEvent.relatedEventId);
        if (retractedByTarget && carriesRetraction(retractedByTarget)) {
          throw new Error(
            "Retraction chain too deep: a retraction of a retraction cannot itself be retracted",
          );
        }
      }
    }

    const hasSettlesRelation = command.objects.some((o) => o.relation === Relation.SETTLES);

    if (originEvent && hasSettlesRelation) {
      const existing = await this.repository.findByRelatedEventId(command.relatedEventId!);
      const settlements = existing.filter((e) =>
        e.getObjects().some((o) => o.relation === Relation.SETTLES),
      );

      // Conservation is measured against what still STANDS. A settlement that was retracted never
      // happened, so counting it here would make the ledger refuse the true fact that replaces it —
      // which is exactly the failure the rectification exists to remove.
      //
      // A retraction points at the settlement, not at the origin, so it is not among `existing`:
      // one hop finds the retractions, a second finds any that were themselves retracted. Depth 1
      // guarantees there is no third. The fold itself stays in retractedEventIds — one rule, one
      // place, so the projection and this guard can never disagree about what stands.
      const firstHop = (
        await Promise.all(settlements.map((e) => this.repository.findByRelatedEventId(e.id.value)))
      ).flat();
      const secondHop = (
        await Promise.all(firstHop.map((e) => this.repository.findByRelatedEventId(e.id.value)))
      ).flat();
      const retracted = retractedEventIds([...firstHop, ...secondHop]);

      const alreadySettled = settlements
        .filter((e) => !retracted.has(e.id.value))
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
