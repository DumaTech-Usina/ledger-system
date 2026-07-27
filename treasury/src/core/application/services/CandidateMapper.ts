import type { Intent } from "../../domain/entities/Intent";
import type { Scenario } from "../../domain/scenarios/Scenario";
import type { Candidate } from "../../domain/value-objects/Candidate";

/**
 * Per-scenario economic mapping using the Ledger's RATIFIED tuples. treasury only proposes; the
 * Ledger gate is the authority. Each business operation maps to its OWN tuple so a known category is
 * recorded under its real semantic — payroll as PAYROLL_PAYMENT · PAYROLL, etc. The generic
 * OUTBOUND_PAYMENT · PAYABLE · SETTLES · CASH_OUT · ORDINARY_SETTLEMENT tuple is reserved for
 * 'register_payment', the outflow whose category the model does not yet express.
 *
 * The party/object MOLD is declared explicitly per scenario (party templates + object templates)
 * rather than derived — so a CASH_OUT expense (usina pays, amount on the payer) and a NON_CASH
 * acknowledgement (a single BENEFICIARY party, no amount) are just different declarations, matching
 * the Ledger's own canonical builders. The counterparty is always a Party, never folded into an object.
 */

/**
 * A per-instance override of the tuple, selected by a CHOICE slot's answer. Only the fields a given
 * operation legitimately varies are set; the rest fall back to the scenario's base tuple. This keeps
 * the mapper the sole tuple authority — the user picks a branch, never a raw Ledger value. Overrides
 * apply to the tuple's economic fields and (for single-object scenarios) the object.
 */
interface TupleOverride {
  economicEffect?: string;
  objectType?: string;
  relation?: string;
  reasonType?: string;
  reasonText?: string;
}

/** One party the event emits. `who` selects the id (the usina, or the counterparty from a slot). */
interface PartyTemplate {
  who: "usina" | "counterparty";
  role: string;
  direction: string;
  /** Whether this party carries the event amount. False for every party of a NON_CASH event. */
  carriesAmount?: boolean;
}

interface ObjectTemplate {
  objectType: string;
  relation: string;
}

interface ScenarioMapping {
  eventType: string;
  economicEffect: string;
  /** Answer key holding the counterparty's party id — required when a template uses `counterparty`. */
  counterpartySlot?: string;
  parties: PartyTemplate[];
  objects: ObjectTemplate[];
  reasonType: string;
  reasonText: string;
  /**
   * Optional per-instance tuple selection: a CHOICE slot (`selectorSlot`) picks one override from
   * `byChoice`. A scenario without `variants` maps to a fully-constant tuple.
   */
  variants?: {
    selectorSlot: string;
    byChoice: Record<string, TupleOverride>;
  };
}

/** The standard CASH_OUT expense mold: usina pays (amount on the payer), counterparty is a neutral payee. */
const cashOutParties: PartyTemplate[] = [
  { who: "usina", role: "payer", direction: "out", carriesAmount: true },
  { who: "counterparty", role: "payee", direction: "neutral" },
];

