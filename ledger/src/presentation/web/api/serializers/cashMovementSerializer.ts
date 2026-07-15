import { CashMovementPage } from "../../../../core/application/dtos/CashStatement";

export function serializeCashMovementPage(page: CashMovementPage) {
  return {
    items: page.items.map((m) => ({
      eventId:         m.eventId,
      occurredAt:      m.occurredAt.toISOString(),
      recordedAt:      m.recordedAt.toISOString(),
      effect:          m.effect,
      amount:          m.amount.toString(),
      sourceReference: m.sourceReference,
      counterparty:    m.counterparty,
      description:     m.description,
    })),
    nextCursor: page.nextCursor,
    hasMore:    page.hasMore,
  };
}
