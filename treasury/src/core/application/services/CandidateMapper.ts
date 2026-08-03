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
  /** EVENT_REF answer key holding the causal origin's event id (for settlements). */
  relatedEventSlot?: string;
  /**
   * Answer key holding the id of an economic object this event moves — the identity of a position
   * that already exists, asserted by the producer. Present ⇒ the object is a continuation, not a new
   * one; absent or blank ⇒ the id is minted as always. Distinct from `relatedEventSlot` on purpose:
   * lineage answers "which fact caused this fact" and is validated by the Ledger, while continuity
   * answers "which position this fact moves" and is nobody's to validate. Declared only on
   * single-object mappings — the multi-object case (one id per object) is not modelled yet.
   */
  objectIdSlot?: string;
  /**
   * When the origin slot is left empty, record the fact as an explicit orphan instead of gating it:
   * the reason declares the lineage unresolved (UNKNOWN_ORIGIN + follow-up). Only where the Ledger
   * contract admits UNKNOWN_ORIGIN (COMMISSION_RECEIVED). Absent ⇒ the origin slot must be required.
   */
  orphan?: { reasonType: string; reasonText: string };
}

/** The CASH_IN settlement mold: the usina receives (amount on the payee), the counterparty is neutral. */
const cashInParties: PartyTemplate[] = [
  { who: "usina", role: "payee", direction: "in", carriesAmount: true },
  { who: "counterparty", role: "beneficiary", direction: "neutral", carriesAmount: true },
];

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

  // ── CASH_IN settlements that link back to an originating event (lineage) ───────────────────────
  // Commission received SETTLES the receivable a COMMISSION_EXPECTED originated. If the origin is
  // unknown, it is recorded as an explicit orphan (never fabricating an origin).
  register_commission_received: {
    eventType: "commission_received",
    economicEffect: "cash_in",
    counterpartySlot: "payer",
    parties: cashInParties,
    objects: [{ objectType: "commission_receivable", relation: "settles" }],
    reasonType: "commission_payment",
    reasonText: "Commission received",
    relatedEventSlot: "origin",
    orphan: { reasonType: "unknown_origin", reasonText: "Commission received; originating expected unknown" },
  },
  // Advance recovery SETTLES the advance an ADVANCE_PAYMENT originated. Origin is required (the
  // contract does not admit an orphan advance settlement).
  register_advance_settlement: {
    eventType: "advance_settlement",
    economicEffect: "cash_in",
    counterpartySlot: "payer",
    parties: cashInParties,
    objects: [{ objectType: "advance", relation: "settles" }],
    reasonType: "advance_payment",
    reasonText: "Advance recovery",
    relatedEventSlot: "origin",
    objectIdSlot: "objectRef",
  },
  // ── Rectification ──────────────────────────────────────────────────────────────────────────────
  // Declares that a previously recorded event never corresponded to the world. RETRACTS names the
  // position the corrected entry moved WITHOUT moving it: the effect of a rectification is to remove
  // the target's contribution, never to add one of its own. The Ledger validates the target and the
  // chain rules; treasury only carries the assertion.
  //
  // `objectType` is not a user choice — it is filled from the Ledger's own record of the corrected
  // event, so a correction cannot name a kind of position the entry never touched.
  register_rectification: {
    eventType: "ledger_correction",
    economicEffect: "non_cash",
    parties: [{ who: "usina", role: "platform", direction: "neutral" }],
    objects: [{ objectType: "advance", relation: "retracts" }],
    reasonType: "data_reconciliation",
    reasonText: "Entry rectified: verified against the source, it never happened",
    variants: {
      selectorSlot: "objectType",
      byChoice: {
        advance: { objectType: "advance" },
        loan: { objectType: "loan" },
        commission_receivable: { objectType: "commission_receivable" },
      },
    },
    relatedEventSlot: "target",
    objectIdSlot: "objectRef",
  },

  // Loan repayment SETTLES the loan a LOAN_ORIGINATION originated. Origin is required.
  register_loan_repayment: {
    eventType: "loan_repayment",
    economicEffect: "cash_in",
    counterpartySlot: "payer",
    parties: cashInParties,
    objects: [{ objectType: "loan", relation: "settles" }],
    reasonType: "loan_repayment",
    reasonText: "Loan repayment",
    relatedEventSlot: "origin",
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
    let reasonType = override.reasonType ?? m.reasonType;
    let reasonText = override.reasonText ?? m.reasonText;

    // Lineage: link to the origin the user referenced. If the origin slot is empty AND the scenario
    // allows it, record an explicit orphan (unresolved lineage) rather than fabricating an origin.
    let relatedEventId: string | undefined;
    let requiresFollowup = false;
    if (m.relatedEventSlot) {
      const origin = a[m.relatedEventSlot]?.trim();
      if (origin) {
        relatedEventId = origin;
      } else if (m.orphan) {
        reasonType = m.orphan.reasonType;
        reasonText = m.orphan.reasonText;
        requiresFollowup = true;
      }
    }

    // The override targets the object being varied (variant scenarios are single-object). Multiple
    // objects each get a distinct id derived from the source reference; a single object keeps it bare.
    const objectTemplates = m.objects.map((o, i) =>
      i === 0 ? { objectType: override.objectType ?? o.objectType, relation: override.relation ?? o.relation } : o,
    );
    // Continuity: when the scenario declares an object-id slot and the user asserted a position, the
    // event continues THAT object instead of starting a new one — which is what lets a single object
    // be originated, then partially settled, then closed. Absent or blank, the id is minted exactly
    // as before. Treasury never verifies the asserted id exists: like lineage, that is the Ledger's
    // business, and an unknown position is a legitimate state, not a reason to refuse the fact.
    const assertedObjectId = m.objectIdSlot ? a[m.objectIdSlot]?.trim() || undefined : undefined;
    const objects = objectTemplates.map((o) => ({
      objectId: assertedObjectId ?? (objectTemplates.length === 1 ? sourceReference : `${sourceReference}:${o.objectType}`),
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
      ...(relatedEventId ? { relatedEventId } : {}),
      parties,
      objects,
      reason: { type: reasonType, description: reasonText, confidence: "high", requiresFollowup },
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
    if (field === "relatedEventId") return m.relatedEventSlot;
    if (field === "amount" || field === "currency" || field === "occurredAt" || field === "description") return field;
    return undefined;
  }
}
