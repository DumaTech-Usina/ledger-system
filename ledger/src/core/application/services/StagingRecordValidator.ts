import { StagingRecord } from "../dtos/StagingRecord";
import { LedgerEventRepository } from "../repositories/LedgerEventRepository";
import { RejectionType } from "../../domain/value-objects/RejectionType";
import { EventType } from "../../domain/enums/EventType";
import { EconomicEffect } from "../../domain/enums/EconomicEffect";
import { Direction } from "../../domain/enums/Direction";
import { PartyRole } from "../../domain/enums/PartyRole";
import { ObjectType } from "../../domain/enums/ObjectType";
import { Relation } from "../../domain/enums/Relation";
import { ReasonType } from "../../domain/enums/ReasonType";
import { ReporterType } from "../../domain/enums/ReporterType";
import { ConfidenceLevel } from "../../domain/enums/ConfidenceLevel";

type ValidationFailure = { type: RejectionType; description: string };

const REQUIRED_FIELDS: ReadonlyArray<keyof StagingRecord> = [
  "eventType",
  "economicEffect",
  "occurredAt",
  "amount",
  "currency",
  "sourceReference",
  "normalizationVersion",
  "normalizationWorkerId",
];

const DEFAULT_SOURCE_SYSTEMS = new Set(["normalizer", "manual-import", "integration"]);

const VALID_EVENT_TYPES = new Set(Object.values(EventType));
const VALID_ECONOMIC_EFFECTS = new Set(Object.values(EconomicEffect));
const VALID_DIRECTIONS = new Set(Object.values(Direction));
const VALID_PARTY_ROLES = new Set(Object.values(PartyRole));
const VALID_OBJECT_TYPES = new Set(Object.values(ObjectType));
const VALID_RELATIONS = new Set(Object.values(Relation));
const VALID_REASON_TYPES = new Set(Object.values(ReasonType));
const VALID_REPORTER_TYPES = new Set(Object.values(ReporterType));
const VALID_CONFIDENCE_LEVELS = new Set(Object.values(ConfidenceLevel));

export class StagingRecordValidator {
  constructor(
    private readonly ledgerRepo: LedgerEventRepository,
    private readonly knownSourceSystems: ReadonlySet<string> = DEFAULT_SOURCE_SYSTEMS,
  ) {}

  async validate(record: StagingRecord): Promise<ValidationFailure[]> {
    const failures: ValidationFailure[] = [];

    this.validateRequiredFields(record, failures);
    this.validateEnumFields(record, failures);
    this.validateAmount(record, failures);
    this.validateParties(record, failures);
    this.validateObjects(record, failures);
    this.validateReason(record, failures);

    if (record.sourceReference) {
      await this.checkDuplicate(record.sourceReference, failures);
    }

    return failures;
  }

  private validateRequiredFields(record: StagingRecord, failures: ValidationFailure[]): void {
    for (const field of REQUIRED_FIELDS) {
      if (!record[field]) {
        failures.push({
          type: RejectionType.INVALID_SCHEMA,
          description: `Missing required field: ${field}`,
        });
      }
    }

    if (!record.sourceSystem) {
      failures.push({
        type: RejectionType.INVALID_SCHEMA,
        description: "Missing required field: sourceSystem",
      });
    } else if (!this.knownSourceSystems.has(record.sourceSystem)) {
      failures.push({
        type: RejectionType.INVALID_SCHEMA,
        description: `Unknown source system: "${record.sourceSystem}"`,
      });
    }

    const reporter = record.reporter;
    if (!reporter?.reporterType || !reporter?.reporterId || !reporter?.channel) {
      failures.push({
        type: RejectionType.INVALID_SCHEMA,
        description: "Missing required reporter fields (reporterType, reporterId, channel)",
      });
    }
  }

  private validateEnumFields(record: StagingRecord, failures: ValidationFailure[]): void {
    if (record.eventType && !VALID_EVENT_TYPES.has(record.eventType as EventType)) {
      failures.push({
        type: RejectionType.INVALID_SCHEMA,
        description: `Invalid eventType: "${record.eventType}". Valid values: ${[...VALID_EVENT_TYPES].join(", ")}`,
      });
    }

    if (record.economicEffect && !VALID_ECONOMIC_EFFECTS.has(record.economicEffect as EconomicEffect)) {
      failures.push({
        type: RejectionType.INVALID_SCHEMA,
        description: `Invalid economicEffect: "${record.economicEffect}". Valid values: ${[...VALID_ECONOMIC_EFFECTS].join(", ")}`,
      });
    }

    if (record.reporter?.reporterType && !VALID_REPORTER_TYPES.has(record.reporter.reporterType as ReporterType)) {
      failures.push({
        type: RejectionType.INVALID_SCHEMA,
        description: `Invalid reporterType: "${record.reporter.reporterType}". Valid values: ${[...VALID_REPORTER_TYPES].join(", ")}`,
      });
    }
  }

