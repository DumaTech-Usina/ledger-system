import type { DocumentType, IntentStatus } from "@/types/operations";

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
};

export const documentTypeLabels: Record<DocumentType, string> = {
  pix_receipt: "Comprovante de PIX",
  ted_receipt: "Comprovante de TED",
  doc_receipt: "Comprovante de DOC",
  boleto: "Boleto",
  invoice: "Nota fiscal",
  bank_statement: "Extrato bancário",
  receipt: "Recibo",
  generic: "Documento",
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
