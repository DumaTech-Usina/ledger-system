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
  /** Includes `unknown_origin`: the Ledger knows a settlement happened but not what was originated. */
  status: string;
  outcome: string;
  currency: string;
  totalOriginated: string;
  /** Null when the origination is unknown — never zero. The Ledger publishes no figure it cannot derive. */
  openBalance: string | null;
  eventCount: number;
  lastEventAt: string | null;
  /** When the position entered the book — the key the default listing is ordered by. */
  createdAt: string | null;
  /**
   * When the obligation falls due, as the fact that established it stated. Null when no origination
   * stated terms: neither "due today" nor "never due", and never rendered as either.
   */
  dueAt: string | null;
}

export interface TreasuryDashboard {
  available: boolean;
  cashPosition: CashPosition | null;
  movements: CashMovement[] | null;
  positions: PositionItem[] | null;
  /**
   * partyId → display name for the counterparties in `movements`. A party the Directory does not
   * know is absent here and keeps its id on screen — never a label treasury cannot support.
   */
  partyNames: Record<string, string>;
}

/**
 * One event in an economic object's life, as it relates to THAT object. `relation` is what the
 * event declares for the requested objectId — originates / settles / adjusts / reverses / retracts
 * / references — which is what makes the sequence readable as an evolution rather than a list.
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
  /**
   * The event this one speaks about: the causal origin of a settlement, or — for a rectification —
   * the assertion it retracts. Null when the event stands on its own.
   */
  relatedEventId: string | null;
  /**
   * True when a rectification declared that this event never corresponded to the world. It stays in
   * the history (nothing is rewritten) but no longer counts towards any figure. The Ledger publishes
   * this; treasury never derives it.
   */
  retracted: boolean;
  /**
   * The Ledger's own flag that this entry leaves something pending. On a withdrawal it says the
   * correction is not finished — the corrected entry has not been recorded yet.
   */
  requiresFollowup: boolean;
}

/**
 * The whole life of one economic object: the position the Ledger projects from its immutable chain,
 * plus the ordered events that produced it. The order is the Ledger's own (recordedAt ascending)
 * and is preserved as received — never re-sorted here.
 */
export interface PositionLifecycle {
  objectId: string;
  /** The kind of position, resolved by the Ledger across the object's events. */
  objectType: string;
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

/**
 * What the position math says about the whole book. Current state, not a period — the Ledger derives
 * these from every aggregate, and its `from`/`to` only scope cash figures the cash screen reads.
 */
export interface BookExposure {
  currency: string;
  openExposure: string;
  /** What Usina owes on obligations not yet paid — the total expected to leave the company. */
  openPayableExposure: string;
  /** The part of it already past its stated due date. */
  overduePayable: string;
  /** The part with a stated due date still ahead. */
  upcomingPayable: string;
  /** The part whose establishing fact stated no due date — neither late nor upcoming. */
  undatedPayable: string;
  capitalAtRisk: string;
  healthScore: {
    score: number;
    label: string;
    trend: string;
    trendDelta: number;
    closureQuality: number;
    openBookHealth: number;
    windowDays: number;
  };
}

export interface BookExposureResult {
  /** False when the Ledger could not be reached. Never rendered as zero — unknown stays unknown. */
  available: boolean;
  exposure: BookExposure | null;
}

/** One page of positions, paged by the Ledger itself. */
export interface PositionsPage {
  data: PositionItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ListPositionsResult {
  available: boolean;
  page: PositionsPage | null;
}

/**
 * The payable positions behind the upcoming/overdue figures, already split by the server.
 *
 * The totals are NOT here on purpose: they come from `BookExposure`, folded by the Ledger over every
 * aggregate. These lists are capped, and `truncated` says so rather than letting a partial list read
 * as the whole book.
 */
export interface PayablePositionsResult {
  available: boolean;
  overdue: PositionItem[];
  upcoming: PositionItem[];
  /** Outstanding, but no due date was ever stated. Shown apart — neither late nor upcoming. */
  undated: PositionItem[];
  truncated: boolean;
}
