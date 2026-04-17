import { EconomicEffect } from "../enums/EconomicEffect";
import { EventType } from "../enums/EventType";
import { Direction } from "../enums/Direction";
import { PartyRole } from "../enums/PartyRole";
import { EventHash } from "../value-objects/EventHash";
import { EventId } from "../value-objects/EventId";
import { Money } from "../value-objects/Money";
import { NormalizationMetadata } from "../value-objects/NormalizationMetadata";
import { EventSource } from "../value-objects/EventSource";
import { EventReporter } from "./EventReporter";
import { EventReason } from "./EventReason";
import { LedgerEventParty } from "./LedgerEventParty";
import { LedgerEventObject } from "./LedgerEconomicObject";

import { InvariantPolicy } from "../policies/InvariantPolicy";

export interface CreateLedgerEventProps {
  id: EventId;
  eventType: EventType;
  economicEffect: EconomicEffect;
  occurredAt: Date;
  sourceAt?: Date | null;
  amount: Money;
  description?: string | null;
  source: EventSource;
  normalization: NormalizationMetadata;
  previousHash?: EventHash | null;
  commandId?: string | null;
  /** ID of the originating event this one relates to (e.g. ADVANCE_SETTLEMENT → ADVANCE_PAYMENT). */
  relatedEventId?: string | null;

  parties: LedgerEventParty[];
  objects: LedgerEventObject[];
  reason?: EventReason | null;
  reporter: EventReporter;
}

export class LedgerEvent {
  private constructor(
    public readonly id: EventId,
    public readonly eventType: EventType,
    public readonly economicEffect: EconomicEffect,
    public readonly occurredAt: Date,
    public readonly recordedAt: Date,
    public readonly sourceAt: Date | null,
    public readonly amount: Money,
    public readonly description: string | null,
    public readonly source: EventSource,
    public readonly normalization: NormalizationMetadata,
    public readonly hash: EventHash,
    public readonly previousHash: EventHash | null,
    public readonly commandId: string | null,
    public readonly relatedEventId: string | null,

    private readonly parties: LedgerEventParty[],
    private readonly objects: LedgerEventObject[],
    private readonly reason: EventReason | null,
    private readonly reporter: EventReporter,
  ) {}

  // ===============================
  // FACTORY
  // ===============================

  /** Rebuilds a LedgerEvent from a persisted record without re-running validation or re-hashing. */
  static reconstitute(props: {
    id: EventId;
    eventType: EventType;
    economicEffect: EconomicEffect;
    occurredAt: Date;
    recordedAt: Date;
    sourceAt: Date | null;
    amount: Money;
    description: string | null;
    source: EventSource;
    normalization: NormalizationMetadata;
    hash: EventHash;
    previousHash: EventHash | null;
    commandId: string | null;
    relatedEventId: string | null;
    parties: LedgerEventParty[];
    objects: LedgerEventObject[];
    reason: EventReason | null;
    reporter: EventReporter;
  }): LedgerEvent {
    return new LedgerEvent(
      props.id,
      props.eventType,
      props.economicEffect,
      props.occurredAt,
      props.recordedAt,
      props.sourceAt,
      props.amount,
      props.description,
      props.source,
      props.normalization,
      props.hash,
      props.previousHash,
      props.commandId,
      props.relatedEventId,
      props.parties,
      props.objects,
      props.reason,
      props.reporter,
    );
  }

  static create(props: CreateLedgerEventProps): LedgerEvent {
    LedgerEvent.validate(props);

    const recordedAt = new Date();

    const hash = EventHash.generateCanonical({
      id: props.id.value,
      eventType: props.eventType,
      economicEffect: props.economicEffect,
      occurredAt: props.occurredAt.toISOString(),
      recordedAt: recordedAt.toISOString(),
      sourceAt: props.sourceAt?.toISOString() ?? null,
      amount: props.amount.toString(),
      description: props.description ?? null,
      source: {
        system: props.source.system,
        reference: props.source.reference,
      },
      normalization: {
        version: props.normalization.version,
        workerId: props.normalization.workerId,
      },
      previousHash: props.previousHash?.value ?? null,
      relatedEventId: props.relatedEventId ?? null,
      parties: props.parties.map((p) => ({
        partyId: p.partyId.value,
        role: p.role,
        direction: p.direction,
        amount: p.amount?.toString() ?? null,
      })),
      objects: props.objects.map((o) => ({
        objectId: o.objectId.value,
        objectType: o.objectType,
        relation: o.relation,
      })),
      reason: props.reason
        ? {
            type: props.reason.type,
            description: props.reason.description,
            confidence: props.reason.confidence,
            requiresFollowup: props.reason.requiresFollowup,
          }
        : null,
      reporter: {
        type: props.reporter.reporterType,
        id: props.reporter.reporterId,
        channel: props.reporter.channel,
      },
    });

    return new LedgerEvent(
      props.id,
      props.eventType,
      props.economicEffect,
      props.occurredAt,
      recordedAt,
      props.sourceAt ?? null,
      props.amount,
      props.description ?? null,
      props.source,
      props.normalization,
      hash,
      props.previousHash ?? null,
      props.commandId ?? null,
      props.relatedEventId ?? null,
      [...props.parties],
      [...props.objects],
      props.reason ?? null,
      props.reporter,
    );
  }

