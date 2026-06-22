import { EventReason } from "../../core/domain/entities/EventReason";
import { EventReporter } from "../../core/domain/entities/EventReporter";
import { LedgerEventObject } from "../../core/domain/entities/LedgerEconomicObject";
import {
  CreateLedgerEventProps,
} from "../../core/domain/entities/LedgerEvent";
import { LedgerEventParty } from "../../core/domain/entities/LedgerEventParty";
import { ConfidenceLevel } from "../../core/domain/enums/ConfidenceLevel";
import { Direction } from "../../core/domain/enums/Direction";
import { EconomicEffect } from "../../core/domain/enums/EconomicEffect";
import { EventType } from "../../core/domain/enums/EventType";
import { ObjectType } from "../../core/domain/enums/ObjectType";
import { PartyRole } from "../../core/domain/enums/PartyRole";
import { ReasonType } from "../../core/domain/enums/ReasonType";
import { Relation } from "../../core/domain/enums/Relation";
import { ReporterType } from "../../core/domain/enums/ReporterType";
import { EventId } from "../../core/domain/value-objects/EventId";
import { EventSource } from "../../core/domain/value-objects/EventSource";
import { Money } from "../../core/domain/value-objects/Money";
import { NormalizationMetadata } from "../../core/domain/value-objects/NormalizationMetadata";
import { ObjectId } from "../../core/domain/value-objects/ObjectId";
import { PartyId } from "../../core/domain/value-objects/PartyId";
import { CreateLedgerEventCommand } from "../../core/application/dtos/CreateLedgerEventInput";
import { StagingRecord } from "../../core/application/dtos/StagingRecord";

// ============================
// Domain-layer props fixture
// ============================

export function makeValidProps(
  overrides: Partial<CreateLedgerEventProps> = {},
): CreateLedgerEventProps {
  return {
    id: new EventId("evt-001"),
    eventType: EventType.COMMISSION_RECEIVED,
    economicEffect: EconomicEffect.CASH_IN,
    occurredAt: new Date("2024-01-15T00:00:00Z"),
    sourceAt: null,
    amount: Money.fromDecimal("1000.00", "BRL"),
    description: null,
    source: new EventSource("normalizer", "ref-001"),
    normalization: new NormalizationMetadata("1.0", "worker-1"),
    previousHash: null,
    // COMMISSION_RECEIVED must link to its originating COMMISSION_EXPECTED (ignition point).
    relatedEventId: "evt-commission-expected-001",
    parties: [
      new LedgerEventParty(
        new PartyId("party-1"),
        PartyRole.PAYEE,
        Direction.IN,
        Money.fromDecimal("1000.00", "BRL"),
      ),
    ],
    objects: [
      new LedgerEventObject(
        new ObjectId("obj-1"),
        ObjectType.COMMISSION_RECEIVABLE,
        Relation.SETTLES,
      ),
    ],
    reason: new EventReason(
      ReasonType.COMMISSION_PAYMENT,
      "Commission payment Q1",
      ConfidenceLevel.MEDIUM,
      false,
    ),
    reporter: new EventReporter(
      ReporterType.SYSTEM,
      "reporter-1",
      null,
      new Date("2024-01-15T00:00:00Z"),
      "api",
    ),
    ...overrides,
  };
}

// ============================
// Commission ignition point (COMMISSION_EXPECTED)
// ============================

/** Domain props for a COMMISSION_EXPECTED — the ignition point a COMMISSION_RECEIVED must
 *  link back to. NON_CASH, ORIGINATES the receivable, no parent of its own. */
export function makeExpectedProps(
  overrides: Partial<CreateLedgerEventProps> = {},
): CreateLedgerEventProps {
  return makeValidProps({
    id: new EventId("evt-commission-expected-001"),
    eventType: EventType.COMMISSION_EXPECTED,
    economicEffect: EconomicEffect.NON_CASH,
    relatedEventId: null,
    parties: [
      new LedgerEventParty(new PartyId("party-1"), PartyRole.BENEFICIARY, Direction.NEUTRAL, null),
    ],
    objects: [
      new LedgerEventObject(new ObjectId("obj-1"), ObjectType.COMMISSION_RECEIVABLE, Relation.ORIGINATES),
    ],
    reason: new EventReason(
      ReasonType.LATE_IDENTIFIED_COMMISSION,
      "ignition point",
      ConfidenceLevel.MEDIUM,
      false,
    ),
    ...overrides,
  });
}

