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
  /**
   * Which positions the continuity slot should offer. `open` (the default) offers what a settlement
   * could still move. `unoriginated` offers the opposite shape — positions already settled that
   * nothing ever originated — which is what a recognition arriving after the payment points at.
   */
  continuityMode?: "open" | "unoriginated";
  /**
   * When the continuity slot IS filled, the fact is being recorded about something already on the
   * book, so its cause is not the plain one: the knowledge arrived late. Swaps the reason the same
   * way `orphan` does for a missing lineage. Absent ⇒ the reason never varies with continuity.
   */
  retroactive?: { reasonType: string; reasonText: string };
  /**
   * Answer key whose presence marks the emitted event as awaiting a follow-up fact
   * (`reason.requiresFollowup`). Used by a correction that intends to reissue: the retraction says,
   * in the Ledger's own vocabulary, that it is not the end of the story. A retraction that stands
   * alone — the only thing treasury can do for an entry it cannot reissue — leaves it false.
   */
  followupSlot?: string;
  /**
   * Whether the counterparty is NECESSARILY the same party the position was opened with, so an
   * action started from that position can carry it over instead of asking again.
   *
   * Absent (the default) means ASK. Inheriting by default would be wrong and quietly so: a
   * commission is received from an operator and then split — to a partner, to several people, to
   * pay a fee. Those are different events with different counterparties, and carrying the operator
   * across would produce a record that is valid and false.
   *
   * True only where the identity follows from the economics: a settlement of an advance is paid by
   * whoever received it.
   */
  inheritsCounterparty?: boolean;
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

/**
 * The NON_CASH obligation mold: nobody moves money, so no leg carries a direction or an amount —
 * the Ledger rejects a non-cash event whose parties sum to anything. The pair still names who owes
 * and who is owed, which is the whole point of recognizing the obligation.
 */
const obligationParties: PartyTemplate[] = [
  { who: "usina", role: "payer", direction: "neutral" },
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
    objectIdSlot: "objectRef",
  },
  register_payroll: {
    eventType: "payroll_payment",
    economicEffect: "cash_out",
    counterpartySlot: "payee",
    parties: cashOutParties,
    objects: [{ objectType: "payroll", relation: "settles" }],
    reasonType: "payroll_payment",
    reasonText: "Payroll payment",
    // Since OBLIGATION_RECOGNIZED, a payroll CAN have been recognized before it was paid, so the
    // payment may legitimately close an existing obligation instead of minting a fresh position.
    objectIdSlot: "objectRef",
    // Paying a recognized payroll goes to whoever the obligation is owed to — the same party the
    // recognition named. Asking again would invite a typo into a fact the book already holds.
    inheritsCounterparty: true,
  },
  register_infrastructure: {
    eventType: "infrastructure_expense",
    economicEffect: "cash_out",
    counterpartySlot: "payee",
    parties: cashOutParties,
    objects: [{ objectType: "infrastructure_cost", relation: "settles" }],
    reasonType: "infrastructure_expense",
    reasonText: "Infrastructure expense",
    objectIdSlot: "objectRef",
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
    // The party settling an advance or a loan is the one that received it.
    inheritsCounterparty: true,
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
    followupSlot: "reissue",
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
    // The party settling an advance or a loan is the one that received it.
    inheritsCounterparty: true,
  },

  /**
   * Recognizing an obligation ORIGINATES the position a later payment settles. NON_CASH: nothing
   * moves, so no party carries a direction or an amount.
   *
   * Serves both orders of arrival from one mapping. Leave `objectRef` empty and a new position is
   * minted — recognize now, pay later. Fill it with the position of a payment already recorded and
   * the recognition originates THAT one, which is the reverse order: the payment came first and
   * what established it was only identified afterwards. `retroactive` is what makes the candidate
   * say so, instead of presenting late knowledge as ordinary knowledge.
   *
   * No `relatedEventSlot`: a recognition is not caused by the payment it explains. Pointing its
   * lineage at the payment would assert a causality that runs backwards. The two facts meet on the
   * position, which is exactly what objectId is for.
   */
  register_obligation_recognition: {
    eventType: "obligation_recognized",
    economicEffect: "non_cash",
    counterpartySlot: "payee",
    parties: obligationParties,
    objects: [{ objectType: "payable", relation: "originates" }],
    reasonType: "obligation_recognition",
    reasonText: "Obligation established by an external fact",
    // The kind of obligation is the object, not the event type — the economics are identical.
    variants: {
      selectorSlot: "kind",
      byChoice: {
        payroll: { objectType: "payroll" },
        service: { objectType: "service_fee" },
        infrastructure: { objectType: "infrastructure_cost" },
        tax: { objectType: "tax" },
        other: { objectType: "payable" },
      },
    },
    objectIdSlot: "objectRef",
    continuityMode: "unoriginated",
    retroactive: {
      reasonType: "late_awareness",
      reasonText: "Obligation identified after the payment was already recorded",
    },
  },
};