  // ===============================
  // VALIDATION CORE
  // ===============================
  private static validate(props: CreateLedgerEventProps) {
    LedgerEvent.validateBasic(props);
    LedgerEvent.validateFlow(props);
    LedgerEvent.validateReasonRules(props);

    InvariantPolicy.validateSemantic(props);
  }

  private static validateBasic(props: CreateLedgerEventProps) {
    if (props.amount.isZero()) {
      throw new Error("Event amount cannot be zero");
    }

    if (props.parties.length === 0) {
      throw new Error("Event must contain at least one party");
    }

    if (props.objects.length === 0) {
      throw new Error("Event must reference at least one economic object");
    }

    for (const p of props.parties) {
      if (p.role === PartyRole.PAYER && p.direction === Direction.IN) {
        throw new Error(`Party ${p.partyId.value}: PAYER cannot have direction IN`);
      }
      if (p.role === PartyRole.PAYEE && p.direction === Direction.OUT) {
        throw new Error(`Party ${p.partyId.value}: PAYEE cannot have direction OUT`);
      }
    }
  }

  // ===============================
  // FLOW VALIDATION
  // ===============================
  private static validateFlow(props: CreateLedgerEventProps) {
    const currency = props.amount.currency;

    let totalIn = Money.zero(currency);
    let totalOut = Money.zero(currency);

    for (const p of props.parties) {
      if (!p.amount) continue;

      if (p.amount.currency !== currency) {
        throw new Error("Party amount currency mismatch");
      }

      switch (p.direction) {
        case Direction.IN:
          totalIn = totalIn.add(p.amount);
          break;

        case Direction.OUT:
          totalOut = totalOut.add(p.amount);
          break;

        case Direction.NEUTRAL:
          // Neutral não participa de fluxo financeiro
          break;
      }
    }

    switch (props.economicEffect) {
      case EconomicEffect.CASH_INTERNAL: {
        if (!totalIn.equals(totalOut)) {
          throw new Error("Internal transfer must balance");
        }

        if (!totalIn.equals(props.amount)) {
          throw new Error("Internal transfer total must match event amount");
        }

        break;
      }

      case EconomicEffect.CASH_IN: {
        if (totalIn.isZero()) {
          throw new Error("Cash in must have inbound flow");
        }

        if (!totalIn.equals(props.amount)) {
          throw new Error("Cash in total must match event amount");
        }

        if (!totalOut.isZero()) {
          throw new Error("Cash in cannot have outbound flow");
        }

        break;
      }

      case EconomicEffect.CASH_OUT: {
        if (totalOut.isZero()) {
          throw new Error("Cash out must have outbound flow");
        }

        if (!totalOut.equals(props.amount)) {
          throw new Error("Cash out total must match event amount");
        }

        if (!totalIn.isZero()) {
          throw new Error("Cash out cannot have inbound flow");
        }

        break;
      }

      case EconomicEffect.NON_CASH: {
        if (!totalIn.isZero() || !totalOut.isZero()) {
          throw new Error("Non-cash event cannot alter cash flow");
        }

        break;
      }

      case EconomicEffect.CONTINGENT: {
        if (!totalIn.isZero() || !totalOut.isZero()) {
          throw new Error("Contingent event cannot generate cash flow");
        }

        break;
      }
    }
  }

  // ===============================
  // REASON RULES
  // ===============================
  private static validateReasonRules(props: CreateLedgerEventProps) {
    if (props.economicEffect === EconomicEffect.NON_CASH && !props.reason) {
      throw new Error("Non-cash events require a reason");
    }

    if (
      props.economicEffect === EconomicEffect.CONTINGENT &&
      !props.reason?.requiresFollowup
    ) {
      throw new Error("Contingent events must require follow-up");
    }
  }

  // ===============================
  // GETTERS DEFENSIVOS
  // ===============================
  public getParties(): LedgerEventParty[] {
    return [...this.parties];
  }

  public getObjects(): LedgerEventObject[] {
    return [...this.objects];
  }

  public getReason(): EventReason | null {
    return this.reason;
  }

  public getReporter(): EventReporter {
    return this.reporter;
  }
}
