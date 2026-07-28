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
};

export const scenarioSlotPrompts: Record<string, Record<string, string>> = {
  register_payment: {
    payee: "Para quem é o pagamento?",
    amount: "Qual é o valor do pagamento?",
    currency: "Qual é a moeda?",
    occurredAt: "Em que data o pagamento foi feito?",
    description: "Uma breve descrição (opcional).",
  },
  register_payroll: {
    payee: "Quem está recebendo (empregado ou prestador da folha)?",
    amount: "Qual é o valor da folha?",
    currency: "Qual é a moeda?",
    occurredAt: "Em que data a folha foi paga?",
    description: "Uma breve descrição (opcional).",
  },
  register_infrastructure: {
    payee: "Para quem é o pagamento (fornecedor ou prestador)?",
    amount: "Qual é o valor?",
    currency: "Qual é a moeda?",
    occurredAt: "Em que data foi pago?",
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
};

export const statusLabels: Record<IntentStatus, string> = {
  draft: "Rascunho",
  gathering: "Coletando informações",
  awaiting_confirmation: "Aguardando confirmação",
  confirmed: "Confirmado",
  submitted: "Enviado",
  accepted: "Aceito",
  rejected: "Rejeitado",
};

export const eventLabels: Record<string, string> = {
  "intent.started": "Iniciado",
  "slot.answered": "Respondido",
  "slot.rejected": "Resposta inválida detectada",
  "intent.submitted": "Enviado ao Ledger",
  "intent.accepted": "Aceito",
  "intent.rejected": "Rejeitado",
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
