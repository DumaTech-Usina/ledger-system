import { CashMovementPage } from "../../../../core/application/dtos/CashStatement";

export function serializeCashMovementPage(page: CashMovementPage) {
  return {
    items: page.items.map((m) => ({
      eventId:         m.eventId,
      // Additive: `effect` keeps meaning exactly what it meant. It states the economic nature of the
      // movement, which never said which fact the movement is part of — that is what eventType says.
      eventType:       m.eventType,
      occurredAt:      m.occurredAt.toISOString(),
      recordedAt:      m.recordedAt.toISOString(),
      effect:          m.effect,
      amount:          m.amount.toString(),
      sourceReference: m.sourceReference,
      sourceSystem:    m.sourceSystem,
      // What the movement is about: the positions it touches and the documents named beside them.
      objects:         m.objects,
      // The whole cast of the fact. `counterparty` stays: it is one of these, and removing it would
      // change a published field rather than add to it.
      parties:         m.parties.map((p) => ({
        partyId:   p.partyId,
        role:      p.role,
        direction: p.direction,
        amount:    p.amount?.toString() ?? null,
      })),
      counterparty:    m.counterparty,
      description:     m.description,
    })),
    nextCursor: page.nextCursor,
    hasMore:    page.hasMore,
    // Null on a keyset page, and null is not zero: nobody counted. A consumer must be able to tell
    // "there is no total here" from "the total is none", which is why neither is defaulted.
    total:      page.total,
    page:       page.page,
    totalPages: page.totalPages,
  };
}
