import { LedgerEvent } from "../../../../core/domain/entities/LedgerEvent";

export function serializeEvent(event: LedgerEvent) {
  const reason = event.getReason();
  const reporter = event.getReporter();

  return {
    id: event.id.value,
    eventType: event.eventType,
    economicEffect: event.economicEffect,
    occurredAt: event.occurredAt,
    recordedAt: event.recordedAt,
    amount: event.amount.toString(),
    currency: event.amount.currency,
    description: event.description,
    source: {
      system: event.source.system,
      reference: event.source.reference,
    },
    normalization: {
      version: event.normalization.version,
      workerId: event.normalization.workerId,
    },
    parties: event.getParties().map((p) => ({
      partyId: p.partyId.value,
      role: p.role,
      direction: p.direction,
      amount: p.amount?.toString() ?? null,
    })),
    objects: event.getObjects().map((o) => ({
      objectId: o.objectId.value,
      objectType: o.objectType,
      relation: o.relation,
    })),
    reason: reason
      ? {
          type: reason.type,
          description: reason.description,
          confidence: reason.confidence,
          requiresFollowup: reason.requiresFollowup,
        }
      : null,
    reporter: {
      reporterType: reporter.reporterType,
      reporterId: reporter.reporterId,
      reporterName: reporter.reporterName,
      reportedAt: reporter.reportedAt,
      channel: reporter.channel,
    },
    hash: event.hash.value,
    previousHash: event.previousHash?.value ?? null,
  };
}