/** Command form of the ignition point. Execute this before a COMMISSION_RECEIVED command and
 *  pass the resulting event id as the received's relatedEventId. */
export function makeExpectedCommand(
  overrides: Partial<CreateLedgerEventCommand> = {},
): CreateLedgerEventCommand {
  return makeValidCommand({
    eventType: EventType.COMMISSION_EXPECTED,
    economicEffect: EconomicEffect.NON_CASH,
    relatedEventId: null,
    parties: [
      { partyId: "party-1", role: PartyRole.BENEFICIARY, direction: Direction.NEUTRAL },
    ],
    objects: [
      { objectId: "obj-1", objectType: ObjectType.COMMISSION_RECEIVABLE, relation: Relation.ORIGINATES },
    ],
    reason: {
      type: ReasonType.LATE_IDENTIFIED_COMMISSION,
      description: "ignition point",
      confidence: ConfidenceLevel.MEDIUM,
      requiresFollowup: false,
    },
    ...overrides,
  });
}

// ============================
// Application-layer command fixture
// ============================

export function makeValidCommand(
  overrides: Partial<CreateLedgerEventCommand> = {},
): CreateLedgerEventCommand {
  const command: CreateLedgerEventCommand = {
    eventType: EventType.COMMISSION_RECEIVED,
    economicEffect: EconomicEffect.CASH_IN,
    occurredAt: new Date("2024-01-15T00:00:00Z"),
    sourceAt: null,
    amount: "1000.00",
    currency: "BRL",
    description: null,
    sourceSystem: "normalizer",
    sourceReference: "ref-001",
    normalizationVersion: "1.0",
    normalizationWorkerId: "worker-1",
    parties: [
      {
        partyId: "party-1",
        role: PartyRole.PAYEE,
        direction: Direction.IN,
        amount: "1000.00",
      },
    ],
    objects: [
      {
        objectId: "obj-1",
        objectType: ObjectType.COMMISSION_RECEIVABLE,
        relation: Relation.SETTLES,
      },
    ],
    reason: {
      type: ReasonType.COMMISSION_PAYMENT,
      description: "Commission payment Q1",
      confidence: ConfidenceLevel.MEDIUM,
      requiresFollowup: false,
    },
    reporter: {
      reporterType: ReporterType.SYSTEM,
      reporterId: "reporter-1",
      reporterName: null,
      channel: "api",
    },
    ...overrides,
  };

  // COMMISSION_RECEIVED must carry an ignition link. Default one only for that type so
  // non-commission overrides (advance/loan originations) stay parent-free. Tests against a
  // real repository must seed a COMMISSION_EXPECTED and override relatedEventId with its id.
  if (
    command.eventType === EventType.COMMISSION_RECEIVED &&
    overrides.relatedEventId === undefined
  ) {
    command.relatedEventId = "evt-commission-expected-001";
  }

  return command;
}

// ============================
// Staging record fixture
// ============================

export function makeValidStagingRecord(
  overrides: Partial<StagingRecord> = {},
): StagingRecord {
  const record: StagingRecord = {
    id: "stg-001",
    status: "pending",
    eventType: "commission_received",
    economicEffect: "cash_in",
    occurredAt: "2024-01-15T00:00:00Z",
    sourceAt: null,
    amount: "1000.00",
    currency: "BRL",
    description: null,
    sourceSystem: "normalizer",
    sourceReference: "ref-001",
    normalizationVersion: "1.0",
    normalizationWorkerId: "worker-1",
    parties: [
      { partyId: "party-1", role: "payee", direction: "in", amount: "1000.00" },
    ],
    objects: [
      {
        objectId: "obj-1",
        objectType: "commission_receivable",
        relation: "settles",
      },
    ],
    reason: {
      type: "commission_payment",
      description: "Commission payment Q1",
      confidence: "medium",
      requiresFollowup: false,
    },
    reporter: {
      reporterType: "system",
      reporterId: "reporter-1",
      reporterName: null,
      channel: "api",
    },
    ...overrides,
  };

  // Mirror makeValidCommand: a commission_received staging record must carry an ignition link.
  if (
    record.eventType === "commission_received" &&
    overrides.relatedEventId === undefined
  ) {
    record.relatedEventId = "evt-commission-expected-001";
  }

  return record;
}
