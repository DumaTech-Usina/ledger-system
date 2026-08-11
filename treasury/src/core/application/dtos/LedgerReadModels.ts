/*
 * Treasury's own read DTOs for Ledger data. They mirror the Ledger's read-API response shapes but
 * are owned by treasury (no Ledger code is imported). Money values are the Ledger's raw decimal
 * strings (e.g. "1250000.00"); treasury only formats them for display, never recomputes them.
 */
/**
 * One line of what an open-balance total is made of: the balance held by a single kind of object.
 * A kind with nothing outstanding is absent from the list, never present as zero.
 */
export interface OpenBalanceByObjectType {
  objectType: string;
  openBalance: string;
}

export interface CashPosition {
  totalCashIn: string;
  totalCashOut: string;
  netCashFlow: string; // signed, e.g. "+419500.00"
  openReceivables: string;
  /**
   * Recognized obligations not yet paid — what the book says is committed to leave. Never netted
   * against `openReceivables`, and never against the cash figures above: the two are different folds
   * over the same events and a total mixing them would mean nothing.
   */
  openPayables?: string;
  contingentExposure: string;
  /**
   * What each of the three totals is made of, by kind of object. Optional because a Ledger that
   * predates the field publishes no composition — which is "not told", not "made of nothing".
   *
   * Treasury never sums these: the totals beside them are the Ledger's own fold over the same rows.
   * They are here to be shown, grouped and ordered — never to be added up into a figure.
   */
  openReceivablesByType?: OpenBalanceByObjectType[];
  openPayablesByType?: OpenBalanceByObjectType[];
  contingentExposureByType?: OpenBalanceByObjectType[];
  currency: string;
  asOf: string;
}

export interface CashMovement {
  eventId: string;
  /**
   * Which fact the movement is part of. Optional because a Ledger that predates the field simply
   * does not publish it — absent means "not told", which is why nothing is substituted for it.
   */
  eventType?: string;
  occurredAt: string;
  recordedAt: string;
  effect: string; // cash_in | cash_out | cash_internal | non_cash | contingent
  amount: string;
  sourceReference: string;
  /** The system the reference belongs to. Same optionality, same reason, as `eventType`. */
  sourceSystem?: string | null;
  /**
   * The positions and documents the movement names, with the relation declared for each. Absent
   * against an older Ledger; an empty array is a different statement — the event named no object.
   */
  objects?: { objectId: string; objectType: string; relation: string }[];
  /**
   * Everyone who took part in the fact. `counterparty` below is one of them and keeps its meaning;
   * this publishes the rest, with the role, direction and per-party amount the Ledger recorded.
   */
  parties?: { partyId: string; role: string; direction: string; amount: string | null }[];
  counterparty: string | null;
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
  /** Includes `unknown_origin`: the Ledger knows a settlement happened but not what was originated. */
  status: string;
  outcome: string;
  currency: string;
  totalOriginated: string;
  /** Null when the origination is unknown — the Ledger publishes no number it cannot derive. */
  openBalance: string | null;
  eventCount: number;
  lastEventAt: string | null;
  /** When the position was originated. Null when no ORIGINATES event is on record. */
  originatedAt: string | null;
  /** When the position entered the book, and the key the default listing is ordered by. */
  createdAt: string | null;
  /**
   * When the obligation falls due, as the fact that established it stated. Null when no origination
   * stated terms — which is neither "due today" nor "never due", and must never be rendered as either.
   */
  dueAt: string | null;
}

export interface PositionsPage {
  data: PositionItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * One event in an economic object's life, as it relates to THAT object. `relation` is the relation
 * the event declares for the requested objectId — originates / settles / adjusts / reverses /
 * retracts — which is what makes the sequence readable as an evolution rather than a list of
 * unrelated facts.
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
   * True when a rectification declared that this event never corresponded to the world. It remains
   * in the history (nothing is rewritten) but no longer counts towards any figure. Treasury does
   * NOT derive this: the Ledger publishes it, so both sides can never disagree about what stands.
   */
  retracted: boolean;
  /**
   * The Ledger's own flag that this entry leaves something pending. On a withdrawal it is what says
   * the correction is not finished — the corrected entry has not been recorded yet. Derived state is
   * never stored: whether it is STILL pending is answered by looking at what has landed since.
   */
  requiresFollowup: boolean;
  /**
   * Every object the event names, not only the one being read. The siblings are the contextual
   * references — the proposal, the contract, the installment — that say what the fact was about.
   * Passed through as the Ledger publishes them; `relation` above stays the one declared for the
   * requested objectId, so neither field changes what it always meant.
   */
  objects: { objectId: string; objectType: string; relation: string }[];
  /**
   * Where the fact came from: the external system and its own identifier for it (proposal number,
   * contract id, the intent that produced it). Null only against a Ledger that publishes no source.
   */
  source: { system: string; reference: string } | null;
  /**
   * Who took part in the fact, as the Ledger recorded them — the counterparty of this event, and
   * the role and direction that say which side each one was on.
   *
   * Empty when the event named none: a fact may legitimately be recorded with a single party, or
   * with none, and an empty list is that absence rather than an unknown. Ids only; a display name
   * is treasury's own knowledge and travels beside the payload, never inside this mirror.
   */
  parties: { partyId: string; role: string; direction: string; amount: string | null }[];
}

