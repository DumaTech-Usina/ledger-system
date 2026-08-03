/*
 * Treasury's own read DTOs for Ledger data. They mirror the Ledger's read-API response shapes but
 * are owned by treasury (no Ledger code is imported). Money values are the Ledger's raw decimal
 * strings (e.g. "1250000.00"); treasury only formats them for display, never recomputes them.
 */
export interface CashPosition {
  totalCashIn: string;
  totalCashOut: string;
  netCashFlow: string; // signed, e.g. "+419500.00"
  openReceivables: string;
  contingentExposure: string;
  currency: string;
  asOf: string;
}

export interface CashMovement {
  eventId: string;
  occurredAt: string;
  recordedAt: string;
  effect: string; // cash_in | cash_out | cash_internal | non_cash | contingent
  amount: string;
  sourceReference: string;
  counterparty: string | null;
  description: string | null;
}

export interface CashMovementsPage {
  items: CashMovement[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface PositionItem {
  objectId: string;
  objectType: string;
  /** Includes `unknown_origin`: the Ledger knows a settlement happened but not what was originated. */
  status: string;
  outcome: string;
  currency: string;
  totalOriginated: string;
  /** Null when the origination is unknown — the Ledger publishes no number it cannot derive. */
  openBalance: string | null;
  eventCount: number;
  lastEventAt: string | null;
}

export interface PositionsPage {
  data: PositionItem[];
  total: number;
}

/**
 * One event in an economic object's life, as it relates to THAT object. `relation` is the relation
 * the event declares for the requested objectId — originates / settles / adjusts / reverses — which
 * is what makes the sequence readable as an evolution rather than a list of unrelated facts.
 */
export interface PositionLifecycleEvent {
  eventId: string;
  eventType: string;
  economicEffect: string;
  relation: string | null;
  amount: string;
  currency: string;
  occurredAt: string;
  recordedAt: string;
  description: string | null;
}

/**
 * The whole life of one economic object: the position the Ledger projects from its immutable chain,
 * plus the ordered events that produced it. Treasury never recomputes any of these figures — the
 * order is the Ledger's own (recordedAt ascending) and is preserved as received.
 */
export interface PositionLifecycle {
  objectId: string;
  status: string;
  outcome: string;
  currency: string;
  totalOriginated: string;
  totalSettled: string;
  /** Null when the origination is unknown — never zero. */
  openBalance: string | null;
  eventCount: number;
  events: PositionLifecycleEvent[];
}