/**
 * The marker appended to a candidate's reason description when a counterparty could not be
 * identified. Stable and greppable on purpose: it is the only signal that crosses the boundary, so
 * a reader of the book can tell an unknown counterparty from a known one.
 */
export const UNIDENTIFIED_COUNTERPARTY = "counterparty not identified";

/**
 * The kind of position a scenario can continue, or undefined when it cannot continue any.
 *
 * Read from the mapping rather than inferred from `relation === "settles"`: the mapper is the sole
 * authority over the tuple, and declaring admissibility explicitly is what keeps the capability from
 * leaking into the cash expenses that settle positions nobody ever originated (payroll, penalties,
 * infrastructure). Offering continuity there would ask a question with no possible answer.
 *
 * Multi-object mappings are excluded on purpose: their ids are minted one per object, and selecting
 * a single position could only speak for one of them.
 */
export function continuityObjectType(
  scenarioId: string,
  answers: Record<string, string> = {},
): string | undefined {
  const mapping = MAPPINGS[scenarioId];
  if (!mapping?.objectIdSlot || mapping.objects.length !== 1) return undefined;

  // The branch decides the object, so it decides the question too. Reading the base template here
  // would ask about a kind of position this scenario is not going to originate: a payroll
  // recognition would list payables, and the paid payroll being pointed at would never appear.
  if (!mapping.variants) return mapping.objects[0].objectType;

  const choice = answers[mapping.variants.selectorSlot];
  const override = choice === undefined ? undefined : mapping.variants.byChoice[choice];
  // Branch not chosen yet: there is no single kind to ask about, and guessing one would offer the
  // wrong list. Nothing is offered until the answer that settles it exists.
  return override?.objectType ?? (override ? mapping.objects[0].objectType : undefined);
}

/** The answer key a scenario carries its continuity assertion in. */
export function continuitySlot(scenarioId: string): string | undefined {
  return MAPPINGS[scenarioId]?.objectIdSlot;
}

/**
 * Which shape of position the scenario's continuity question is about. A settlement asks about
 * positions still open; a recognition asks about the opposite — positions already settled that
 * nothing ever originated, which is what it would be supplying the origination for.
 */
export function continuityMode(scenarioId: string): "open" | "unoriginated" {
  return MAPPINGS[scenarioId]?.continuityMode ?? "open";
}

/** The answer key a scenario carries its lineage assertion in. */
export function lineageSlot(scenarioId: string): string | undefined {
  return MAPPINGS[scenarioId]?.relatedEventSlot;
}

/** The answer key a scenario carries its counterparty in, and whether it may be carried over. */
export function counterpartySlot(scenarioId: string): string | undefined {
  return MAPPINGS[scenarioId]?.counterpartySlot;
}

export function inheritsCounterparty(scenarioId: string): boolean {
  return MAPPINGS[scenarioId]?.inheritsCounterparty === true;
}

/** The CHOICE key a scenario branches on, when it has variants. */
export function variantSlot(scenarioId: string): string | undefined {
  return MAPPINGS[scenarioId]?.variants?.selectorSlot;
}

