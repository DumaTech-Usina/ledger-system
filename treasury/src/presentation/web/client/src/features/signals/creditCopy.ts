import type { Language } from "@/i18n/i18n";

const ptBR = {
  title: "Registrar crédito da seguradora",
  note: "Um crédito no banco que cobre várias apólices. Cada parte distribuída vira um recebimento da apólice; o que sobrar fica como recebido sem origem, pendente.",
  insurer: "Seguradora que pagou",
  chooseInsurer: "Escolha a seguradora",
  amount: "Valor do crédito no banco",
  date: "Data do crédito",
  institution: "Instituição em que entrou",
  chooseInstitution: "Escolha a instituição",
  notStated: "Não informada",
  receivablesTitle: "Comissões previstas em aberto desta seguradora",
  none: "Nenhuma comissão prevista em aberto com esta seguradora. Todo o crédito ficará sem origem.",
  policy: "Apólice",
  noPolicy: "Sem apólice",
  filter: "Filtrar por proposta ou apólice",
  showing: (shown: number, total: number) => `Mostrando ${shown} de ${total}. Use o filtro para encontrar as outras.`,
  open: "Em aberto",
  unknown: "desconhecido",
  receive: "Receber",
  all: "Tudo",
  distributed: "Distribuído",
  unattributed: "Sem origem (fica pendente)",
  over: "O distribuído passa do valor do crédito.",
  submit: "Registrar crédito",
  done: "Crédito registrado.",
  steps: {
    accepted: "registrado",
    rejected: "recusado",
    awaiting_correction: "precisa de correção",
    not_sent: "não enviado",
  } as Record<string, string>,
  stepUnattributed: "Sem origem",
  stopped: "Um recebimento foi recusado; os seguintes não foram enviados. O que foi registrado continua valendo.",
  genericError: "Não foi possível concluir agora. Tente novamente.",
  // REQ-695: the same card on the receivables agenda, for the payer already chosen there — an insurer
  // or a health operator, so the words name the payer instead of its kind.
  titleFor: (name: string) => `Registrar crédito de ${name}`,
  noteForPayer: "Um crédito no banco que cobre várias posições deste pagador. Cada parte distribuída vira o recebimento daquela posição; o que sobrar fica como recebido sem origem, pendente.",
  receivablesTitleFor: (name: string) => `O que ${name} tem em aberto com a Usina`,
  noneFor: (name: string) => `Nada em aberto com ${name}. Todo o crédito ficará sem origem.`,
};

const en: typeof ptBR = {
  title: "Record an insurer credit",
  note: "One bank credit covering several policies. Each part you distribute becomes that policy's receipt; what is left stays as received with no origin, pending.",
  insurer: "Insurer that paid",
  chooseInsurer: "Choose the insurer",
  amount: "Credit amount at the bank",
  date: "Credit date",
  institution: "Institution it came into",
  chooseInstitution: "Choose the institution",
  notStated: "Not stated",
  receivablesTitle: "Open expected commissions from this insurer",
  none: "No open expected commission with this insurer. The whole credit will have no origin.",
  policy: "Policy",
  noPolicy: "No policy",
  filter: "Filter by proposal or policy",
  showing: (shown: number, total: number) => `Showing ${shown} of ${total}. Use the filter to find the others.`,
  open: "Open",
  unknown: "unknown",
  receive: "Receive",
  all: "All",
  distributed: "Distributed",
  unattributed: "No origin (stays pending)",
  over: "The distributed amount exceeds the credit.",
  submit: "Record credit",
  done: "Credit recorded.",
  steps: { accepted: "recorded", rejected: "refused", awaiting_correction: "needs correction", not_sent: "not sent" },
  stepUnattributed: "No origin",
  stopped: "A receipt was refused; the following ones were not sent. What was recorded still stands.",
  genericError: "Could not complete right now. Try again.",
  titleFor: (name: string) => `Record a credit from ${name}`,
  noteForPayer: "One bank credit covering several positions of this payer. Each part you distribute becomes that position's receipt; what is left stays as received with no origin, pending.",
  receivablesTitleFor: (name: string) => `What ${name} has open with the Usina`,
  noneFor: (name: string) => `Nothing open with ${name}. The whole credit will have no origin.`,
};

export const creditCopy: Record<Language, typeof ptBR> = { "pt-BR": ptBR, en };

/**
 * §4.7 (REQ-292): the same credit from a health operator. Financially the same thing; only what each
 * part is tagged with changes — installments of proposals instead of policies.
 */
export const healthCreditCopy: Record<Language, typeof ptBR> = {
  "pt-BR": {
    ...ptBR,
    title: "Registrar crédito da operadora",
    note: "Um crédito no banco que cobre várias parcelas, de uma ou de várias propostas. Cada parte distribuída vira o recebimento daquela parcela; o que sobrar fica como recebido sem origem, pendente.",
    insurer: "Operadora que pagou",
    chooseInsurer: "Escolha a operadora",
    receivablesTitle: "Parcelas em aberto desta operadora",
    none: "Nenhuma parcela em aberto com esta operadora. Todo o crédito ficará sem origem.",
  },
  en: {
    ...en,
    title: "Record an operator credit",
    note: "One bank credit covering several installments, from one or several proposals. Each part you distribute becomes that installment's receipt; what is left stays as received with no origin, pending.",
    insurer: "Operator that paid",
    chooseInsurer: "Choose the operator",
    receivablesTitle: "Open installments from this operator",
    none: "No open installment with this operator. The whole credit will have no origin.",
  },
};

/** What an open expected commission is about, as the credit form shows it. */
export function receivableLabel(
  r: { objectId: string; policyId: string | null; installment?: { proposalNumber: string; number: number } | null },
  language: Language,
): string {
  if (r.installment) {
    return language === "pt-BR"
      ? `Proposta ${r.installment.proposalNumber} · parcela ${r.installment.number}`
      : `Proposal ${r.installment.proposalNumber} · installment ${r.installment.number}`;
  }
  if (r.policyId) return `${creditCopy[language].policy} ${r.policyId}`;
  return r.objectId;
}

/**
 * The same label from the position's id alone — for a step whose installment or policy is no longer
 * open, and so no longer in the list.
 */
export function labelFromPositionId(objectId: string, language: Language): string {
  const health = /^saude:proposta:(.+):parcela:(\d+):prevista$/.exec(objectId);
  if (health) return receivableLabel({ objectId, policyId: null, installment: { proposalNumber: health[1], number: Number(health[2]) } }, language);
  const policy = /^seguro:apolice:(.+):prevista$/.exec(objectId);
  return receivableLabel({ objectId, policyId: policy?.[1] ?? null }, language);
}

/** Installments grouped by proposal, in order; everything else keeps the Ledger's order after them. */
export function byProposal<T extends { installment?: { proposalNumber: string; number: number } | null }>(list: T[]): T[] {
  const health = list.filter((r) => r.installment);
  const rest = list.filter((r) => !r.installment);
  health.sort(
    (a, b) =>
      a.installment!.proposalNumber.localeCompare(b.installment!.proposalNumber, undefined, { numeric: true }) ||
      a.installment!.number - b.installment!.number,
  );
  return [...health, ...rest];
}
