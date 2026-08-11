export interface CashPosition {
  totalCashIn: string;
  totalCashOut: string;
  netCashFlow: string;
  openReceivables: string;
  contingentExposure: string;
  currency: string;
  asOf: string;
}

/**
 * One object an event names, with the relation the event declares for it. `objectType` is `""` only
 * against a Ledger that does not publish it — an absence to be shown as such, never guessed.
 */
export interface EventObjectRef {
  objectId: string;
  objectType: string;
  relation: string;
}

/**
 * One participant in a fact, as the Ledger recorded it. `direction` is what makes a movement legible
 * as "from whom, to whom": `out` is the side money left, `in` the side it reached, `neutral` the
 * side that took part without the cash moving on its own account.
 */
export interface EventPartyRef {
  partyId: string;
  role: string;
  direction: string;
  /** The share attributed to this party. Null when the event stated only a total. */
  amount: string | null;
}

export interface CashMovement {
  eventId: string;
  /**
   * Which fact the movement is part of. Optional because a Ledger that predates the field does not
   * publish it — absent means "not told", which is why nothing is substituted for it.
   */
  eventType?: string;
  occurredAt: string;
  recordedAt: string;
  effect: string;
  amount: string;
  sourceReference: string;
  /** The system the reference belongs to. Same optionality, same reason, as `eventType`. */
  sourceSystem?: string | null;
  /**
   * The positions and documents the movement names. Absent against an older Ledger; an empty array
   * is a different statement — the event named no object at all.
   */
  objects?: EventObjectRef[];
  /**
   * Everyone who took part. `counterparty` below is one of them and keeps its meaning; this is the
   * whole cast, with the role, direction and per-party amount the Ledger recorded.
   */
  parties?: EventPartyRef[];
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
  /**
   * Every object the event names, not only the one being read. The siblings are the contextual
   * references — the proposal, the contract, the installment — that say what the fact was about.
   * `relation` above stays the one declared for the requested objectId; neither field changes what
   * it always meant.
   *
   * The parties of these events are NOT here: the Ledger publishes them, but treasury's read
   * adapter does not carry them through, so this screen cannot say who took part in a position's
   * events the way the movement screen can.
   */
  objects: EventObjectRef[];
  /**
   * Where the fact came from: the external system and its own identifier for it (proposal number,
   * contract id, the intent that produced it). Null only against a Ledger that publishes no source.
   */
  source: { system: string; reference: string } | null;
}

/**
 * What the origination that STILL STANDS for a position refers to — the document, contract or
 * proposal behind it.
 *
 * Selected by the server from the published events with the retracted ones excluded, so a
 * rectification that took an origination back is not still answering for the position here.
 */
export interface PositionOriginRef {
  eventId: string;
  eventType: string;
  occurredAt: string;
  /** The external system and its identifier for the fact — the position's "número de origem". */
  source: { system: string; reference: string } | null;
  /**
   * The other objects the origination named beside this position. Empty when it named none — which
   * is not the same as a reference that is unknown.
   */
  relatedObjects: EventObjectRef[];
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
  /**
   * What the standing origination refers to. Null when none stands — a legitimate state (a
   * cash-basis position never had one, a retracted one no longer does) and never inferred from
   * elsewhere, so it must be said in words rather than left blank.
   */
  origin: PositionOriginRef | null;
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