/**
 * The contextual references of the origination that STILL STANDS for a position — what document,
 * contract or proposal it refers to.
 *
 * Selected from the published events, never from the detail's own `origin` block: that block is
 * extracted before the retraction fold, so it keeps naming an event a rectification already declared
 * never happened. The selection rule is the same one the settlement candidates use, and it is
 * written once so the two can never drift apart.
 *
 * Null when no origination stands — which is a legitimate state (a cash-basis position never had
 * one, and a retracted one no longer does), and is never filled in from a retracted event.
 */
export interface PositionOriginRef {
  eventId: string;
  eventType: string;
  occurredAt: string;
  /** The external system and its identifier for the fact — the "número de origem" of the position. */
  source: { system: string; reference: string } | null;
  /**
   * The other objects the origination named beside this position: proposal, contract, installment.
   * Empty when it named none — the origination referred to nothing else, which is not the same as
   * a reference that is unknown.
   */
  relatedObjects: { objectId: string; objectType: string; relation: string }[];
  /**
   * Who the position is WITH: the parties of the origination that still stands, with their roles.
   * Empty when the origination named none — never filled in from a later event, which would answer
   * a question about the origination with a fact about something else.
   */
  parties: { partyId: string; role: string; direction: string; amount: string | null }[];
}

/**
 * The whole life of one economic object: the position the Ledger projects from its immutable chain,
 * plus the ordered events that produced it. Treasury never recomputes any of these figures — the
 * order is the Ledger's own (recordedAt ascending) and is preserved as received.
 */
export interface PositionLifecycle {
  objectId: string;
  /**
   * The kind of position. Resolved by the Ledger across the object's events, not stored — an
   * objectId may be named with more than one type and the aggregates settle the tie the same way.
   * Published on the detail route so it agrees with the list route, which has always carried it.
   */
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
  /** What the standing origination refers to. Null when none stands — never inferred from elsewhere. */
  origin: PositionOriginRef | null;
}

/**
 * A single Ledger event, as `GET /api/events/:id` publishes it — trimmed to what Treasury needs in
 * order to describe a correction of it. The figures are the Ledger's own; Treasury never recomputes
 * them and never guesses them from the user.
 */
export interface LedgerEventRef {
  eventId: string;
  eventType: string;
  economicEffect: string;
  amount: string;
  currency: string;
  occurredAt: string;
  description: string | null;
  relatedEventId: string | null;
  objects: { objectId: string; objectType: string; relation: string }[];
  /**
   * Who took part in the fact, as the Ledger recorded it. Needed to describe a correction without
   * asking the user to re-state what the book already knows — and read-only for that purpose: the
   * counterparty of a corrected entry is never edited, because changing who took part changes which
   * fact it is, not how it was measured.
   */
  parties: { partyId: string; role: string; direction: string; amount: string | null }[];
  /** Where the fact came from. `reference` is what ties an event back to the intent that produced it. */
  source: { system: string; reference: string };
}

/**
 * The Ledger's own read of the book's economic state — what the position math says about the whole
 * book, rather than about one object. Mirrors the fields treasury displays from `GET /api/dashboard`
 * (`serializeDashboard`), trimmed to those.
 *
 * All three figures are CURRENT STATE, not period-scoped: `DashboardService.compute` derives them
 * from `findAllPositionAggregates()`, while `from`/`to` only scope the cash figures treasury does
 * not read here. That is why no period is passed.
 *
 * `attentionPositions` is deliberately NOT mirrored. The Ledger selects it by position *status* and
 * sorts by `originatedAt ?? 0`, so a cash-basis position — status `open`, balance 0.00, no
 * origination date — sorts to the top and occupies the six slots before the list is cut. Filtering
 * downstream cannot recover what the cut already dropped, so treasury builds its own attention list
 * from balances instead.
 */
export interface BookExposure {
  currency: string;
  /** Sum of open balances across positions the Ledger can measure. */
  openExposure: string;
  /**
   * What Usina owes on recognized obligations it has not yet paid — the total expected to leave the
   * company. Kept apart from `openExposure`, which runs the other way; the Ledger never adds them.
   */
  openPayableExposure: string;
  /** The part of `openPayableExposure` already past its stated due date. */
  overduePayable: string;
  /** The part with a stated due date still ahead. */
  upcomingPayable: string;
  /**
   * The part whose establishing fact stated no due date. Belongs to neither of the other two: the
   * book cannot call it late and cannot call it upcoming, so it is published as its own figure.
   */
  undatedPayable: string;
  /** Open balances originated over 30 days ago with nothing settled against them yet. */
  capitalAtRisk: string;
  healthScore: {
    /** Composite 0–100. */
    score: number;
    label: string;
    trend: string;
    trendDelta: number;
    /** Fraction of settlements closed via cash in the window (0–1). */
    closureQuality: number;
    /** 1 − (capitalAtRisk / openExposure) across open positions (0–1). */
    openBookHealth: number;
    windowDays: number;
  };
}
