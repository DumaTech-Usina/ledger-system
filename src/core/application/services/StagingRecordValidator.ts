import { StagingRecord } from "../dtos/StagingRecord";
import { LedgerEventRepository } from "../repositories/LedgerEventRepository";
import { RejectionType } from "../../domain/value-objects/RejectionType";

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

const KNOWN_SOURCE_SYSTEMS = new Set(["normalizer", "manual-import", "integration"]);

export class StagingRecordValidator {
  constructor(private readonly ledgerRepo: LedgerEventRepository) {}

  async validate(record: StagingRecord): Promise<ValidationFailure[]> {
    const failures: ValidationFailure[] = [];

    this.validateRequiredFields(record, failures);
    this.validateAmount(record, failures);
    this.validateParties(record, failures);

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
    } else if (!KNOWN_SOURCE_SYSTEMS.has(record.sourceSystem)) {
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
      }
      if (!party.direction) {
        failures.push({
          type: RejectionType.MISSING_PARTY,
          description: `Party at index ${i} is missing direction`,
        });
      }
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
