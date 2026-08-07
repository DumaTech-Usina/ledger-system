import { EventReason } from "../../domain/entities/EventReason";
import { EventReporter } from "../../domain/entities/EventReporter";
import { LedgerEventObject } from "../../domain/entities/LedgerEconomicObject";
import { LedgerEvent } from "../../domain/entities/LedgerEvent";
import { LedgerEventParty } from "../../domain/entities/LedgerEventParty";
import { EVENT_CONTRACTS } from "../../domain/contracts/EventContract";
import { foldObjectTotals, retractedEventIds } from "../dtos/retractionUtils";
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

    // ── Conservation (Pillar 1): nothing closes more than was opened ─────────────
    //
    // Measured on the POSITION, not on one origin event. Until this was corrected the guard compared
    // against `originEvent.amount` and only ran when the command carried a relatedEventId, which left
    // two holes: a settlement with no lineage was never checked at all, and a position opened by more
    // than one event — or whose origination was retracted and reissued — was measured against the
    // wrong baseline. Both are reachable, and the second became routine once obligations could be
    // recognized and corrected.
    //
    // The objectId is the position (see refinamento_de_valor.md §2.1), so the objectId is what this
    // reads. Retracted events are excluded by the same fold every projection uses, so the guard and
    // the read paths can never disagree about what stands.
    for (const object of command.objects) {
      if (object.relation !== Relation.SETTLES) continue;

      const positionEvents = await this.repository.findByObjectId(object.objectId);
      const { originatedUnits, closedUnits, hasReversal } = foldObjectTotals(
        positionEvents,
        object.objectId,
      );

      // A reversed position has no baseline left to conserve: a reversal voids the arithmetic rather
      // than subtracting from it, which is why the projection reports "reversed" before reading any
      // figure. Measuring against a baseline the book has already voided would refuse the very facts
      // that follow a reversal — an acknowledgement replacing a receipt that never happened.
      if (hasReversal) continue;

      // No origination on record means no baseline to exceed — not a baseline of zero. A cash-basis
      // expense settles a position nothing ever opened, and an orphan's origination is unknown
      // rather than absent. Refusing either would reject a true fact to satisfy a rule.
      if (originatedUnits === 0n) continue;

      if (closedUnits + money.toUnits() > originatedUnits) {
        const outstanding = Money.fromUnits(originatedUnits - closedUnits, money.currency);
        throw new Error(
          `Over-settlement: the outstanding balance of ${object.objectId} is ${outstanding.toString()}`,
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
