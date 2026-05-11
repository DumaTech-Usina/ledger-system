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
  effect: "cash_in" | "cash_out";
  amount: Money;
  sourceReference: string | null;
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
