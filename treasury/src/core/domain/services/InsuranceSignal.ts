import type { ProposedFactKind, SignalKind } from "../entities/ExternalSignal";

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

type FieldFormat = "text" | "money" | "date" | "percent";

interface FieldSpec {
  key: string;
  format: FieldFormat;
  required: boolean;
}

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

export const SIGNAL_FIELDS: Record<SignalKind, FieldSpec[]> = {
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

const FORMAT: Record<FieldFormat, RegExp> = {
  text: /\S/,
  money: /^\d+(\.\d{1,2})?$/,
  date: /^\d{4}-\d{2}-\d{2}$/,
  percent: /^\d+(\.\d+)?$/,
};

const FORMAT_HINT: Record<FieldFormat, string> = {
  text: "não pode ficar em branco",
  money: "deve ser um valor como 77.26",
  date: "deve ser uma data como 2026-10-21",
  percent: "deve ser um número como 60",
};

export const isSignalKind = (value: unknown): value is SignalKind => value === "policy" || value === "eligibility";

/**
 * The fields worth keeping, trimmed and without blanks, or the list of what is wrong. An unknown
 * field is an error, never silently dropped: the user should know it was not kept.
 */
export function validateSignalFields(
  kind: SignalKind,
  raw: Record<string, unknown>,
): { fields: Record<string, string>; errors: string[] } {
  const specs = SIGNAL_FIELDS[kind];
  const errors: string[] = [];
  const fields: Record<string, string> = {};

  for (const key of Object.keys(raw)) {
    if (!specs.some((s) => s.key === key)) errors.push(`${key}: não é guardado no sinal`);
  }
  for (const spec of specs) {
    const value = raw[spec.key];
    const text = typeof value === "string" ? value.trim() : value === undefined || value === null ? "" : String(value);
    if (text === "") {
      if (spec.required) errors.push(`${spec.key}: obrigatório`);
      continue;
    }
    if (!FORMAT[spec.format].test(text)) {
      errors.push(`${spec.key}: ${FORMAT_HINT[spec.format]}`);
      continue;
    }
    fields[spec.key] = text;
  }
  return { fields, errors };
}

export interface FactProposal {
  fact: ProposedFactKind;
  scenarioId: string;
  sourceReference: string;
  answers: { key: string; value: string }[];
  /** The policy the fact is about (REQ-267). */
  context: { objectId: string; objectType: "contract" };
  /** Whose party the fact needs, by the source's id, and which answer it fills. */
  party?: { slot: string; registry: string; externalId?: string; seenAs?: string; label: string };
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
export const policyContext = (policyId: string): { objectId: string; objectType: "contract" } => ({
  objectId: `${INSURANCE_SYSTEM}:apolice:${policyId}`,
  objectType: "contract",
});

const policyLabel = (fields: Record<string, string>): string => fields.policyNumber ?? fields.policyId;

const toBrDate = (iso: string): string => iso.split("-").reverse().join("/");

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
    context: policyContext(fields.policyId),
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
export function proposalsFor(kind: SignalKind, fields: Record<string, string>): FactProposal[] {
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
      context: policyContext(fields.policyId),
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
