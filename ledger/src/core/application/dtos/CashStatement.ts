import { Money } from "../../domain/value-objects/Money";

export interface CashStatement {
  period: { from: Date; to: Date };
  openingBalance: Money;
  openingBalanceNegative: boolean;
  closingBalance: Money;
  closingBalanceNegative: boolean;
  totalCashIn: Money;
  totalCashOut: Money;
  netFlow: Money;
  currency: string;
}

export interface CashMovement {
  eventId: string;
  occurredAt: Date;
  /** When the Ledger registered the fact (immutable) — distinct from occurredAt (business date). */
  recordedAt: Date;
  effect: "cash_in" | "cash_out";
  amount: Money;
  sourceReference: string | null;
  /** The other side of the movement (the non-usina party) — for cash movements, the NEUTRAL party. */
  counterparty: string | null;
  description: string | null;
}

export interface CashMovementPage {
  items: CashMovement[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface CashMovementsPaginatedOptions {
  partyId: string;
  from?: Date;
  to?: Date;
  limit: number;
  cursor?: { occurredAt: Date; id: string };
}
