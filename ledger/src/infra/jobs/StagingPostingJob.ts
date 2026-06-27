import { CreateLedgerEventUseCase } from "../../core/application/use-cases/CreateLedgerEventUseCase";
import { RejectLedgerEventUseCase } from "../../core/application/use-cases/RejectLedgerEventUseCase";
import { StagingRecordValidator } from "../../core/application/services/StagingRecordValidator";
import { ReceiptLineageResolver } from "../../core/application/services/ReceiptLineageResolver";
import { StagingRepository } from "../../core/application/repositories/StagingRepository";
import { StagingRecord, ValidatedStagingRecord } from "../../core/application/dtos/StagingRecord";
import { StagingMessageHandler } from "../../core/application/ports/StagingMessageHandler";
import { CreateLedgerEventCommand } from "../../core/application/dtos/CreateLedgerEventInput";
import { RejectionType } from "../../core/domain/value-objects/RejectionType";
import { ConfidenceLevel } from "../../core/domain/enums/ConfidenceLevel";
import { Direction } from "../../core/domain/enums/Direction";
import { EconomicEffect } from "../../core/domain/enums/EconomicEffect";
import { EventType } from "../../core/domain/enums/EventType";
import { ObjectType } from "../../core/domain/enums/ObjectType";
import { PartyRole } from "../../core/domain/enums/PartyRole";
import { ReasonType } from "../../core/domain/enums/ReasonType";
import { Relation } from "../../core/domain/enums/Relation";
import { ReporterType } from "../../core/domain/enums/ReporterType";

export class StagingPostingJob implements StagingMessageHandler {
  constructor(
    private readonly stagingRepo: StagingRepository,
    private readonly validator: StagingRecordValidator,
    private readonly createUseCase: CreateLedgerEventUseCase,
    private readonly rejectUseCase: RejectLedgerEventUseCase,
    /** Resolves commission_received → commission_expected lineage at the posting boundary.
     *  Optional: when absent the job posts records as-is (Step-1 behavior — orphans rejected). */
    private readonly resolver?: ReceiptLineageResolver,
  ) {}

  async handle(record: StagingRecord): Promise<void> {
    try {
      const failures = await this.validator.validate(record);

      if (failures.length > 0) {
        await this.rejectUseCase.execute({
          stagingId: record.id,
          reasons: failures,
          rawPayload: record,
          sourceSystem: record.sourceSystem,
        });
        await this.stagingRepo.markAsRejected(record.id);
      } else {
        const validated = record as ValidatedStagingRecord;
        const command = StagingPostingJob.toCreateCommand(validated);
        const relatedEventId = this.resolver
          ? await this.resolver.resolve(validated)
          : (command.relatedEventId ?? null);
        const finalCommand = StagingPostingJob.markOrphanIfUnlinked(command, relatedEventId);
        await this.createUseCase.execute({ ...finalCommand, relatedEventId });
        await this.stagingRepo.markAsAccepted(record.id);
      }
    } catch (err) {
      await this.rejectUseCase.execute({
        stagingId: record.id,
        reasons: [
          {
            type: RejectionType.POLICY_VIOLATION,
            description: err instanceof Error ? err.message : String(err),
          },
        ],
        rawPayload: record,
        sourceSystem: record.sourceSystem,
      });
      await this.stagingRepo.markAsRejected(record.id);
    }
  }

  async run(): Promise<void> {
    const records = await this.stagingRepo.claimPending('processing');
    for (const record of records) {
      await this.handle(record);
    }
  }

  /**
   * When a commission_received has no resolvable originating expected, record it as a
   * first-class orphan: lineage currently unknown, to be linked later by a new fact. We never
   * fabricate an origin. The unresolved state is declared with reason UNKNOWN_ORIGIN and
   * requiresFollowup (the only way InvariantPolicy admits a received with a null link).
   * Confidence is preserved (the payment fact itself is not in doubt — only its lineage).
   */
  private static markOrphanIfUnlinked(
    command: CreateLedgerEventCommand,
    relatedEventId: string | null,
  ): CreateLedgerEventCommand {
    if (command.eventType !== EventType.COMMISSION_RECEIVED || relatedEventId !== null) {
      return command;
    }
    return {
      ...command,
      reason: {
        type: ReasonType.UNKNOWN_ORIGIN,
        description: "Commission received with unresolved origin",
        confidence: command.reason?.confidence ?? ConfidenceLevel.MEDIUM,
        requiresFollowup: true,
      },
    };
  }

  private static toCreateCommand(record: ValidatedStagingRecord): CreateLedgerEventCommand {
    return {
      eventType: record.eventType as EventType,
      economicEffect: record.economicEffect as EconomicEffect,
      occurredAt: new Date(record.occurredAt),
      sourceAt: record.sourceAt ? new Date(record.sourceAt) : null,
      amount: record.amount,
      currency: record.currency,
      description: record.description ?? null,
      sourceSystem: record.sourceSystem,
      sourceReference: record.sourceReference,
      normalizationVersion: record.normalizationVersion,
      normalizationWorkerId: record.normalizationWorkerId,
      relatedEventId: record.relatedEventId ?? null,
      parties: record.parties.map((p) => ({
        partyId: p.partyId,
        role: p.role as PartyRole,
        direction: p.direction as Direction,
        amount: p.amount,
      })),
      objects: record.objects.map((o) => ({
        objectId: o.objectId,
        objectType: o.objectType as ObjectType,
        relation: o.relation as Relation,
      })),
      reason: record.reason
        ? {
            type: record.reason.type as ReasonType,
            description: record.reason.description,
            confidence: record.reason.confidence as ConfidenceLevel,
            requiresFollowup: record.reason.requiresFollowup ?? false,
          }
        : undefined,
      reporter: {
        reporterType: record.reporter.reporterType as ReporterType,
        reporterId: record.reporter.reporterId,
        reporterName: record.reporter.reporterName ?? null,
        channel: record.reporter.channel,
      },
    };
  }
}
