import type { Language } from "@/i18n/i18n";

const ptBR = {
  title: "Hoje: o caixa cobre o que vence?",
  note: (asOf: string) =>
    `Leitura de ${asOf}, independente do período abaixo. Os números são os do Ledger, lado a lado: o quadro não calcula sobra nem falta.`,
  knownCash: "Caixa conhecido",
  noKnown: "Desconhecido: nenhuma instituição tem saldo de abertura.",
  unknownBalance: "desconhecido",
  leftOut: (names: string[]) => `Fora do total, por não ter saldo de abertura: ${names.join(", ")}.`,
  noInstitution: (since: string | null, cashIn: string, cashOut: string, count: number) =>
    `Sem instituição informada${since ? ` desde ${since}` : ""}: entrou ${cashIn}, saiu ${cashOut} (${count === 1 ? "1 lançamento" : `${count} lançamentos`}). Não somado ao caixa.`,
  overdue: "Vencido",
  today: "Hoje",
  payables: "A pagar",
  receivables: "A receber",
  receivablesNote: "Esperado, não recebido: nunca somado ao caixa.",
  later: "Depois",
  undated: "Sem data",
  nothing: "—",
  openCash: "Caixa por instituição",
  openPayables: "Agenda a pagar",
  openReceivables: "Agenda a receber",
  unavailable: "Quadro indisponível: o Ledger não respondeu. Nada aqui quer dizer que não há caixa nem contas.",
};

const en: typeof ptBR = {
  title: "Today: does the cash cover what falls due?",
  note: (asOf: string) =>
    `Read for ${asOf}, whatever the period below. The figures are the Ledger's, side by side: the panel computes no surplus or shortfall.`,
  knownCash: "Known cash",
  noKnown: "Unknown: no institution has an opening balance.",
  unknownBalance: "unknown",
  leftOut: (names: string[]) => `Left out of the total, with no opening balance: ${names.join(", ")}.`,
  noInstitution: (since: string | null, cashIn: string, cashOut: string, count: number) =>
    `No institution stated${since ? ` since ${since}` : ""}: ${cashIn} in, ${cashOut} out (${count === 1 ? "1 entry" : `${count} entries`}). Not added to the cash.`,
  overdue: "Overdue",
  today: "Today",
  payables: "To pay",
  receivables: "To receive",
  receivablesNote: "Expected, not received: never added to the cash.",
  later: "Later",
  undated: "No date",
  nothing: "—",
  openCash: "Cash by institution",
  openPayables: "Payables agenda",
  openReceivables: "Receivables agenda",
  unavailable: "Panel unavailable: the Ledger did not answer. Nothing here means there is no cash nor bills.",
};

export const morningCopy: Record<Language, typeof ptBR> = { "pt-BR": ptBR, en };
