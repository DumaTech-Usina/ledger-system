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
  /** Which fact the movement is part of. `effect` states the economic nature, not the fact. */
  eventType: string;
  occurredAt: Date;
  /** When the Ledger registered the fact (immutable) — distinct from occurredAt (business date). */
  recordedAt: Date;
  effect: "cash_in" | "cash_out";
  amount: Money;
  sourceReference: string | null;
  /** The system the fact came from. Travels beside the reference; neither identifies without the other. */
  sourceSystem: string | null;
  /**
   * The economic objects the event names, with the relation it declares for each. This is what says
   * which position — and which document, contract or proposal — the movement belongs to. Empty when
   * the event named none: an absence of objects, never an unknown one.
   */
  objects: Array<{ objectId: string; objectType: string; relation: string }>;
  /**
   * Everyone who took part, as the event recorded them. `counterparty` below is one of these, kept
   * because consumers already read it; publishing the whole set does not change what it means.
   */
  parties: Array<{ partyId: string; role: string; direction: string; amount: Money | null }>;
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
