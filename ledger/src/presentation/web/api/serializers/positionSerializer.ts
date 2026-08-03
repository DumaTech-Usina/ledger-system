import { PositionSummary } from "../../../../core/application/dtos/PositionSummary";
import { PositionListItem } from "../../../../core/application/dtos/PositionAggregate";
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
  };
}

export function serializePositionSummary(summary: PositionSummary) {
  const currency = summary.totalOriginated.currency;
  return {
    objectId:        summary.objectId,
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
    events:          [...summary.events].map(serializeEvent),
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
