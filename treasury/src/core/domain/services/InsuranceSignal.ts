import type { ProposedFactKind, SignalKind } from "../entities/ExternalSignal";
import { toBrDate, validateFields, type ContextCitation, type FactProposal, type FieldSpec } from "./SignalProposal";

/**
 * How the insurance system's screens become proposed facts (§4.6).
 *
 * Only what financial control needs is accepted (REQ-267): a field not listed here is refused rather
 * than kept, which is what stops the client's name or document from being copied in. The amounts are
 * the source's own figures; nothing here recomputes them (REQ-257). The calculation fields (premium,
 * CT, CR, CTU) stay in the signal as its base (REQ-260) and never reach the Ledger.
 *
 * The insurance system only produces expectations (REQ-262): a registered policy proposes the
 * expected commission, an eligibility proposes the commission obligation to the broker. Neither
 * proposes a receipt or a payment — those need evidence from the financial side.
 */

/** The two kinds of reading the insurance system's screens give. */
export type InsuranceSignalKind = Extract<SignalKind, "policy" | "eligibility">;

const BASE: FieldSpec[] = [
  { key: "policyId", format: "text", required: true },
  { key: "policyNumber", format: "text", required: false },
  { key: "insurer", format: "text", required: false },
  { key: "insurerId", format: "text", required: false },
  { key: "broker", format: "text", required: false },
  // REQ-267: the broker's id as the policy shows it. The name above is only for reading.
  { key: "brokerId", format: "text", required: false },
  { key: "product", format: "text", required: false },
  { key: "netPremium", format: "money", required: false },
  { key: "ct", format: "percent", required: false },
  { key: "ctu", format: "percent", required: false },
  { key: "usinaValue", format: "money", required: true },
];

export const SIGNAL_FIELDS: Record<InsuranceSignalKind, FieldSpec[]> = {
  policy: [
    ...BASE,
    { key: "registeredAt", format: "date", required: true },
    { key: "expectedAt", format: "date", required: false },
  ],
  eligibility: [
    ...BASE,
    { key: "cr", format: "percent", required: false },
    { key: "payout", format: "money", required: true },
    { key: "retained", format: "money", required: false },
    { key: "eligibleAt", format: "date", required: true },
    // REQ-272: when the expectation arose. The statement does not show it; the policy screen does.
    { key: "policyDate", format: "date", required: false },
    { key: "signedBy", format: "text", required: false },
  ],
};

export const isInsuranceSignalKind = (value: unknown): value is InsuranceSignalKind =>
  value === "policy" || value === "eligibility";

/** The insurance fields worth keeping, or the list of what is wrong (shared rule: `validateFields`). */
export function validateSignalFields(
  kind: InsuranceSignalKind,
  raw: Record<string, unknown>,
): { fields: Record<string, string>; errors: string[] } {
  return validateFields(SIGNAL_FIELDS[kind], raw);
}

/** The insurance system's name in references. */
export const INSURANCE_SYSTEM = "seguro";

/**
 * The external-id namespace of each registry in the insurance system. Brokers and insurers are
 * different registries there, so the same number can name one of each: an id is only meaningful
 * with the registry it came from, and is stored with it (REQ-267, REQ-273).
 */
export const INSURANCE_REGISTRY = {
  broker: `${INSURANCE_SYSTEM}:corretor`,
  insurer: `${INSURANCE_SYSTEM}:seguradora`,
} as const;

/** REQ-267: the policy as a context object in the Ledger. */
export const policyContext = (policyId: string): ContextCitation & { objectType: "contract" } => ({
  objectId: `${INSURANCE_SYSTEM}:apolice:${policyId}`,
  objectType: "contract",
});

const policyLabel = (fields: Record<string, string>): string => fields.policyNumber ?? fields.policyId;

/** REQ-265: system, policy and kind of fact — the same external record always yields the same one. */
export const sourceReferenceFor = (policyId: string, fact: ProposedFactKind): string =>
  `${policyContext(policyId).objectId}:${fact === "commission_expected" ? "prevista" : "elegibilidade"}`;

/**
 * The expected commission, from either screen (REQ-262, REQ-272). Same source reference from both, so
 * the second reading points at the first proposal instead of making another. `arose` is when the
 * expectation arose; absent, the conversation asks — the eligibility date is never used for it.
 */
function expectedCommission(fields: Record<string, string>, arose: string | undefined, dueAt?: string): FactProposal {
  return {
    fact: "commission_expected",
    scenarioId: "register_commission_accrual",
    sourceReference: sourceReferenceFor(fields.policyId, "commission_expected"),
    answers: [
      { key: "amount", value: fields.usinaValue },
      ...(arose ? [{ key: "occurredAt", value: arose }] : []),
      ...(dueAt ? [{ key: "dueAt", value: dueAt }] : []),
      { key: "description", value: `Comissão da apólice ${policyLabel(fields)}` },
    ],
    contexts: [policyContext(fields.policyId)],
    // REQ-273: the insurer is who is expected to pay, found by its id like the broker.
    party: {
      slot: "payer",
      registry: INSURANCE_REGISTRY.insurer,
      externalId: fields.insurerId,
      seenAs: fields.insurer,
      label: "Seguradora",
    },
  };
}

/** One proposal per happening the signal reports (REQ-261, REQ-262). Fields must be validated first. */
export function proposalsFor(kind: InsuranceSignalKind, fields: Record<string, string>): FactProposal[] {
  if (kind === "policy") return [expectedCommission(fields, fields.registeredAt, fields.expectedAt)];
  return [
    {
      fact: "commission_obligation",
      scenarioId: "register_obligation_recognition",
      sourceReference: sourceReferenceFor(fields.policyId, "commission_obligation"),
      answers: [
        { key: "kind", value: "commission" },
        { key: "amount", value: fields.payout },
        { key: "occurredAt", value: fields.eligibleAt },
        {
          key: "description",
          value: `Repasse da apólice ${policyLabel(fields)} (elegível em ${toBrDate(fields.eligibleAt)})`,
        },
      ],
      contexts: [policyContext(fields.policyId)],
      party: {
        slot: "payee",
        registry: INSURANCE_REGISTRY.broker,
        externalId: fields.brokerId,
        seenAs: fields.broker,
        label: "Corretor",
      },
    },
    // REQ-272: the statement also shows what the usina expects from the insurer.
    expectedCommission(fields, fields.policyDate),
  ];
}