const MAPPINGS: Record<string, ScenarioMapping> = {
  register_payment: {
    eventType: "outbound_payment",
    economicEffect: "cash_out",
    counterpartySlot: "payee",
    parties: cashOutParties,
    objects: [{ objectType: "payable", relation: "settles" }],
    reasonType: "ordinary_settlement",
    reasonText: "Ordinary settlement of a payable",
  },
  register_payroll: {
    eventType: "payroll_payment",
    economicEffect: "cash_out",
    counterpartySlot: "payee",
    parties: cashOutParties,
    objects: [{ objectType: "payroll", relation: "settles" }],
    reasonType: "payroll_payment",
    reasonText: "Payroll payment",
  },
  register_infrastructure: {
    eventType: "infrastructure_expense",
    economicEffect: "cash_out",
    counterpartySlot: "payee",
    parties: cashOutParties,
    objects: [{ objectType: "infrastructure_cost", relation: "settles" }],
    reasonType: "infrastructure_expense",
    reasonText: "Infrastructure expense",
  },
  register_penalty: {
    eventType: "penalty_payment",
    economicEffect: "cash_out",
    counterpartySlot: "payee",
    parties: cashOutParties,
    objects: [{ objectType: "penalty", relation: "settles" }],
    reasonType: "penalty_payment",
    reasonText: "Penalty payment",
  },
  register_incentive: {
    eventType: "incentive_payment",
    economicEffect: "cash_out",
    counterpartySlot: "payee",
    parties: cashOutParties,
    objects: [{ objectType: "incentive", relation: "settles" }],
    reasonType: "incentive_payment",
    reasonText: "Incentive payment",
    // The user picks whether this is an incentive or a bonus — both valid CASH_OUT objects under
    // INCENTIVE_PAYMENT. Recording a bonus AS a bonus preserves more factual information than
    // collapsing it to a generic incentive.
    variants: {
      selectorSlot: "kind",
      byChoice: {
        incentive: { objectType: "incentive" },
        bonus: { objectType: "bonus" },
      },
    },
  },
  // Advance disbursement and loan origination are cash-out like the above, but they ORIGINATE a
  // credit object (an advance / a loan) to be settled or repaid later — never SETTLE a payable.
  register_advance: {
    eventType: "advance_payment",
    economicEffect: "cash_out",
    counterpartySlot: "payee",
    parties: cashOutParties,
    objects: [{ objectType: "advance", relation: "originates" }],
    reasonType: "advance_payment",
    reasonText: "Advance disbursement",
  },
  register_loan: {
    eventType: "loan_origination",
    economicEffect: "cash_out",
    counterpartySlot: "payee",
    parties: cashOutParties,
    objects: [{ objectType: "loan", relation: "originates" }],
    reasonType: "loan_origination",
    reasonText: "Loan origination",
  },

  // ── NON_CASH operations (no cash moves; a single BENEFICIARY party carries no amount) ──────────
  // The commission waiver discharges a broker's entitlement. `basis` selects a standard waiver
  // (SETTLES) or reversing an incorrectly granted entitlement (REVERSES).
  register_waiver: {
    eventType: "commission_waiver",
    economicEffect: "non_cash",
    counterpartySlot: "payee",
    parties: [{ who: "counterparty", role: "beneficiary", direction: "neutral" }],
    objects: [{ objectType: "commission_entitlement", relation: "settles" }],
    reasonType: "commission_waiver",
    reasonText: "Commission waiver",
    variants: {
      selectorSlot: "basis",
      byChoice: {
        waiver: { relation: "settles" },
        reversal: { relation: "reverses" },
      },
    },
  },
  // Accrual: the usina records the commission it EXPECTS to receive before cash arrives. The single
  // party is the usina itself (the beneficiary of the future receivable); no counterparty is recorded.
  register_commission_accrual: {
    eventType: "commission_expected",
    economicEffect: "non_cash",
    parties: [{ who: "usina", role: "beneficiary", direction: "neutral" }],
    objects: [{ objectType: "commission_receivable", relation: "originates" }],
    reasonType: "commission_accrual",
    reasonText: "Accrual of an expected commission",
  },
  // The operator paid the broker directly (bypassing the usina); the usina acknowledges the
  // settlement of BOTH its commission receivable and the broker's entitlement — no cash arrived.
  register_direct_payment: {
    eventType: "direct_payment_acknowledged",
    economicEffect: "non_cash",
    counterpartySlot: "payee",
    parties: [{ who: "counterparty", role: "beneficiary", direction: "neutral" }],
    objects: [
      { objectType: "commission_receivable", relation: "settles" },
      { objectType: "commission_entitlement", relation: "settles" },
    ],
    reasonType: "direct_commission_payment_authorized",
    reasonText: "Operator paid the broker directly",
  },
};

export class CandidateMapper {
  constructor(private readonly usinaPartyId: string) {}

  build(intent: Intent, _scenario: Scenario): Candidate {
    const m = MAPPINGS[intent.scenarioId];
    if (!m) throw new Error(`No candidate mapping for scenario '${intent.scenarioId}'`);

    const a = intent.answers;
    const amount = a.amount;
    const sourceReference = `intent:${intent.id}`;

    // Apply the per-instance tuple override selected by the variant slot, if any. Absent variants
    // (or an unrecognized choice) leaves the base tuple untouched.
    const override: TupleOverride = m.variants ? m.variants.byChoice[a[m.variants.selectorSlot]] ?? {} : {};
    const economicEffect = override.economicEffect ?? m.economicEffect;
    const reasonType = override.reasonType ?? m.reasonType;
    const reasonText = override.reasonText ?? m.reasonText;

    // The override targets the object being varied (variant scenarios are single-object). Multiple
    // objects each get a distinct id derived from the source reference; a single object keeps it bare.
    const objectTemplates = m.objects.map((o, i) =>
      i === 0 ? { objectType: override.objectType ?? o.objectType, relation: override.relation ?? o.relation } : o,
    );
    const objects = objectTemplates.map((o) => ({
      objectId: objectTemplates.length === 1 ? sourceReference : `${sourceReference}:${o.objectType}`,
      objectType: o.objectType,
      relation: o.relation,
    }));

    const parties = m.parties.map((pt) => {
      const partyId = pt.who === "usina" ? this.usinaPartyId : a[m.counterpartySlot!];
      const base = { partyId, role: pt.role, direction: pt.direction };
      return pt.carriesAmount ? { ...base, amount } : base;
    });

    return {
      sourceReference,
      eventType: m.eventType,
      economicEffect,
      occurredAt: new Date(a.occurredAt).toISOString(),
      amount,
      currency: a.currency,
      description: a.description || undefined,
      parties,
      objects,
      reason: { type: reasonType, description: reasonText, confidence: "high", requiresFollowup: false },
      reporter: { reporterType: "user", reporterId: intent.userId, channel: "web" },
    };
  }

  /**
   * Reverse of the party/object mapping: given a candidate field path the Ledger implicated in a
   * rejection, return the scenario slot the user should re-answer — or undefined when the field is
   * not user-editable (Treasury/Ledger-supplied) or has no slot. A "parties" rejection resolves to
   * the counterparty slot (when the scenario has one). `relatedEventId` has no slot yet (it arrives
   * with the settlement scenarios).
   */
  fieldToSlot(scenarioId: string, field: string): string | undefined {
    const m = MAPPINGS[scenarioId];
    if (!m) return undefined;
    if (field === "parties") return m.counterpartySlot;
    if (field === "amount" || field === "currency" || field === "occurredAt" || field === "description") return field;
    return undefined;
  }
}
