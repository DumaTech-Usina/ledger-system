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
  /**
   * How many movements match the filters, and where this page sits among them.
   *
   * **Null in cursor mode, and null is not zero.** A keyset page knows what comes next, never how
   * much there is in total — publishing a 0 there would state that the book holds nothing. They
   * carry numbers only when a numbered page was asked for, because counting is work a caller has to
   * choose to pay for.
   */
  total: number | null;
  page: number | null;
  totalPages: number | null;
}

/**
 * Which axis the listing is ordered by.
 *
 * `occurredAt` — when the fact happened. The default, and what a statement means: it is the date a
 * person reconciles against a bank line.
 *
 * `recordedAt` — when the fact was written to the book. Answers "what has been recorded since I
 * last looked", which occurrence cannot: a fact may be recorded long after it happened. Same axis
 * the position listing calls `createdAt`.
 */
export type CashMovementSortKey = "occurredAt" | "recordedAt";

/**
 * A keyset position in the listing, carrying the ordering it was issued for.
 *
 * The key and the order travel WITH the cursor on purpose. A cursor is a statement about a specific
 * ordering — "continue after this point, in this direction" — and replaying it under a different
 * one would silently skip or repeat rows. Now that the ordering is a parameter, the cursor has to
 * say which one it belongs to so the mismatch can be refused instead of served.
 */
export interface CashMovementCursor {
  key: CashMovementSortKey;
  order: "ASC" | "DESC";
  value: Date;
  id: string;
}

export interface CashMovementsPaginatedOptions {
  /**
   * Scopes the listing to one party's statement. Optional: absent means every cash movement in the
   * book, which is a different question — "what moved" rather than "what moved for this party" —
   * and one the ledger could not be asked before. Absent is never read as "no party": the events
   * still carry their whole cast, and nothing about them is filtered out.
   */
  partyId?: string;
  /**
   * Restricts the listing to one direction of cash. Absent means both, which is what a statement is.
   * The set is closed at CASH_IN | CASH_OUT because those are the only effects a cash movement has —
   * this narrows the existing filter, it does not widen it to other effects.
   */
  effect?: "cash_in" | "cash_out";
  from?: Date;
  to?: Date;
  limit: number;
  /**
   * Continue after a keyset position. Constant cost at any depth, and the mode to prefer for a feed
   * over a table that only grows. Mutually exclusive with `page`.
   */
  cursor?: CashMovementCursor;
  /**
   * A numbered page, 1-based. Costs an extra COUNT over the filtered set and an OFFSET that grows
   * with depth — paid only when a caller asks for numbered pages, never on the cursor path.
   */
  page?: number;
  /** Defaults to `occurredAt`. */
  sortBy?: CashMovementSortKey;
  /** Defaults to `DESC` — newest first, which is what a statement is read as. */
  sortOrder?: "ASC" | "DESC";
}
