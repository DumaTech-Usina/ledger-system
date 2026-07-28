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
  /** Sum of open payables (e.g. commission repasses not yet paid out) — not part of the consolidated cash flow. */
  openPayables: string;
  contingentExposure: string;
  currency: string;
  asOf: string;
}

/** Coarse business-line bucket, drives the category tabs in the dashboard's detail modals. */
export type MovementCategory = "saude" | "consorcio" | "seguro" | "outros";

export interface CommissionParty {
  name: string;
  email: string;
  cellphoneNumber: string;
  cpfOrCnpj: string;
}

/**
 * One payment installment (parcela) of a proposal. `originalValue` is the immutable contracted
 * value — the actual entrada/saída movements for this installment carry their own amount, which is
 * the real ("baixado") value and can differ from `originalValue`.
 */
export interface CommissionInstallment {
  number: number;
  originalValue: string;
  brokerCommissionPercent: number;
  brokerCommissionValue: string;
  /** What kind of outflow this installment produces once it settles. */
  outflowReason: "repasse" | "multa";
  /** Only set when outflowReason is "multa" — the penalty charged by the operator. */
  penaltyAmount?: string;
}

/** Structured drill-down data answering quando/quem/de quem/quanto/o quê for a commission-origin movement or position. */
export interface CommissionOrigin {
  kind: "commission";
  operatorName: string;
  planDescription: string;
  proposalNumber: number;
  broker: CommissionParty;
  client: CommissionParty;
  effectiveDate: string;
  status: "received" | "receivable";
  /** Number of insured lives covered by this proposal. */
  lives: number;
  /** Valor da proposta — sum of the installments' originalValue. Never changes. */
  totalValue: string;
  /** Every installment (parcela) this proposal is split into. */
  installments: CommissionInstallment[];
  /** Which installment this specific movement/position is about. */
  installmentNumber: number;
  /** Only set on an outflow leg (repasse or multa) — absent on the entrada leg. */
  outflowReason?: "repasse" | "multa";
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
  category?: MovementCategory;
  origin?: CommissionOrigin;
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
  category?: MovementCategory;
  origin?: CommissionOrigin;
}

export interface PositionsPage {
  data: PositionItem[];
  total: number;
}
