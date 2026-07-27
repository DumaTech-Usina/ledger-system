import type { Intent } from "../../domain/entities/Intent";
import type { Scenario } from "../../domain/scenarios/Scenario";
import type { Candidate } from "../../domain/value-objects/Candidate";

/**
 * Per-scenario economic mapping using the Ledger's RATIFIED tuples. treasury only proposes; the
 * Ledger gate is the authority. Each business operation maps to its OWN tuple so a known category is
 * recorded under its real semantic — payroll as PAYROLL_PAYMENT · PAYROLL, etc. The generic
 * OUTBOUND_PAYMENT · PAYABLE · SETTLES · CASH_OUT · ORDINARY_SETTLEMENT tuple is reserved for
 * 'register_payment', the outflow whose category the model does not yet express. In every case the
 * counterparty is expressed exclusively as the payee Party (never folded into the object).
 */
/**
 * A per-instance override of the tuple, selected by a CHOICE slot's answer. Only the fields that a
 * given operation legitimately varies are set; the rest fall back to the scenario's base tuple. This
 * keeps the mapper the sole tuple authority — the user picks a branch, never a raw Ledger value. The
 * party/object *mold* (directions, amounts, object count) is not varied here; that arrives in a
 * later step for NON_CASH / multi-object operations.
 */
interface TupleOverride {
  economicEffect?: string;
  objectType?: string;
  relation?: string;
  reasonType?: string;
  reasonText?: string;
}

interface ScenarioMapping {
  eventType: string;
  economicEffect: string;
  usinaRole: string;
  usinaDirection: string;
  counterpartyRole: string;
  counterpartySlot: string;
  objectType: string;
  relation: string;
  reasonType: string;
  reasonText: string;
  /**
   * Optional per-instance tuple selection: a CHOICE slot (`selectorSlot`) picks one override from
   * `byChoice`. A scenario without `variants` maps to a fully-constant tuple, exactly as before.
   */
  variants?: {
    selectorSlot: string;
    byChoice: Record<string, TupleOverride>;
  };
}

const MAPPINGS: Record<string, ScenarioMapping> = {
  register_payment: {
    eventType: "outbound_payment",
    economicEffect: "cash_out",
    usinaRole: "payer",
    usinaDirection: "out",
    counterpartyRole: "payee",
    counterpartySlot: "payee",
    objectType: "payable",
    relation: "settles",
    reasonType: "ordinary_settlement",
    reasonText: "Ordinary settlement of a payable",
  },
  register_payroll: {
    eventType: "payroll_payment",
    economicEffect: "cash_out",
    usinaRole: "payer",
    usinaDirection: "out",
    counterpartyRole: "payee",
    counterpartySlot: "payee",
    objectType: "payroll",
    relation: "settles",
    reasonType: "payroll_payment",
    reasonText: "Payroll payment",
  },
  register_infrastructure: {
    eventType: "infrastructure_expense",
    economicEffect: "cash_out",
    usinaRole: "payer",
    usinaDirection: "out",
    counterpartyRole: "payee",
    counterpartySlot: "payee",
    objectType: "infrastructure_cost",
    relation: "settles",
    reasonType: "infrastructure_expense",
    reasonText: "Infrastructure expense",
  },
  register_penalty: {
    eventType: "penalty_payment",
    economicEffect: "cash_out",
    usinaRole: "payer",
    usinaDirection: "out",
    counterpartyRole: "payee",
    counterpartySlot: "payee",
    objectType: "penalty",
    relation: "settles",
    reasonType: "penalty_payment",
    reasonText: "Penalty payment",
  },
  register_incentive: {
    eventType: "incentive_payment",
    economicEffect: "cash_out",
    usinaRole: "payer",
    usinaDirection: "out",
    counterpartyRole: "payee",
    counterpartySlot: "payee",
    objectType: "incentive",
    relation: "settles",
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
    usinaRole: "payer",
    usinaDirection: "out",
    counterpartyRole: "payee",
    counterpartySlot: "payee",
    objectType: "advance",
    relation: "originates",
    reasonType: "advance_payment",
    reasonText: "Advance disbursement",
  },
  register_loan: {
    eventType: "loan_origination",
    economicEffect: "cash_out",
    usinaRole: "payer",
    usinaDirection: "out",
    counterpartyRole: "payee",
    counterpartySlot: "payee",
    objectType: "loan",
    relation: "originates",
    reasonType: "loan_origination",
    reasonText: "Loan origination",
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
    const objectType = override.objectType ?? m.objectType;
    const relation = override.relation ?? m.relation;
    const reasonType = override.reasonType ?? m.reasonType;
    const reasonText = override.reasonText ?? m.reasonText;

    return {
      sourceReference,
      eventType: m.eventType,
      economicEffect,
      occurredAt: new Date(a.occurredAt).toISOString(),
      amount,
      currency: a.currency,
      description: a.description || undefined,
      parties: [
        { partyId: this.usinaPartyId, role: m.usinaRole, direction: m.usinaDirection, amount },
        { partyId: a[m.counterpartySlot], role: m.counterpartyRole, direction: "neutral" },
      ],
      objects: [{ objectId: sourceReference, objectType, relation }],
      reason: { type: reasonType, description: reasonText, confidence: "high", requiresFollowup: false },
      reporter: { reporterType: "user", reporterId: intent.userId, channel: "web" },
    };
  }

  /**
   * Reverse of the party/object mapping: given a candidate field path the Ledger implicated in a
   * rejection, return the scenario slot the user should re-answer — or undefined when the field is
   * not user-editable (Treasury/Ledger-supplied) or has no slot yet. The forward map owns the
   * counterparty slot, so a "parties" rejection resolves to it. `relatedEventId` has no slot in the
   * current shape-A scenarios (a lineage slot arrives with the settlement scenarios).
   */
  fieldToSlot(scenarioId: string, field: string): string | undefined {
    const m = MAPPINGS[scenarioId];
    if (!m) return undefined;
    if (field === "parties") return m.counterpartySlot;
    if (field === "amount" || field === "currency" || field === "occurredAt" || field === "description") return field;
    return undefined;
  }
}
