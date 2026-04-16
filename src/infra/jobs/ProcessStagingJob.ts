import { CreateLedgerEventUseCase } from "../../core/application/use-cases/CreateLedgerEventUseCase";
import { RejectLedgerEventUseCase } from "../../core/application/use-cases/RejectLedgerEventUseCase";
import { StagingRecordValidator } from "../../core/application/services/StagingRecordValidator";
import { StagingRepository } from "../../core/application/repositories/StagingRepository";
import { StagingRecord } from "../../core/application/dtos/StagingRecord";
import { CreateLedgerEventCommand } from "../../core/application/dtos/CreateLedgerEventInput";
import { ConfidenceLevel } from "../../core/domain/enums/ConfidenceLevel";
import { Direction } from "../../core/domain/enums/Direction";
import { EconomicEffect } from "../../core/domain/enums/EconomicEffect";
import { EventType } from "../../core/domain/enums/EventType";
import { ObjectType } from "../../core/domain/enums/ObjectType";
import { PartyRole } from "../../core/domain/enums/PartyRole";
import { ReasonType } from "../../core/domain/enums/ReasonType";
import { Relation } from "../../core/domain/enums/Relation";
import { ReporterType } from "../../core/domain/enums/ReporterType";

export class ProcessStagingJob {
  constructor(
    private readonly stagingRepo: StagingRepository,
    private readonly validator: StagingRecordValidator,
    private readonly createUseCase: CreateLedgerEventUseCase,
    private readonly rejectUseCase: RejectLedgerEventUseCase,
  ) {}

  async run(): Promise<void> {
    const records = await this.stagingRepo.fetchPendingRecords();

    for (const record of records) {
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
        const command = ProcessStagingJob.toCreateCommand(record);
        await this.createUseCase.execute(command);
        await this.stagingRepo.markAsAccepted(record.id);
      }
    }
  }

  private static toCreateCommand(record: StagingRecord): CreateLedgerEventCommand {
    return {
      eventType: record.eventType as EventType,
      economicEffect: record.economicEffect as EconomicEffect,
      occurredAt: new Date(record.occurredAt!),
      sourceAt: record.sourceAt ? new Date(record.sourceAt) : null,
      amount: record.amount!,
      currency: record.currency!,
      description: record.description ?? null,
      sourceSystem: record.sourceSystem!,
      sourceReference: record.sourceReference!,
      normalizationVersion: record.normalizationVersion!,
      normalizationWorkerId: record.normalizationWorkerId!,
      previousHash: record.previousHash ?? null,
      parties: (record.parties ?? []).map((p) => ({
        partyId: p.partyId!,
        role: p.role as PartyRole,
        direction: p.direction as Direction,
        amount: p.amount,
      })),
      objects: (record.objects ?? []).map((o) => ({
        objectId: o.objectId!,
        objectType: o.objectType as ObjectType,
        relation: o.relation as Relation,
      })),
      reason: record.reason
        ? {
            type: record.reason.type as ReasonType,
            description: record.reason.description!,
            confidence: record.reason.confidence as ConfidenceLevel,
            requiresFollowup: record.reason.requiresFollowup ?? false,
          }
        : undefined,
      reporter: {
        reporterType: record.reporter!.reporterType as ReporterType,
        reporterId: record.reporter!.reporterId!,
        reporterName: record.reporter!.reporterName ?? null,
        channel: record.reporter!.channel!,
      },
    };
  }
}