  private validateAmount(record: StagingRecord, failures: ValidationFailure[]): void {
    if (!record.amount) return;

    if (!/^\d+(\.\d{1,2})?$/.test(record.amount)) {
      failures.push({
        type: RejectionType.INVALID_AMOUNT,
        description: `Invalid amount format: "${record.amount}" — must be a positive decimal with up to 2 places`,
      });
    }
  }

  private validateParties(record: StagingRecord, failures: ValidationFailure[]): void {
    if (!record.parties || record.parties.length === 0) {
      failures.push({
        type: RejectionType.MISSING_PARTY,
        description: "At least one party is required",
      });
      return;
    }

    for (const [i, party] of record.parties.entries()) {
      if (!party.partyId) {
        failures.push({
          type: RejectionType.MISSING_PARTY,
          description: `Party at index ${i} is missing partyId`,
        });
      }

      if (!party.role) {
        failures.push({
          type: RejectionType.MISSING_PARTY,
          description: `Party at index ${i} is missing role`,
        });
      } else if (!VALID_PARTY_ROLES.has(party.role as PartyRole)) {
        failures.push({
          type: RejectionType.INVALID_SCHEMA,
          description: `Party at index ${i} has invalid role: "${party.role}". Valid values: ${[...VALID_PARTY_ROLES].join(", ")}`,
        });
      }

      if (!party.direction) {
        failures.push({
          type: RejectionType.MISSING_PARTY,
          description: `Party at index ${i} is missing direction`,
        });
      } else if (!VALID_DIRECTIONS.has(party.direction as Direction)) {
        failures.push({
          type: RejectionType.INVALID_SCHEMA,
          description: `Party at index ${i} has invalid direction: "${party.direction}". Valid values: ${[...VALID_DIRECTIONS].join(", ")}`,
        });
      }
    }
  }

  private validateObjects(record: StagingRecord, failures: ValidationFailure[]): void {
    if (!record.objects || record.objects.length === 0) {
      failures.push({
        type: RejectionType.INVALID_SCHEMA,
        description: "At least one economic object is required",
      });
      return;
    }

    for (const [i, obj] of record.objects.entries()) {
      if (!obj.objectId) {
        failures.push({
          type: RejectionType.INVALID_SCHEMA,
          description: `Object at index ${i} is missing objectId`,
        });
      }

      if (!obj.objectType) {
        failures.push({
          type: RejectionType.INVALID_SCHEMA,
          description: `Object at index ${i} is missing objectType`,
        });
      } else if (!VALID_OBJECT_TYPES.has(obj.objectType as ObjectType)) {
        failures.push({
          type: RejectionType.INVALID_SCHEMA,
          description: `Object at index ${i} has invalid objectType: "${obj.objectType}". Valid values: ${[...VALID_OBJECT_TYPES].join(", ")}`,
        });
      }

      if (!obj.relation) {
        failures.push({
          type: RejectionType.INVALID_SCHEMA,
          description: `Object at index ${i} is missing relation`,
        });
      } else if (!VALID_RELATIONS.has(obj.relation as Relation)) {
        failures.push({
          type: RejectionType.INVALID_SCHEMA,
          description: `Object at index ${i} has invalid relation: "${obj.relation}". Valid values: ${[...VALID_RELATIONS].join(", ")}`,
        });
      }
    }
  }

  private validateReason(record: StagingRecord, failures: ValidationFailure[]): void {
    if (!record.reason) return;

    if (!record.reason.type) {
      failures.push({
        type: RejectionType.INVALID_SCHEMA,
        description: "Reason is missing type",
      });
    } else if (!VALID_REASON_TYPES.has(record.reason.type as ReasonType)) {
      failures.push({
        type: RejectionType.INVALID_SCHEMA,
        description: `Invalid reason type: "${record.reason.type}". Valid values: ${[...VALID_REASON_TYPES].join(", ")}`,
      });
    }

    if (!record.reason.description || !record.reason.description.trim()) {
      failures.push({
        type: RejectionType.INVALID_SCHEMA,
        description: "Reason is missing description",
      });
    }

    if (!record.reason.confidence) {
      failures.push({
        type: RejectionType.INVALID_SCHEMA,
        description: "Reason is missing confidence level",
      });
    } else if (!VALID_CONFIDENCE_LEVELS.has(record.reason.confidence as ConfidenceLevel)) {
      failures.push({
        type: RejectionType.INVALID_SCHEMA,
        description: `Invalid confidence level: "${record.reason.confidence}". Valid values: ${[...VALID_CONFIDENCE_LEVELS].join(", ")}`,
      });
    }
  }

  private async checkDuplicate(sourceReference: string, failures: ValidationFailure[]): Promise<void> {
    const exists = await this.ledgerRepo.existsBySourceReference(sourceReference);
    if (exists) {
      failures.push({
        type: RejectionType.DUPLICATE_EVENT,
        description: `Duplicate source reference: "${sourceReference}"`,
      });
    }
  }
}