/** One tuple treasury knows how to produce, as a scenario would emit it. */
export interface ProducibleTuple {
  scenarioId: string;
  eventType: string;
  objectType: string;
  relation: string;
  /** The choice that selects this branch, when the scenario has variants. */
  variantChoice?: string;
  /**
   * True when recording this ALSO touches a position other than the one named here — the scenario
   * emits more than one object, each getting its own id. A commission split settles the pool and
   * opens what the usina now owes a partner; the interface has to say so rather than presenting it
   * as evolving the position the operator started from.
   *
   * The Ledger's contracts cannot answer this: they list the object types an event MAY name without
   * saying whether they are alternatives or companions. The mapping knows, because it is the thing
   * that decides how many objects to emit.
   */
  touchesOtherPositions: boolean;
}

/**
 * Everything treasury can currently record, enumerated one tuple at a time.
 *
 * The Ledger's algebra says what is LEGAL; this says what treasury can actually produce, which is a
 * subset and always will be. Crossing the two is how the interface offers actions without anyone
 * writing a list of them — the list is the intersection, computed, and it changes on its own when
 * either side changes.
 *
 * Variants are expanded rather than collapsed: a scenario that branches into a payroll and a tax
 * obligation offers two different things to two different positions, and folding them into one
 * entry would lose exactly the distinction the offer is made of.
 */
export function producibleTuples(): ProducibleTuple[] {
  const tuples: ProducibleTuple[] = [];

  for (const [scenarioId, m] of Object.entries(MAPPINGS)) {
    const branches: { choice?: string; override: TupleOverride }[] = m.variants
      ? Object.entries(m.variants.byChoice).map(([choice, override]) => ({ choice, override }))
      : [{ override: {} }];

    for (const { choice, override } of branches) {
      // The override targets the object being varied; variant scenarios are single-object by
      // construction, so the rest are carried through untouched.
      m.objects.forEach((object, index) => {
        const objectType = index === 0 ? override.objectType ?? object.objectType : object.objectType;
        const relation = index === 0 ? override.relation ?? object.relation : object.relation;
        tuples.push({
          scenarioId,
          eventType: m.eventType,
          objectType,
          relation,
          touchesOtherPositions: m.objects.length > 1,
          ...(choice ? { variantChoice: choice } : {}),
        });
      });
    }
  }

  return tuples;
}

/** What it takes to record the corrected entry again, or why treasury cannot. */
export type ReissuePlan =
  | { reissuable: true; scenarioId: string; answers: { key: string; value: string }[] }
  | { reissuable: false; reason: "no_scenario" | "ambiguous_variant" | "is_a_correction" };

/**
 * Rebuilds the answers that would produce a recorded entry again — the inverse of `build`.
 *
 * Read from the Ledger's own record of the entry, never from the intent that produced it: intents
 * do not survive a restart and, more importantly, an intent says what someone meant while the event
 * says what was written. A correction has to be about what was written.
 *
 * Only the fields the correction may change are left to the caller (D5/D10: amount, date,
 * description). Everything else is carried over exactly, which is what keeps a reissue from
 * silently becoming a different fact — the counterparty above all, since changing who took part
 * changes which fact it is.
 */
