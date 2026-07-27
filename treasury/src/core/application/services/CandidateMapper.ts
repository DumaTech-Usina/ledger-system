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

    return {
      sourceReference,
      eventType: m.eventType,
      economicEffect: m.economicEffect,
      occurredAt: new Date(a.occurredAt).toISOString(),
      amount,
      currency: a.currency,
      description: a.description || undefined,
      parties: [
        { partyId: this.usinaPartyId, role: m.usinaRole, direction: m.usinaDirection, amount },
        { partyId: a[m.counterpartySlot], role: m.counterpartyRole, direction: "neutral" },
      ],
      objects: [{ objectId: sourceReference, objectType: m.objectType, relation: m.relation }],
      reason: { type: m.reasonType, description: m.reasonText, confidence: "high", requiresFollowup: false },
      reporter: { reporterType: "user", reporterId: intent.userId, channel: "web" },
    };
  }
}
