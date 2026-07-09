import type { Intent } from "../../domain/entities/Intent";
import type { Scenario } from "../../domain/scenarios/Scenario";
import type { Candidate } from "../../domain/value-objects/Candidate";

/**
 * PROVISIONAL per-scenario economic mapping. Structurally modeled on the Ledger's Advance flow
 * (AdvanceStagingJob.buildCandidate). The exact (eventType, economicEffect, role, direction,
 * relation, reason) tuples MUST be confirmed against the Ledger's FormalMatrices when the
 * integration contract is designed — the Ledger gate is the authority and will reject an invalid
 * one. treasury only proposes; it never validates economics.
 */
interface ScenarioMapping {
  eventType: string;
  economicEffect: string;
  usinaRole: string;
  usinaDirection: string;
  counterpartySlot: string;
  objectType: string;
  reasonType: string;
  reasonText: string;
}

const MAPPINGS: Record<string, ScenarioMapping> = {
  add_charge: {
    eventType: "charge_created",
    economicEffect: "cash_in",
    usinaRole: "payee",
    usinaDirection: "in",
    counterpartySlot: "counterparty",
    objectType: "charge",
    reasonType: "charge",
    reasonText: "Charge owed to the usina",
  },
  record_purchase: {
    eventType: "purchase_recorded",
    economicEffect: "cash_out",
    usinaRole: "payer",
    usinaDirection: "out",
    counterpartySlot: "supplier",
    objectType: "purchase",
    reasonType: "purchase",
    reasonText: "Purchase owed to a supplier",
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
        { partyId: a[m.counterpartySlot], role: m.usinaRole === "payer" ? "payee" : "payer", direction: "neutral" },
      ],
      objects: [{ objectId: sourceReference, objectType: m.objectType, relation: "originates" }],
      reason: { type: m.reasonType, description: m.reasonText, confidence: "high", requiresFollowup: false },
      reporter: { reporterType: "user", reporterId: intent.userId, channel: "web" },
    };
  }
}
