import type { Language } from "@/i18n/i18n";
import type { AgendaWindow } from "@/features/agenda/agendaApi";

const ptBR = {
  nav: "Agenda a pagar",
  heading: "Agenda a pagar",
  subheading: (asOf: string) =>
    `Tudo o que a Usina deve e ainda está em aberto, pelo vencimento, em ${asOf}. Os totais são os do Ledger.`,
  windows: {
    overdue: "Vencido",
    today: "Vence hoje",
    next: (days: number) => `Próximos ${days} dias`,
    later: "Depois",
    undated: "Sem vencimento",
  } as Record<AgendaWindow, string | ((days: number) => string)>,
  windowHint: {
    overdue: "Vencimento antes de hoje.",
    today: "Vencimento hoje.",
    next: "De amanhã em diante, dentro da janela.",
    later: "Vencimento depois da janela.",
    undated: "Nenhum vencimento conhecido. Não é atraso: é um prazo que ninguém informou. Repasses a corretor ficam aqui.",
  } as Record<AgendaWindow, string>,
  items: (n: number) => (n === 1 ? "1 item" : `${n} itens`),
  nothing: "Nada",
  empty: {
    overdue: "Nada vencido.",
    today: "Nada vence hoje.",
    next: "Nada vence nos próximos dias.",
    later: "Nada com vencimento mais adiante.",
    undated: "Nada sem vencimento.",
  } as Record<AgendaWindow, string>,
  creditor: "Credor",
  what: "O que é",
  open: "Em aberto",
  due: "Vencimento",
  openFor: "Aberta há",
  of: (amount: string) => `de ${amount}`,
  days: (n: number) => (n === 0 ? "hoje" : n === 1 ? "1 dia" : `${n} dias`),
  unknownCreditor: "Credor não informado",
  unknownAge: "—",
  pay: "Pagar",
  view: "Ver",
  unavailable: "Agenda indisponível: o Ledger não respondeu. Nada aqui quer dizer que não há contas a pagar.",
  loadError: "Não foi possível carregar a agenda.",
};

const en: typeof ptBR = {
  nav: "Payables agenda",
  heading: "Payables agenda",
  subheading: (asOf: string) => `Everything the Usina owes and is still open, by due date, as of ${asOf}. The totals are the Ledger's.`,
  windows: {
    overdue: "Overdue",
    today: "Due today",
    next: (days: number) => `Next ${days} days`,
    later: "Later",
    undated: "No due date",
  },
  windowHint: {
    overdue: "Due before today.",
    today: "Due today.",
    next: "From tomorrow on, within the window.",
    later: "Due after the window.",
    undated: "No known due date. Not late: a term nobody stated. Broker pass-throughs land here.",
  },
  items: (n: number) => (n === 1 ? "1 item" : `${n} items`),
  nothing: "Nothing",
  empty: {
    overdue: "Nothing overdue.",
    today: "Nothing due today.",
    next: "Nothing due in the next days.",
    later: "Nothing due further ahead.",
    undated: "Nothing without a due date.",
  },
  creditor: "Creditor",
  what: "What",
  open: "Open",
  due: "Due",
  openFor: "Open for",
  of: (amount: string) => `of ${amount}`,
  days: (n: number) => (n === 0 ? "today" : n === 1 ? "1 day" : `${n} days`),
  unknownCreditor: "Creditor not stated",
  unknownAge: "—",
  pay: "Pay",
  view: "View",
  unavailable: "Agenda unavailable: the Ledger did not answer. Nothing here means there is nothing to pay.",
  loadError: "Could not load the agenda.",
};

export const agendaCopy: Record<Language, typeof ptBR> = { "pt-BR": ptBR, en };

export function windowLabel(copy: typeof ptBR, window: AgendaWindow, days: number): string {
  const label = copy.windows[window];
  return typeof label === "function" ? label(days) : label;
}