export function planReissue(
  event: {
    eventType: string;
    economicEffect: string;
    amount: string;
    currency: string;
    occurredAt: string;
    description: string | null;
    relatedEventId: string | null;
    objects: { objectId: string; objectType: string; relation: string }[];
    parties: { partyId: string; role: string; direction: string; amount: string | null }[];
  },
  usinaPartyId: string,
): ReissuePlan {
  const entry = Object.entries(MAPPINGS).find(([, m]) => m.eventType === event.eventType);
  if (!entry) return { reissuable: false, reason: "no_scenario" };
  const [scenarioId, m] = entry;

  // A correction of a correction is not a thing: the Ledger caps retraction depth, and "reissue the
  // retraction" has no meaning — what would be reissued is the entry underneath it.
  if (m.objects.some((o) => o.relation === "retracts")) {
    return { reissuable: false, reason: "is_a_correction" };
  }

  const moved = event.objects.find((o) => o.relation !== "references");
  const answers: { key: string; value: string }[] = [
    { key: "amount", value: event.amount },
    { key: "currency", value: event.currency },
    { key: "occurredAt", value: event.occurredAt },
  ];

  if (event.description) answers.push({ key: "description", value: event.description });

  // The variant is recovered by asking which choice would have produced this object. A choice that
  // no override distinguishes — or several that do — means treasury cannot tell which branch was
  // taken, and guessing would reissue a different tuple than the one being corrected.
  if (m.variants) {
    const matching = Object.entries(m.variants.byChoice).filter(([, override]) =>
      (override.objectType === undefined || override.objectType === moved?.objectType) &&
      (override.relation === undefined || override.relation === moved?.relation) &&
      (override.economicEffect === undefined || override.economicEffect === event.economicEffect),
    );
    if (matching.length !== 1) return { reissuable: false, reason: "ambiguous_variant" };
    answers.push({ key: m.variants.selectorSlot, value: matching[0][0] });
  }

  if (m.counterpartySlot) {
    const counterparty = event.parties.find((p) => p.partyId !== usinaPartyId);
    if (counterparty) answers.push({ key: m.counterpartySlot, value: counterparty.partyId });
  }
  if (m.objectIdSlot && moved) {
    answers.push({ key: m.objectIdSlot, value: moved.objectId });
  }
  if (m.relatedEventSlot && event.relatedEventId) {
    answers.push({ key: m.relatedEventSlot, value: event.relatedEventId });
  }

  return { reissuable: true, scenarioId, answers };
}

export class CandidateMapper {
  constructor(private readonly usinaPartyId: string) {}

  /**
   * @param unidentifiedParties party ids the Directory holds as explicitly not identifiable. The
   *   candidate cannot say so in `reason.type` — the Ledger's ReasonType has no value for an
   *   unknown counterparty, and inventing one would mean changing the Ledger. So the gap is carried
   *   the only two ways the frozen contract allows: the follow-up flag and the reason's description.
   */
  build(
    intent: Intent,
    _scenario: Scenario,
    unidentifiedParties: ReadonlySet<string> = new Set(),
  ): Candidate {
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

    // Continuity that points at something already on the book means this fact is being recorded
    // after the one it explains. That is a different cause, and the candidate says so rather than
    // presenting late knowledge as ordinary knowledge. Applied before the unidentified-counterparty
    // note below, which appends to whichever reason text ends up standing.
    if (assertedObjectId && m.retroactive) {
      reasonType = m.retroactive.reasonType;
      reasonText = m.retroactive.reasonText;
    }

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

    // An unidentified counterparty is a gap in what is KNOWN, and the book must show it rather than
    // let it pass as an ordinary party. `reason.type` is deliberately left alone: it names the
    // event's cause, and overwriting it with unknown_origin would assert an unresolved LINEAGE,
    // which is a different fact and may be false — the origin can be perfectly well known. What is
    // true, and what is recorded, is that something here is still pending and what that something is.
    if (parties.some((party) => unidentifiedParties.has(party.partyId))) {
      requiresFollowup = true;
      reasonText = `${reasonText} · ${UNIDENTIFIED_COUNTERPARTY}`;
    }

    // A correction that intends to reissue says so on the retraction itself, in the Ledger's own
    // vocabulary. Nothing is stored to be flipped later: the pending state is derived by asking
    // whether a standing fact has since landed on the position (see `pendingReissue`).
    if (m.followupSlot && (a[m.followupSlot]?.trim() ?? "") !== "") {
      requiresFollowup = true;
    }

    return {
      sourceReference,
      eventType: m.eventType,
      economicEffect,
      occurredAt: new Date(a.occurredAt).toISOString(),
      // Only sent when the scenario collected one and the user filled it in. Omitted rather than
      // sent as null so a scenario that never asks cannot accidentally assert "no due date stated"
      // — and the Ledger's invariant refuses it outright on any tuple that cannot carry one.
      ...(a.dueAt?.trim() ? { dueAt: new Date(a.dueAt).toISOString() } : {}),
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
