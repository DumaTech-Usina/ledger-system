import { PositionSummary } from "../../../../core/application/dtos/PositionSummary";
import { PositionListItem } from "../../../../core/application/dtos/PositionAggregate";
import { retractedEventIds } from "../../../../core/application/dtos/retractionUtils";
import { serializeEvent } from "./eventSerializer";

export function serializePositionListItem(item: PositionListItem) {
  return {
    objectId:       item.objectId,
    objectType:     item.objectType,
    status:         item.status,
    outcome:        item.outcome,
    currency:       item.totalOriginated.currency,
    totalOriginated: item.totalOriginated.toString(),
    totalSettled:    item.totalSettled.toString(),
    totalAdjusted:   item.totalAdjusted.toString(),
    // Null — never "0.00" — when the origination is unknown: the API must not publish a number
    // the ledger cannot derive. Consumers branch on `status === "unknown_origin"`.
    openBalance:     item.openBalance?.toString() ?? null,
    overSettlement:  item.overSettlement?.toString() ?? null,
    cashRecovered:   item.cashRecovered.toString(),
    nonCashClosed:   item.nonCashClosed.toString(),
    allocationGap:   item.allocationGap.toString(),
    eventCount:     item.eventCount,
    lastEventAt:    item.lastEventAt,
    originatedAt:   item.originatedAt ?? null,
    // When the position entered the book, and the key the listing is ordered by. Additive: no
    // published field changes meaning, and consumers that ignore it read exactly what they read before.
    createdAt:      item.createdAt,
    // Null — never a substituted date — when no origination stated terms. A consumer must be able to
    // tell "due yesterday" from "we were never told", because only one of them is a late payment.
    dueAt:          item.dueAt ?? null,
  };
}

export function serializePositionSummary(summary: PositionSummary) {
  const currency = summary.totalOriginated.currency;
  // The object's life keeps every event, including the ones that no longer count. Marking them here
  // — with the same fold the projection used — spares every consumer from re-deriving the rule, and
  // is what stops a reader from seeing a 250 and a 215 and having to guess which one stands.
  const retracted = retractedEventIds(summary.events);
  return {
    objectId:        summary.objectId,
    // Resolved, not stored: an objectId may be named with more than one objectType and the
    // aggregates settle the tie with MAX. Published here so the detail route and the list route
    // answer the same thing about the same object — until now only the list did.
    objectType:      summary.objectType,
    status:          summary.status,
    outcome:         summary.outcome,
    currency,
    totalOriginated: summary.totalOriginated.toString(),
    totalSettled:    summary.totalSettled.toString(),
    totalAdjusted:   summary.totalAdjusted.toString(),
    openBalance:     summary.openBalance?.toString() ?? null,
    overSettlement:  summary.overSettlement?.toString() ?? null,
    cashRecovered:   summary.cashRecovered.toString(),
    nonCashClosed:   summary.nonCashClosed.toString(),
    allocationGap:   summary.allocationGap.toString(),
    eventCount:      summary.eventCount,
    events:          [...summary.events].map((event) => ({
      ...serializeEvent(event),
      retracted: retracted.has(event.id.value),
    })),
    origin:          summary.origin ? {
      eventId:         summary.origin.eventId,
      eventType:       summary.origin.eventType,
      occurredAt:      summary.origin.occurredAt,
      sourceReference: summary.origin.sourceReference,
      sourceSystem:    summary.origin.sourceSystem,
      description:     summary.origin.description,
      reporter:        summary.origin.reporter,
      parties:         summary.origin.parties,
      relatedObjects:  summary.origin.relatedObjects,
    } : null,
  };
}
