import { RejectedEvent } from "../../../../core/domain/entities/RejectedEvent";

export function serializeRejectedEvent(event: RejectedEvent) {
  return {
    id: event.id.value,
    stagingId: event.stagingId.value,
    rejectedAt: event.rejectedAt,
    reasons: event.reasons.map((r) => ({
      type: r.type,
      description: r.description,
    })),
    rawPayload: event.rawPayload ?? null,
  };
}
