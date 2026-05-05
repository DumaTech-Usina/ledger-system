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
    openBalance:     item.openBalance.toString(),
    overSettlement:  item.overSettlement.toString(),
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
    openBalance:     summary.openBalance.toString(),
    overSettlement:  summary.overSettlement.toString(),
    cashRecovered:   summary.cashRecovered.toString(),
    nonCashClosed:   summary.nonCashClosed.toString(),
    allocationGap:   summary.allocationGap.toString(),
    eventCount:      summary.eventCount,
    events:          [...summary.events].map(serializeEvent),
  };
}
