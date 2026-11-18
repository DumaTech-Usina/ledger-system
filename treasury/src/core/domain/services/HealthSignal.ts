import {
  isZeroAmount,
  toBrDate,
  validateFields,
  type ContextCitation,
  type FactProposal,
  type FieldSpec,
} from "./SignalProposal";

/**
 * How the health system's installment screen becomes proposed facts (§4.7).
 *
 * The unit is the installment (REQ-282): one reading says that installment N of proposal P was
 * discharged ("baixada") for the usina, with what the broker and the supervisor are to get. The
 * discharged amount is what the health system declares the operator paid — never a receipt: only the
 * bank shows that (REQ-263). The nominal value, the tax rate and the percentages are the calculation's
 * base and stay in the signal (DEC-020, REQ-290).
 *
 * Only expectations and obligations are proposed (REQ-283): the operator's expected commission, the
 * broker's obligation and the supervisor's. No installment is proposed before it is communicated
 * (REQ-284), whatever the commission table says (REQ-287).
 */

export const HEALTH_SYSTEM = "saude";

/** The installment fields the user copies from the health system's screen, in its order. */
export const HEALTH_FIELDS: FieldSpec[] = [
  { key: "proposalNumber", format: "text", required: true },
  { key: "installment", format: "count", required: true },
  { key: "operator", format: "text", required: false },
  { key: "operatorId", format: "text", required: false },
  { key: "nominalValue", format: "money", required: false },
  // REQ-282: discharged for the usina, as the health system declares it. Not yet seen in the bank.
  { key: "usinaValue", format: "money", required: true },
  // REQ-285: what the operator should have paid. The health system does not tell it yet; absent is unknown.
  { key: "owedValue", format: "money", required: false },
  { key: "broker", format: "text", required: false },
  { key: "brokerId", format: "text", required: false },
  { key: "brokerValue", format: "money", required: true },
  { key: "supervisor", format: "text", required: false },
  { key: "supervisorId", format: "text", required: false },
  { key: "supervisorValue", format: "money", required: false },
  // REQ-290: the tax rate shown at discharge. A base, never an event.
  { key: "taxRate", format: "percent", required: false },
  { key: "dischargedAt", format: "date", required: true },
  { key: "dueAt", format: "date", required: false },
];

/**
 * The external-id namespace of each registry in the health system. Operators, brokers and supervisors
 * are separate registries there, so a number only means something with the registry it came from
 * (REQ-288, as REQ-267 for insurance).
 */
export const HEALTH_REGISTRY = {
  operator: `${HEALTH_SYSTEM}:operadora`,
  broker: `${HEALTH_SYSTEM}:corretor`,
  supervisor: `${HEALTH_SYSTEM}:supervisor`,
} as const;

/** The checked fields, or what is wrong. Same rule for the form and a future integration (REQ-281). */
export function validateHealthFields(raw: Record<string, unknown>): { fields: Record<string, string>; errors: string[] } {
  const { fields, errors } = validateFields(HEALTH_FIELDS, raw);
  if (fields.installment !== undefined && Number(fields.installment) === 0) {
    // Q-057: installment zero exists in the data, but nobody knows yet what it means.
    errors.push("installment: a parcela zero ainda não é registrada (Q-057)");
  }
  if (isZeroAmount(fields.usinaValue)) errors.push("usinaValue: o valor baixado deve ser maior que zero");
  if (isZeroAmount(fields.owedValue)) errors.push("owedValue: o valor devido, quando informado, deve ser maior que zero");
  return { fields, errors };
}

/** The installment's id in the signal store: one record per installment of a proposal. */
export const installmentRecordId = (fields: Record<string, string>): string =>
  `${fields.proposalNumber}:${Number(fields.installment)}`;

/** REQ-283: the proposal and the installment, as contexts the fact cites. */
export function installmentContexts(proposalNumber: string, installment: string | number): ContextCitation[] {
  const proposal = `${HEALTH_SYSTEM}:proposta:${proposalNumber}`;
  return [
    { objectId: proposal, objectType: "proposal" },
    { objectId: `${proposal}:parcela:${Number(installment)}`, objectType: "installment" },
  ];
}

