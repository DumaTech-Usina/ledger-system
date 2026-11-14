import type { Language } from "@/i18n/i18n";
import type { AgendaWindow } from "@/features/agenda/agendaApi";

const ptBR = {
  nav: "Agenda a receber",
  heading: "Agenda a receber",
  subheading: (asOf: string) =>
    `Tudo o que devem à Usina e ainda está em aberto, pela data esperada, em ${asOf}. Os totais são os do Ledger.`,
  payer: "Pagador",
  allPayers: "Todos os pagadores",
  unknownPayer: "Pagador não informado",
  payerOption: (name: string, count: number) => `${name} · ${count === 1 ? "1 item" : `${count} itens`}`,
  windows: {
    overdue: "Atrasado",
    today: "Esperado hoje",
    next: (days: number) => `Próximos ${days} dias`,
    later: "Depois",
    undated: "Sem data esperada",
  } as Record<AgendaWindow, string | ((days: number) => string)>,
  windowHint: {
    overdue: "Data esperada antes de hoje e ainda não recebido.",
    today: "Esperado para hoje.",
    next: "De amanhã em diante, dentro da janela.",
    later: "Esperado depois da janela.",
    undated: "Nenhuma data esperada informada. Não é atraso: é uma data que ninguém informou.",
  } as Record<AgendaWindow, string>,
  unlinked: "Recebido sem origem",
  unlinkedHint:
    "Dinheiro que entrou sem que se saiba de qual expectativa. Não é dívida de ninguém. Ligá-lo depois à expectativa ainda não é possível (DEC-036); por ora fica aqui, à vista.",
  unlinkedTotal: "recebido",
  items: (n: number) => (n === 1 ? "1 item" : `${n} itens`),
  nothing: "Nada",
  empty: {
    overdue: "Nada atrasado.",
    today: "Nada esperado para hoje.",
    next: "Nada esperado nos próximos dias.",
    later: "Nada esperado mais adiante.",
    undated: "Nada sem data esperada.",
    unlinked: "Nenhum recebimento sem origem.",
  } as Record<AgendaWindow | "unlinked", string>,
  what: "O que é",
  open: "Em aberto",
  received: "Recebido",
  expected: "Data esperada",
  openFor: "Aberta há",
  receivedFor: "Entrou há",
  of: (amount: string) => `de ${amount}`,
  days: (n: number) => (n === 0 ? "hoje" : n === 1 ? "1 dia" : `${n} dias`),
  unknownAge: "—",
  policy: (label: string) => `Apólice ${label}`,
  declaredBadge: "Declarado pago",
  declaredTitle: (insurer: string, amount: string) => `${insurer} diz que pagou ${amount}. O recebimento ainda não foi visto no banco.`,
  theInsurer: "A operadora",
  receive: "Receber",
  view: "Ver",
  declaredHeading: "Declarado pela operadora e ainda não visto no banco",
  declaredNote:
    "A operadora disse, no sistema de seguro, que pagou. Isso não é dinheiro na conta: confira no banco e registre o recebimento. Sem total, porque o que a operadora diz não é somado aqui.",
  declaredEmpty: "Nada declarado à espera do banco.",
  declaredUnavailable: "Lista indisponível: o Ledger não respondeu.",
  declaredClaim: "Declarado",
  declaredOn: "Elegível em",
  missing: "Falta",
  unavailable: "Agenda indisponível: o Ledger não respondeu. Nada aqui quer dizer que não há o que receber.",
  loadError: "Não foi possível carregar a agenda.",
};

const en: typeof ptBR = {
  nav: "Receivables agenda",
  heading: "Receivables agenda",
  subheading: (asOf: string) => `Everything owed to the Usina and still open, by expected date, as of ${asOf}. The totals are the Ledger's.`,
  payer: "Payer",
  allPayers: "All payers",
  unknownPayer: "Payer not stated",
  payerOption: (name: string, count: number) => `${name} · ${count === 1 ? "1 item" : `${count} items`}`,
  windows: {
    overdue: "Late",
    today: "Expected today",
    next: (days: number) => `Next ${days} days`,
    later: "Later",
    undated: "No expected date",
  },
  windowHint: {
    overdue: "Expected before today and not yet received.",
    today: "Expected today.",
    next: "From tomorrow on, within the window.",
    later: "Expected after the window.",
    undated: "No expected date stated. Not late: a date nobody stated.",
  },
  unlinked: "Received, no origin",
  unlinkedHint:
    "Money that came in without knowing which expectation it was. Nobody's debt. Linking it to its expectation later is not possible yet (DEC-036); for now it stays here, in sight.",
  unlinkedTotal: "received",
  items: (n: number) => (n === 1 ? "1 item" : `${n} items`),
  nothing: "Nothing",
  empty: {
    overdue: "Nothing late.",
    today: "Nothing expected today.",
    next: "Nothing expected in the next days.",
    later: "Nothing expected further ahead.",
    undated: "Nothing without an expected date.",
    unlinked: "No receipt without origin.",
  },
  what: "What",
  open: "Open",
  received: "Received",
  expected: "Expected",
  openFor: "Open for",
  receivedFor: "In for",
  of: (amount: string) => `of ${amount}`,
  days: (n: number) => (n === 0 ? "today" : n === 1 ? "1 day" : `${n} days`),
  unknownAge: "—",
  policy: (label: string) => `Policy ${label}`,
  declaredBadge: "Declared paid",
  declaredTitle: (insurer: string, amount: string) => `${insurer} says it paid ${amount}. The receipt has not been seen at the bank yet.`,
  theInsurer: "The insurer",
  receive: "Receive",
  view: "View",
  declaredHeading: "Declared by the insurer, not yet seen at the bank",
  declaredNote:
    "The insurer said, in the insurance system, that it paid. That is not money in the account: check the bank and record the receipt. No total, because what the insurer says is not added up here.",
  declaredEmpty: "Nothing declared waiting for the bank.",
  declaredUnavailable: "List unavailable: the Ledger did not answer.",
  declaredClaim: "Declared",
  declaredOn: "Eligible on",
  missing: "Missing",
  unavailable: "Agenda unavailable: the Ledger did not answer. Nothing here means there is nothing to receive.",
  loadError: "Could not load the agenda.",
};

export const receivablesCopy: Record<Language, typeof ptBR> = { "pt-BR": ptBR, en };

export function receivableListLabel(copy: typeof ptBR, list: AgendaWindow | "unlinked", days: number): string {
  if (list === "unlinked") return copy.unlinked;
  const label = copy.windows[list];
  return typeof label === "function" ? label(days) : label;
}
