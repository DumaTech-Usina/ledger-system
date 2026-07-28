export interface CashPosition {
  totalCashIn: string;
  totalCashOut: string;
  netCashFlow: string;
  openReceivables: string;
  openPayables: string;
  contingentExposure: string;
  currency: string;
  asOf: string;
}

export type MovementCategory = "saude" | "consorcio" | "seguro" | "outros";

export interface CommissionParty {
  name: string;
  email: string;
  cellphoneNumber: string;
  cpfOrCnpj: string;
}

export interface CommissionInstallment {
  number: number;
  originalValue: string;
  brokerCommissionPercent: number;
  brokerCommissionValue: string;
  outflowReason: "repasse" | "multa";
  penaltyAmount?: string;
}

export interface CommissionOrigin {
  kind: "commission";
  operatorName: string;
  planDescription: string;
  proposalNumber: number;
  broker: CommissionParty;
  client: CommissionParty;
  effectiveDate: string;
  status: "received" | "receivable";
  lives: number;
  totalValue: string;
  installments: CommissionInstallment[];
  installmentNumber: number;
  outflowReason?: "repasse" | "multa";
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
  category?: MovementCategory;
  origin?: CommissionOrigin;
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
  category?: MovementCategory;
  origin?: CommissionOrigin;
}

export interface ClassificationHealth {
  uncategorizedCount: number;
  scannedCount: number;
  totalPositions: number;
  sharePercent: number;
  aging: { fresh: number; recent: number; stale: number };
  oldestDays: number | null;
}

export interface DashboardPeriod {
  from: string | null;
  to: string | null;
  openingBalance: string | null;
}

export interface TreasuryDashboard {
  available: boolean;
  cashPosition: CashPosition | null;
  movements: CashMovement[] | null;
  positions: PositionItem[] | null;
  classificationHealth: ClassificationHealth | null;
  period: DashboardPeriod | null;
}