const SUFFIX = {
  commission_expected: "prevista",
  commission_obligation: "corretor",
  supervisor_obligation: "supervisor",
} as const;

/** REQ-283, REQ-265: one reference per installment and fact — the same installment always yields the same one. */
export const healthSourceReference = (
  proposalNumber: string,
  installment: string | number,
  fact: keyof typeof SUFFIX,
): string => `${installmentContexts(proposalNumber, installment)[1].objectId}:${SUFFIX[fact]}`;

/** The expected commission's position: what the agenda's "declared" list compares against (REQ-663). */
export const HEALTH_EXPECTED_POSITION = /^saude:proposta:(.+):parcela:(\d+):prevista$/;

const label = (f: Record<string, string>): string => `parcela ${Number(f.installment)} da proposta ${f.proposalNumber}`;

/**
 * An obligation to one party. A zero from the source is a hint, not a decision (REQ-286): the amount is
 * left for the user, who either fills it or declares there is no obligation.
 */
function obligation(
  fields: Record<string, string>,
  fact: "commission_obligation" | "supervisor_obligation",
  amount: string | undefined,
  party: { registry: string; externalId?: string; seenAs?: string; label: string },
): FactProposal {
  const zero = isZeroAmount(amount);
  return {
    fact,
    scenarioId: "register_obligation_recognition",
    sourceReference: healthSourceReference(fields.proposalNumber, fields.installment, fact),
    answers: [
      { key: "kind", value: "commission" },
      ...(amount !== undefined && !zero ? [{ key: "amount", value: amount }] : []),
      { key: "occurredAt", value: fields.dischargedAt },
      {
        key: "description",
        value: `${fact === "commission_obligation" ? "Repasse ao corretor" : "Repasse ao supervisor"} da ${label(fields)} (baixada em ${toBrDate(fields.dischargedAt)})`,
      },
    ],
    contexts: installmentContexts(fields.proposalNumber, fields.installment),
    party: { slot: "payee", ...party },
    ...(zero ? { suggestion: "no_obligation" as const } : {}),
  };
}

/** One proposal per happening the reading reports (REQ-283). Fields must be validated first. */
export function healthProposalsFor(fields: Record<string, string>): FactProposal[] {
  const proposals: FactProposal[] = [
    {
      fact: "commission_expected",
      scenarioId: "register_commission_accrual",
      sourceReference: healthSourceReference(fields.proposalNumber, fields.installment, "commission_expected"),
      answers: [
        // REQ-285: the owed amount once the health system tells it; until then, the declared discharge.
        { key: "amount", value: fields.owedValue ?? fields.usinaValue },
        // The discharge is the external fact that created the expectation.
        { key: "occurredAt", value: fields.dischargedAt },
        ...(fields.dueAt ? [{ key: "dueAt", value: fields.dueAt }] : []),
        { key: "description", value: `Comissão da ${label(fields)}` },
      ],
      contexts: installmentContexts(fields.proposalNumber, fields.installment),
      party: {
        slot: "payer",
        registry: HEALTH_REGISTRY.operator,
        externalId: fields.operatorId,
        seenAs: fields.operator,
        label: "Operadora",
      },
    },
    obligation(fields, "commission_obligation", fields.brokerValue, {
      registry: HEALTH_REGISTRY.broker,
      externalId: fields.brokerId,
      seenAs: fields.broker,
      label: "Corretor",
    }),
  ];
  // The supervisor is proposed only when the reading names one, or says what one gets.
  if (fields.supervisorValue !== undefined || fields.supervisorId !== undefined || fields.supervisor !== undefined) {
    proposals.push(
      obligation(fields, "supervisor_obligation", fields.supervisorValue, {
        registry: HEALTH_REGISTRY.supervisor,
        externalId: fields.supervisorId,
        seenAs: fields.supervisor,
        label: "Supervisor",
      }),
    );
  }
  return proposals;
}
