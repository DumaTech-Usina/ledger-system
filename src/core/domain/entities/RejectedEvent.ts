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

  /** Rebuilds a RejectedEvent from a persisted document without generating new id/date. */
  static reconstitute(props: {
    id: EventId;
    stagingId: StagingId;
    reasons: RejectionReason[];
    rejectedAt: Date;
    rawPayload?: unknown;
  }): RejectedEvent {
    return new RejectedEvent(
      props.id,
      props.stagingId,
      props.reasons,
      props.rejectedAt,
      props.rawPayload,
    );
  }

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
