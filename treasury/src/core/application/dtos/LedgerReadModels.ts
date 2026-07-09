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
  effect: string; // cash_in | cash_out | cash_internal | non_cash | contingent
  amount: string;
  sourceReference: string;
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
  status: string;
  outcome: string;
  currency: string;
  totalOriginated: string;
  openBalance: string;
  eventCount: number;
  lastEventAt: string | null;
}

export interface PositionsPage {
  data: PositionItem[];
  total: number;
}
