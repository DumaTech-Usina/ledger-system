/**
 * The Ledger's closed sets for filtering and sorting, as documented in `treasury_api_reference.md`
 * §3.3/§3.5/§4. Mirrored here — not derived from `t.objectType` etc., which also carries a few
 * demo-fixture-only labels (`charge`, `purchase`, `commission`, `unknown`) that are not real filter
 * values and would 400 if sent as one.
 */

/** `positions` `status`. Several are read as OR. */
export const POSITION_STATUSES = [
  "open",
  "partially_settled",
  "fully_settled",
  "reversed",
  "unknown_origin",
] as const;

/** `positions` `outcome`. Single value. */
export const POSITION_OUTCOMES = ["gain", "partial_loss", "full_loss", "cancelled", "pending"] as const;

/**
 * `positions` `objectType`. Several are read as OR. Only the kinds that hold a balance: contracts,
 * proposals, installments, batches and campaigns are contexts, which the listing leaves out (DEC-035).
 */
export const OBJECT_TYPES = [
  "commission_entitlement",
  "commission_pool",
  "commission_receivable",
  "commission_payable",
  "loan",
  "advance",
  "receivable",
  "payable",
  "penalty",
  "chargeback",
  "contingent_claim",
  "dispute",
  "incentive",
  "bonus",
  "payroll",
  "service_fee",
  "infrastructure_cost",
  "tax",
] as const;

/** `movements` `effect`. Single value; the book also has `cash_internal`/`non_cash`/`contingent`, which are not cash movements. */
export const CASH_EFFECTS = ["cash_in", "cash_out"] as const;

/** `positions` `sortBy`. */
export const POSITION_SORT_KEYS = ["createdAt", "dueAt"] as const;

/** `movements` `sortBy`. */
export const MOVEMENT_SORT_KEYS = ["occurredAt", "recordedAt"] as const;
