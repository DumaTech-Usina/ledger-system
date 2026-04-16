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
// Application-layer command fixture
// ============================

export function makeValidCommand(
  overrides: Partial<CreateLedgerEventCommand> = {},
): CreateLedgerEventCommand {
  return {
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
    previousHash: null,
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
}

// ============================
// Staging record fixture
// ============================

export function makeValidStagingRecord(
  overrides: Partial<StagingRecord> = {},
): StagingRecord {
  return {
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
    previousHash: null,
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
}
