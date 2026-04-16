import { RejectedEvent } from "../../domain/entities/RejectedEvent";
import { RejectionReason } from "../../domain/value-objects/RejectionReason";
import { StagingId } from "../../domain/value-objects/StagingId";
import { RejectLedgerEventCommand } from "../dtos/RejectLedgerEventCommand";
import { RejectedEventRepository } from "../repositories/RejectedEventRepository";
import { IAuditLogger } from "../services/IAuditLogger";

export class RejectLedgerEventUseCase {
  constructor(
    private readonly repository: RejectedEventRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async execute(command: RejectLedgerEventCommand): Promise<RejectedEvent> {
    const reasons = command.reasons.map(
      (r) => new RejectionReason(r.type, r.description),
    );

    const event = RejectedEvent.create({
      stagingId: new StagingId(command.stagingId),
      reasons,
      rawPayload: command.rawPayload,
    });

    await this.repository.save(event);

    await this.audit.log({
      action: "STAGING_RECORD_REJECTED",
      timestamp: event.rejectedAt.toISOString(),
      sourceSystem: command.sourceSystem ?? "unknown",
      stagingId: command.stagingId,
      reasons: command.reasons.map((r) => r.description),
    });

    return event;
  }
}
