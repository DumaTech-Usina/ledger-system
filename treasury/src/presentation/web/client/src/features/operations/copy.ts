import type { IntentStatus } from "@/types/operations";

export const scenarioCopy: Record<string, { title: string; description: string }> = {
  register_payment: {
    title: "Registrar pagamento geral",
    description:
      "Registrar uma saída de caixa geral, não coberta por uma operação específica. Use uma operação específica quando existir (ex.: Folha de pagamento).",
  },
  register_payroll: {
    title: "Registrar folha de pagamento",
    description: "Registrar o pagamento da folha aos empregados (saída de caixa).",
  },
  register_infrastructure: {
    title: "Registrar despesa de infraestrutura",
    description: "Registrar um custo operacional/infraestrutura pago pela usina (saída de caixa).",
  },
  register_penalty: {
    title: "Registrar pagamento de multa",
    description: "Registrar uma multa ou penalidade paga pela usina (saída de caixa).",
  },
  register_obligation_recognition: {
    title: "Reconhecer obrigação a pagar",
    description:
      "Registrar algo que a usina passou a dever por um fato externo — nota emitida, folha fechada, imposto apurado — antes de pagar. Não move caixa. Serve também quando o pagamento já foi registrado e só depois se identificou o que o originou.",
  },
  register_incentive: {
    title: "Registrar pagamento de incentivo",
    description: "Registrar um incentivo ou bônus pago pela usina a um corretor ou parceiro (saída de caixa).",
  },
  register_advance: {
    title: "Registrar adiantamento",
    description:
      "Registrar um adiantamento pago pela usina a um corretor ou parceiro (saída de caixa; gera um valor a ser quitado depois).",
  },
  register_loan: {
    title: "Registrar empréstimo",
    description:
      "Registrar um empréstimo concedido pela usina a um corretor (saída de caixa; gera um valor a ser quitado depois).",
  },
  register_waiver: {
    title: "Registrar renúncia de comissão",
    description:
      "Registrar a renúncia de uma comissão devida a um corretor — a usina abre mão do valor (sem movimentação de caixa).",
  },
  register_commission_accrual: {
    title: "Registrar comissão prevista",
    description: "Registrar uma comissão que a usina espera receber, antes do caixa entrar (sem movimentação de caixa).",
  },
  register_direct_payment: {
    title: "Registrar pagamento direto ao corretor",
    description:
      "Registrar que a operadora pagou um corretor diretamente — a comissão a receber da usina é quitada sem movimentação de caixa.",
  },
  register_commission_received: {
    title: "Registrar comissão recebida",
    description: "Registrar uma comissão recebida pela usina (entrada de caixa), quitando uma comissão prevista.",
  },
  register_advance_settlement: {
    title: "Registrar recuperação de adiantamento",
    description:
      "Registrar a recuperação de um adiantamento pago pela usina (entrada de caixa), quitando o adiantamento original.",
  },
  register_loan_repayment: {
    title: "Registrar quitação de empréstimo",
    description:
      "Registrar a quitação de um empréstimo pelo corretor (entrada de caixa), quitando o empréstimo original.",
  },
  register_rectification: {
    title: "Retificar um lançamento",
    description:
      "Declarar que um lançamento já registrado nunca aconteceu — um erro de digitação confirmado contra a fonte. O valor correto, se houver, é registrado depois como um lançamento próprio.",
  },
};

