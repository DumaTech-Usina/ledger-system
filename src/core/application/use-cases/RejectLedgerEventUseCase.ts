import { RejectedEvent } from "../../domain/entities/RejectedEvent";
import { RejectionReason } from "../../domain/value-objects/RejectionReason";
import { StagingId } from "../../domain/value-objects/StagingId";
import { RejectLedgerEventCommand } from "../dtos/RejectLedgerEventCommand";
import { RejectedEventRepository } from "../repositories/RejectedEventRepository";

export class RejectLedgerEventUseCase {
  constructor(private readonly repository: RejectedEventRepository) {}

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

    return event;
  }
}
