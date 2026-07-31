export interface CashPosition {
  totalCashIn: string;
  totalCashOut: string;
  netCashFlow: string;
  openReceivables: string;
  contingentExposure: string;
  currency: string;
  asOf: string;
}

export interface CashMovement {
  eventId: string;
  occurredAt: string;
  recordedAt: string;
  effect: string;
  amount: string;
  sourceReference: string;
  counterparty: string | null;
  description: string | null;
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

export interface ClassificationHealth {
  uncategorizedCount: number;
  scannedCount: number;
  totalPositions: number;
  sharePercent: number;
  aging: { fresh: number; recent: number; stale: number };
  oldestDays: number | null;
}

export interface TreasuryDashboard {
  available: boolean;
  cashPosition: CashPosition | null;
  movements: CashMovement[] | null;
  positions: PositionItem[] | null;
  classificationHealth: ClassificationHealth | null;
}
