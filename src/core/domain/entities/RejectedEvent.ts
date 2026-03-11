import { EventId } from "../value-objects/EventId";
import { RejectionReason } from "../value-objects/RejectionReason";
import { StagingId } from "../value-objects/StagingId";

export class RejectedEvent {
  private constructor(
    readonly id: EventId,
    readonly stagingId: StagingId,
    readonly reasons: RejectionReason[],
    readonly rejectedAt: Date,
    readonly rawPayload?: unknown, // snapshot do dado original para auditoria
  ) {}

  static create(props: {
    stagingId: StagingId;
    reasons: RejectionReason[];
    rawPayload?: unknown;
  }): RejectedEvent {
    if (!props.reasons.length) {
      throw new Error("At least one rejection reason is required");
    }

    return new RejectedEvent(
      new EventId(crypto.randomUUID()),
      props.stagingId,
      props.reasons,
      new Date(),
      props.rawPayload,
    );
  }
}