export const scenarioSlotPrompts: Record<string, Record<string, string>> = {
  register_payment: {
    payee: "Para quem é o pagamento?",
    amount: "Qual é o valor do pagamento?",
    currency: "Qual é a moeda?",
    occurredAt: "Em que data o pagamento foi feito?",
    objectRef: "Qual obrigação reconhecida este pagamento quita? (opcional)",
    description: "Uma breve descrição (opcional).",
  },
  register_obligation_recognition: {
    kind: "Que tipo de obrigação é esta?",
    payee: "A quem a usina deve?",
    amount: "Qual é o valor devido?",
    currency: "Qual é a moeda?",
    occurredAt: "Em que data a obrigação foi estabelecida (emissão da nota, fechamento da folha)?",
    objectRef: "Esta obrigação já foi paga? Se sim, qual pagamento ela explica? (opcional)",
    description: "Uma breve descrição (opcional).",
  },
  register_payroll: {
    payee: "Quem está recebendo (empregado ou prestador da folha)?",
    amount: "Qual é o valor da folha?",
    currency: "Qual é a moeda?",
    occurredAt: "Em que data a folha foi paga?",
    objectRef: "Qual obrigação reconhecida este pagamento quita? (opcional)",
    description: "Uma breve descrição (opcional).",
  },
  register_infrastructure: {
    payee: "Para quem é o pagamento (fornecedor ou prestador)?",
    amount: "Qual é o valor?",
    currency: "Qual é a moeda?",
    occurredAt: "Em que data foi pago?",
    objectRef: "Qual obrigação reconhecida este pagamento quita? (opcional)",
    description: "Uma breve descrição (opcional).",
  },
  register_penalty: {
    payee: "Para quem é o pagamento (autoridade ou contraparte)?",
    amount: "Qual é o valor da multa?",
    currency: "Qual é a moeda?",
    occurredAt: "Em que data foi paga?",
    description: "Uma breve descrição (opcional).",
  },
  register_incentive: {
    payee: "Quem está recebendo o incentivo (corretor ou parceiro)?",
    amount: "Qual é o valor do incentivo?",
    currency: "Qual é a moeda?",
    occurredAt: "Em que data foi pago?",
    description: "Uma breve descrição (opcional).",
  },
  register_advance: {
    payee: "Quem está recebendo o adiantamento (corretor ou parceiro)?",
    amount: "Qual é o valor do adiantamento?",
    currency: "Qual é a moeda?",
    occurredAt: "Em que data o adiantamento foi pago?",
    description: "Uma breve descrição (opcional).",
  },
  register_loan: {
    payee: "Quem está recebendo o empréstimo (tomador)?",
    amount: "Qual é o valor do empréstimo?",
    currency: "Qual é a moeda?",
    occurredAt: "Em que data o empréstimo foi concedido?",
    description: "Uma breve descrição (opcional).",
  },
  register_waiver: {
    payee: "De quem é a comissão sendo renunciada (corretor ou parceiro)?",
    basis: "É uma renúncia padrão ou o estorno de uma comissão concedida por engano?",
    amount: "Qual é o valor renunciado?",
    currency: "Qual é a moeda?",
    occurredAt: "Em que data foi renunciada?",
    description: "Uma breve descrição (opcional).",
  },
  register_commission_accrual: {
    amount: "Qual é o valor da comissão prevista?",
    currency: "Qual é a moeda?",
    occurredAt: "A partir de que data ela é esperada?",
    description: "Uma breve descrição (opcional).",
  },
  register_direct_payment: {
    payee: "Qual corretor foi pago diretamente?",
    amount: "Qual é o valor da comissão quitada?",
    currency: "Qual é a moeda?",
    occurredAt: "Em que data o corretor foi pago?",
    description: "Uma breve descrição (opcional).",
  },
  register_commission_received: {
    payer: "Quem pagou a comissão (operadora ou contraparte)?",
    amount: "Qual é o valor da comissão recebida?",
    currency: "Qual é a moeda?",
    occurredAt: "Em que data foi recebida?",
    origin: "Qual comissão prevista está sendo quitada? (deixe em branco se não souber)",
    description: "Uma breve descrição (opcional).",
  },
  register_advance_settlement: {
    payer: "Quem está devolvendo o adiantamento (corretor ou parceiro)?",
    amount: "Qual foi o valor recuperado?",
    currency: "Qual é a moeda?",
    occurredAt: "Em que data foi recuperado?",
    origin: "Qual adiantamento está sendo quitado?",
    description: "Uma breve descrição (opcional).",
  },
  register_loan_repayment: {
    payer: "Quem está quitando o empréstimo (tomador)?",
    amount: "Qual foi o valor quitado?",
    currency: "Qual é a moeda?",
    occurredAt: "Em que data foi quitado?",
    origin: "Qual empréstimo está sendo quitado?",
    description: "Uma breve descrição (opcional).",
  },
  register_rectification: {
    target: "Qual lançamento nunca aconteceu?",
    // The remaining slots are derived from the corrected event, never asked directly — translated
    // all the same, since a recorded answer still shows this label back on the "Editar" form.
    objectRef: "A posição que o lançamento corrigido movimentou.",
    objectType: "O tipo de posição que o lançamento corrigido movimentou.",
    amount: "O valor que o lançamento corrigido registrava.",
    currency: "Qual é a moeda?",
    occurredAt: "Em que data o erro foi constatado?",
    description: "O que comprovou o erro (documento, conciliação)?",
    reissue: "Se um lançamento corrigido deve vir a seguir.",
  },
};

export const statusLabels: Record<IntentStatus, string> = {
  draft: "Rascunho",
  gathering: "Coletando informações",
  awaiting_confirmation: "Aguardando confirmação",
  confirmed: "Confirmado",
  submitted: "Enviado",
  awaiting_correction: "Aguardando correção",
  accepted: "Aceito",
  rejected: "Rejeitado",
};

export const eventLabels: Record<string, string> = {
  "intent.started": "Iniciado",
  "slot.answered": "Respondido",
  "slot.rejected": "Resposta inválida detectada",
  "identity.resolution": "Contraparte consultada",
  "identity.decision": "Contraparte definida",
  "intent.submitted": "Enviado ao Ledger",
  "intent.accepted": "Aceito",
  "intent.rejected": "Rejeitado",
};

/**
 * The counterparty conversation. A mention the Directory could not turn into exactly one known
 * party is never recorded by the backend, so the question comes back — these are what the chat says
 * instead of asking the same thing again in silence.
 */
