import { randomUUID } from "crypto";
import { StagingRecord } from "../dtos/StagingRecord";
import { SubmitCandidateInput } from "../dtos/SubmitCandidateInput";
import { CreateLedgerEventCommand } from "../dtos/CreateLedgerEventInput";
import { StagingRecordValidator } from "../services/StagingRecordValidator";
import { CreateLedgerEventUseCase } from "./CreateLedgerEventUseCase";
import { LedgerEventRepository } from "../repositories/LedgerEventRepository";
import { EventType } from "../../domain/enums/EventType";
import { EconomicEffect } from "../../domain/enums/EconomicEffect";
import { PartyRole } from "../../domain/enums/PartyRole";
import { Direction } from "../../domain/enums/Direction";
import { ObjectType } from "../../domain/enums/ObjectType";
import { Relation } from "../../domain/enums/Relation";
import { ReasonType } from "../../domain/enums/ReasonType";
import { ConfidenceLevel } from "../../domain/enums/ConfidenceLevel";
import { ReporterType } from "../../domain/enums/ReporterType";
import { classifyStagingFailure, classifyError, type RejectionDetail } from "../services/RejectionCatalog";

export type SubmitOutcome =
  | { status: "accepted"; ledgerReference: string }
  // `reason` (the joined legible string) is retained for back-compat; `rejections` is the
  // domain-oriented contract a client branches on. See services/RejectionCatalog.
  | { status: "rejected"; reason: string; rejections: RejectionDetail[] };

// The User App is not a normalizer; the Ledger stamps its own ingestion metadata on submit.
const SOURCE_SYSTEM = "integration";
const NORMALIZATION_VERSION = "1.0";
const NORMALIZATION_WORKER = "user-app-submit";

/**
 * Synchronous submit path for the User App. Validates the candidate with the same
 * StagingRecordValidator the async pipeline uses, then creates the event via the same
 * CreateLedgerEventUseCase (which enforces the invariants). Returns a business outcome —
 * `accepted` (with the event id) or `rejected` (with the reason). Idempotent on the commandId
 * (the intent's source reference): a retry returns the existing event, never a duplicate.
 */
export class SubmitCandidateUseCase {
  constructor(
    private readonly validator: StagingRecordValidator,
    private readonly createUseCase: CreateLedgerEventUseCase,
    private readonly ledgerRepo: LedgerEventRepository,
  ) {}

  async execute(input: SubmitCandidateInput, idempotencyKey: string): Promise<SubmitOutcome> {
    // Idempotency first: a retry of an already-posted intent returns the same acceptance
    // (the validator would otherwise reject it as a duplicate source reference).
    const existing = await this.ledgerRepo.getByCommandId(idempotencyKey);
    if (existing) return { status: "accepted", ledgerReference: existing.id.value };

    const failures = await this.validator.validate(this.toStagingRecord(input));
    if (failures.length > 0) {
      return {
        status: "rejected",
        reason: failures.map((f) => f.description).join("; "),
        rejections: failures.map(classifyStagingFailure),
      };
    }

    try {
      const event = await this.createUseCase.execute(this.toCommand(input, idempotencyKey));
      return { status: "accepted", ledgerReference: event.id.value };
    } catch (err) {
      // Invariant / conservation / lineage violations surface as a legible reason PLUS a
      // structured rejection the client can branch on (the throw sites are untouched).
      const message = err instanceof Error ? err.message : String(err);
      return { status: "rejected", reason: message, rejections: [classifyError(message)] };
    }
  }

  private toStagingRecord(input: SubmitCandidateInput): StagingRecord {
    return {
      id: randomUUID(),
      status: "pending",
      eventType: input.eventType,
      economicEffect: input.economicEffect,
      occurredAt: input.occurredAt,
      sourceAt: input.sourceAt ?? null,
      dueAt: input.dueAt ?? null,
      amount: input.amount,
      currency: input.currency,
      description: input.description ?? null,
      sourceSystem: SOURCE_SYSTEM,
      sourceReference: input.sourceReference,
      normalizationVersion: NORMALIZATION_VERSION,
      normalizationWorkerId: NORMALIZATION_WORKER,
      relatedEventId: input.relatedEventId ?? null,
      parties: input.parties,
      objects: input.objects,
      reason: input.reason ?? null,
      reporter: input.reporter,
    };
  }

  private toCommand(input: SubmitCandidateInput, idempotencyKey: string): CreateLedgerEventCommand {
    return {
      eventType: input.eventType as EventType,
      economicEffect: input.economicEffect as EconomicEffect,
      occurredAt: new Date(input.occurredAt),
      sourceAt: input.sourceAt ? new Date(input.sourceAt) : null,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      amount: input.amount,
      currency: input.currency,
      description: input.description ?? null,
      sourceSystem: SOURCE_SYSTEM,
      sourceReference: input.sourceReference,
      normalizationVersion: NORMALIZATION_VERSION,
      normalizationWorkerId: NORMALIZATION_WORKER,
      commandId: idempotencyKey,
      relatedEventId: input.relatedEventId ?? null,
      parties: input.parties.map((p) => ({
        partyId: p.partyId,
        role: p.role as PartyRole,
        direction: p.direction as Direction,
        amount: p.amount,
      })),
      objects: input.objects.map((o) => ({
        objectId: o.objectId,
        objectType: o.objectType as ObjectType,
        relation: o.relation as Relation,
      })),
      reason: input.reason
        ? {
            type: input.reason.type as ReasonType,
            description: input.reason.description,
            confidence: input.reason.confidence as ConfidenceLevel,
            requiresFollowup: input.reason.requiresFollowup,
          }
        : undefined,
      reporter: {
        reporterType: input.reporter.reporterType as ReporterType,
        reporterId: input.reporter.reporterId,
        reporterName: input.reporter.reporterName ?? null,
        channel: input.reporter.channel,
      },
    };
  }
}