export const identityCopy = {
  /**
   * Similarity hit: close, not equal. Confirming is the user's to do — never assumed. The backend's
   * `resolved` outcome publishes only the PartyId (no display name, unlike an ambiguous candidate),
   * so the id is what goes on screen — an unknown label is never invented to fill the gap.
   */
  confirm: (mention: string, partyId: string) =>
    `"${mention}" parece ser a contraparte ${partyId}. É essa mesma?`,
  ambiguous: (mention: string) =>
    `Mais de uma contraparte se parece com "${mention}". Qual delas?`,
  unknown: (mention: string) => `Ainda não conheço "${mention}". Quer cadastrar?`,
  create: (mention: string) => `Cadastrar "${mention}"`,
  unidentifiable: "Não é possível identificar",
  justificationLabel: "Por que a contraparte não pode ser identificada?",
  justificationConfirm: "Registrar assim",
  justificationCancel: "Voltar",
  /** Shown when the slot is open again: retyping is always a way out. */
  retype: "Ou escreva outro nome na caixa abaixo.",
  /**
   * Editing has no next question to fall back on. When a retyped counterparty doesn't resolve, the
   * backend records nothing — so the field says so, instead of the card failing without a reason.
   */
  unresolvedEdit: "Não reconheci essa contraparte. Escreva o nome como está cadastrado.",
};

/**
 * Choosing which position a settlement is about. The question replaces typing an event id with
 * recognising a business fact — "the advance of R$ 500 paid to Corretor Parceiro on 02/07" — and it
 * only ever appears when there is something real to choose from.
 */
export const positionCopy = {
  /** Opens a conversation the operator started from a position, naming what it is about. */
  opened: (label: string) => `Vamos registrar um novo fato sobre ${label}. Já sei o que a posição podia responder — falta o que só você sabe.`,
  prompt: "Escolha qual delas está sendo quitada:",
  /** Always present: the list is an offer, never a gate. Typing still works. */
  notListed: "Não está na lista",
  originatedOn: "Originado em",
  stillOpen: "Em aberto",
  unknownCounterparty: "Contraparte desconhecida",
  unknownDate: "Data de originação desconhecida",
  /** What goes into the transcript once a position is picked. */
  picked: (counterparty: string | null, amount: string) =>
    counterparty ? `${counterparty} — ${amount}` : amount,
};

/**
 * The one optional question the confirmation card may offer. It exists only after the fact is
 * already complete and can never hold a submission back — so it is phrased as an offer, never as a
 * pending item, and "prefiro não informar" is a first-class answer rather than a dismissal.
 */
export const enrichmentCopy = {
  question: (displayName: string, attribute: string) =>
    `Quer aproveitar e informar ${attributeLabels[attribute] ?? attribute} de ${displayName}?`,
  save: "Salvar",
  decline: "Prefiro não informar",
  saved: "Anotado.",
  declined: "Sem problema — não pergunto de novo.",
};

/** The attributes the conversation may ask for, and the Ledger's own party vocabulary for `type`. */
export const attributeLabels: Record<string, string> = {
  document: "o CPF/CNPJ",
  type: "o tipo",
};

export const partyTypeChoices = ["company", "client", "supplier", "bank", "gateway"] as const;

/**
 * What the Ledger's answer means for the conversation. A fixable rejection is not an ending: the
 * Ledger named what it could not accept, and the same intent can carry a corrected version.
 */
export const submitCopy = {
  correctionTitle: "O Ledger ainda não aceitou",
  correctionHint: "Ajuste o que está apontado abaixo e envie de novo.",
  correctionAction: "Corrigir",
  correctionSave: "Salvar e revisar",
  correctionCancel: "Cancelar",
};

export const partyTypeLabels: Record<string, string> = {
  company: "Empresa",
  client: "Cliente",
  supplier: "Fornecedor",
  bank: "Banco",
  gateway: "Gateway",
};

const messageTranslations: Record<string, string> = {
  "Enter a valid amount, e.g. 1500.00.": "Informe um valor válido, ex.: 1500.00.",
  "Amount must be greater than zero.": "O valor deve ser maior que zero.",
  "Enter a valid date.": "Informe uma data válida.",
  "Flagged for manual review (description contains 'test').":
    "Sinalizado para revisão manual (a descrição contém 'test').",
  "Duplicate: this intent was already submitted to the Ledger.":
    "Duplicado: esta intenção já foi enviada ao Ledger.",
};

/** Localizes a backend-generated message; falls back to the backend's own text when untranslated. */
export function translateMessage(message: string | undefined): string {
  if (!message) return "";
  if (messageTranslations[message]) return messageTranslations[message];
  if (/ is required\.$/.test(message)) return "Este campo é obrigatório.";
  const choose = message.match(/^Choose one of: (.+)\.$/);
  if (choose) return `Escolha uma das opções: ${choose[1]}.`;
  return message;
}
