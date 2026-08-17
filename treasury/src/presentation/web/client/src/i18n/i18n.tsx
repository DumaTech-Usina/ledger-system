import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Language = "pt-BR" | "en";

export interface LanguageOption {
  code: Language;
  name: string;
  flag: string;
}

export const languageOptions: LanguageOption[] = [
  { code: "pt-BR", name: "Português", flag: "🇧🇷" },
  { code: "en", name: "English", flag: "🇺🇸" },
];

export interface Translations {
  common: {
    loading: string;
    noRecords: string;
    close: string;
    previous: string;
    next: string;
    /** The month-navigation arrows inside `DatePicker`/`DateRangePicker` — a screen reader's only
     * name for a button that otherwise carries just a chevron glyph. */
    previousMonth: string;
    nextMonth: string;
    pageOf: string;
    viewDetails: string;
    copyId: string;
    copied: string;
    /**
     * A status the Ledger published that this app has no name for — a vocabulary it has not been
     * taught yet, not a position in a bad state. The raw value stays in the tooltip: the reader
     * still needs to be able to report WHAT the book said.
     */
    unrecognizedStatus: string;
    /** For a figure the Ledger cannot derive. Never rendered as zero — the two mean different things. */
    unknown: string;
  };
  nav: { operations: string; dashboards: string; positions: string; intents: string };
  /** The economic reality: what is owed, what is outstanding, how each object evolved. */
  positions: {
    heading: string;
    subheading: string;
    exposure: string;
    capitalAtRisk: string;
    exposureUnavailable: string;
    capitalAtRiskNote: string;
    listUnavailable: string;
    total: string;
    upcomingEntries: string;
    upcomingEntriesNote: string;
    overdueEntries: string;
    overdueEntriesNote: string;
    undatedEntries: string;
    undatedEntriesNote: string;
    dueOn: string;
    noDueDate: string;
    truncatedList: string;
    /** The total the composition below decomposes: what the book says is committed to leave. */
    commitments: string;
    commitmentsNote: string;
    /** What a total is made of, by kind of object — the Ledger's own rows, one step before the fold. */
    composition: string;
    /** The Ledger published no composition. Never rendered as "nothing outstanding". */
    compositionUnknown: string;
    /** It published one and it is empty: nothing of that kind is outstanding. */
    compositionEmpty: string;
  };
  /** Chrome for the filter/sort controls shared by the positions and movements listings. */
  filters: {
    heading: string;
    from: string;
    to: string;
    status: string;
    objectType: string;
    outcome: string;
    allOutcomes: string;
    effect: string;
    allEffects: string;
    party: string;
    partyPlaceholder: string;
    sortBy: string;
    sortOrder: string;
    sortAsc: string;
    sortDesc: string;
    clear: string;
    sortCreatedAt: string;
    sortDueAt: string;
    sortOccurredAt: string;
    sortRecordedAt: string;
    /** How many are selected in a multi-select dropdown, e.g. "2 selecionados". */
    selectedCount: string;
    all: string;
  };
  /** Chrome for `DateRangePicker`: the expanded panel, its typed-date fields and its ten presets. */
  dateRangePicker: {
    title: string;
    placeholder: string;
    selectStart: string;
    selectEnd: string;
    apply: string;
    cancel: string;
    presetToday: string;
    presetYesterday: string;
    presetTomorrow: string;
    presetThisWeek: string;
    presetLastWeek: string;
    presetThisMonth: string;
    presetLastMonth: string;
    presetFirstHalf: string;
    presetSecondHalf: string;
    presetFullYear: string;
  };
  /** Chrome for `DatePicker` — the single-date sibling of `dateRangePicker`. */
  datePicker: {
    title: string;
    placeholder: string;
    select: string;
    /** The one-click shortcut beside the trigger that picks and confirms today in a single action. */
    today: string;
  };
  intents: {
    heading: string;
    subheading: string;
    operation: string;
    status: string;
    updatedAt: string;
    historyTitle: string;
    noHistory: string;
  };
  roles: { finance_manager: string; viewer: string };
  topbar: { openMenu: string; account: string; signOut: string; language: string };
  sidebar: { closeMenu: string; collapseMenu: string; expandMenu: string; collapse: string };
  dashboard: {
    heading: string;
    subheading: string;
    unavailable: string;
    cashIn: string;
    cashOut: string;
    netFlow: string;
    positionAsOf: string;
    /** Caption above the period picker that drives cards, chart and the movements list together. */
    periodLabel: string;
    /** The window the Ledger actually applied — its own default when nothing was asked for. */
    periodApplied: string;
    recentMovements: string;
    /** Result count for the movements listing, mirroring `positions.total`. */
    movementsTotal: string;
    /** The Ledger could not be reached for the movements listing specifically. */
    movementsUnavailable: string;
    /** The figure the Ledger computes from balances, and the drill-down that matches it. */
    openPositions: string;
    /** The full list, which includes positions with nothing outstanding. */
    allPositions: string;
    table: {
      date: string;
      recordedDate: string;
      /** The object's own id, as the Ledger keys it — what an audit is traced by. */
      id: string;
      type: string;
      amount: string;
      counterparty: string;
      status: string;
      openBalance: string;
      description: string;
      document: string;
      cashInColumn: string;
      cashOutColumn: string;
      /** The cash balance standing right after the movement on that row. */
      balanceColumn: string;
      /** Reads as a question a person would ask, not as a field name. */
      whatHappened: string;
      /** Everyone involved in a position, not only the counterparty a filter matched. */
      parties: string;
      /** Marks which of a position's parties is the usina, among the full cast. */
      selfParty: string;
      /** The Ledger's own category for the fact — `eventType`, translated via the `eventType` map below. */
      eventType: string;
    };
    /** The context a fact carries: what it touched, who took part, where it came from. */
    fact: {
      whatItTouched: string;
      /** The event named no object. Distinct from the Ledger not publishing them at all. */
      touchedNothing: string;
      objectsNotPublished: string;
      /** Column headings. Every value in these tables needs one — see FactContext. */
      record: string;
      relation: string;
      participant: string;
      role: string;
      direction: string;
      whoTookPart: string;
      /**
       * The event recorded no party — distinct from the Ledger not publishing parties at all. Both
       * are worded without a subject: the same block serves a cash movement and a position's own
       * events, and neither sentence should name one of them.
       */
      noParties: string;
      partiesNotPublished: string;
      /** Marks, inside the full cast, the one the movement already calls its counterparty. */
      counterpartyTag: string;
      origin: string;
      /** The Ledger published the object without a type — shown as the absence it is. */
      untypedObject: string;
      openObject: string;
      backToMovement: string;
    };
    lifecycle: {
      tabSummary: string;
      tabLifecycle: string;
      originTitle: string;
      /** No origination stands: a cash-basis position, or one whose origination was retracted. */
      noStandingOrigin: string;
      originReferences: string;
      /** The Ledger knows no such object — distinct from "this object has no events". */
      unknownObject: string;
      unavailable: string;
      originated: string;
      settled: string;
      events: string;
      occurredOn: string;
      recordedOn: string;
      relatedEvent: string;
      /** The related event belongs to a position this screen is not showing — said, not left as a bare id. */
      relatedElsewhere: string;
      copyEventId: string;
      copied: string;
      retracted: string;
      retractedNote: string;
      openByIdLabel: string;
      openByIdPlaceholder: string;
      openByIdAction: string;
      rectify: string;
      rectifyTitle: string;
      rectifyExplain: string;
      rectifyDescription: string;
      rectifyConfirm: string;
      rectifyCancel: string;
      rectifyUnsupported: string;
      rectifyContextual: string;
      rectifyModeWithdraw: string;
      rectifyModeRestate: string;
      rectifyAmount: string;
      rectifyDate: string;
      rectifyRestateHint: string;
      rectifyLockedNote: string;
      pendingTitle: string;
      pendingExplain: string;
      pendingResume: string;
      pendingIncomplete: string;
      pendingNotReissuable: string;
      actionsTitle: string;
      actionsHint: string;
      actionOpensAnother: string;
    };
    hero: {
      badge: string;
      cta: string;
      netLabel: string;
      dayDetailTitle: string;
      balanceLabel: string;
      viewAll: string;
      allMovementsTitle: string;
      chartTitle: string;
      chartLabel: string;
      chartInflow: string;
      chartOutflow: string;
      chartBalance: string;
      /** The chart/modal stopped at the page cap before the period did — said, not left implicit. */
      truncatedNote: string;
    };
  };
  /** Keyed by the domain enum's raw string value (e.g. CashEffect, ObjectType). */
  cashEffect: Record<string, string>;
  positionStatus: Record<string, string>;
  /** What an event declares about the object it names — the axis that makes a history readable. */
  eventRelation: Record<string, string>;
  /** What a party was in the fact: payer, payee, intermediary, beneficiary, platform. */
  partyRole: Record<string, string>;
  /** Which way the money went for that party — what makes a fact readable as from-whom/to-whom. */
  partyDirection: Record<string, string>;
  positionOutcome: Record<string, string>;
  /** The intent lifecycle inside the User App — distinct from the Ledger's fact lifecycle. */
  intentStatus: Record<string, string>;
  objectType: Record<string, string>;
  eventType: Record<string, string>;
}

const ptBR: Translations = {
  common: {
    loading: "Carregando…",
    noRecords: "Nenhum registro.",
    close: "Fechar",
    previous: "Anterior",
    next: "Próxima",
    previousMonth: "Mês anterior",
    nextMonth: "Próximo mês",
    pageOf: "Página {page} de {total}",
    viewDetails: "Ver detalhes",
    copyId: "Copiar id",
    copied: "Copiado",
    unrecognizedStatus: "Status não reconhecido",
    unknown: "Desconhecido",
  },
  nav: {
    operations: "Operações",
    dashboards: "Dashboard",
    positions: "Posições",
    intents: "Minhas operações",
  },
  positions: {
    heading: "Posições econômicas",
    subheading: "O que ainda está em aberto, o que já foi encerrado e como cada objeto evoluiu.",
    exposure: "Exposição em aberto",
    capitalAtRisk: "Capital em risco",
    exposureUnavailable: "Não foi possível ler a exposição do livro agora.",
    capitalAtRiskNote: "Originado há mais de 30 dias, sem nenhuma liquidação até aqui.",
    listUnavailable: "Não foi possível listar as posições agora.",
    upcomingEntries: "Lançamentos futuros",
    upcomingEntriesNote: "Obrigações em aberto com vencimento ainda à frente.",
    overdueEntries: "Lançamentos atrasados",
    overdueEntriesNote: "Obrigações em aberto cujo vencimento já passou.",
    undatedEntries: "Sem vencimento informado",
    undatedEntriesNote: "Em aberto, mas o documento que as originou não informou vencimento. Não são futuras nem atrasadas.",
    dueOn: "Vence em",
    noDueDate: "Sem vencimento informado",
    truncatedList: "A lista abaixo mostra apenas as primeiras posições. Os valores acima consideram o livro inteiro.",
    commitments: "Compromissos reconhecidos",
    commitmentsNote: "O que a Usina deve por obrigações já reconhecidas e ainda não pagas.",
    composition: "Composição por natureza",
    compositionUnknown: "O livro não informou a composição deste total.",
    compositionEmpty: "Nada em aberto nesta natureza.",
    total: "{count} posições",
  },
  filters: {
    heading: "Filtros",
    from: "De",
    to: "Até",
    status: "Status",
    objectType: "Tipo",
    outcome: "Resultado",
    allOutcomes: "Todos",
    effect: "Direção",
    allEffects: "Todas",
    party: "Contraparte (id)",
    partyPlaceholder: "ex.: party-acme",
    sortBy: "Ordenar por",
    sortOrder: "Ordem",
    sortAsc: "Crescente",
    sortDesc: "Decrescente",
    clear: "Limpar filtros",
    sortCreatedAt: "Data de entrada",
    sortDueAt: "Vencimento",
    sortOccurredAt: "Data do movimento",
    sortRecordedAt: "Data de registro",
    selectedCount: "{count} selecionados",
    all: "Todos",
  },
  dateRangePicker: {
    title: "Selecionar período",
    placeholder: "Selecionar período",
    selectStart: "Início",
    selectEnd: "Fim",
    apply: "Aplicar filtro",
    cancel: "Cancelar",
    presetToday: "Hoje",
    presetYesterday: "Ontem",
    presetTomorrow: "Amanhã",
    presetThisWeek: "Esta semana",
    presetLastWeek: "Semana passada",
    presetThisMonth: "Este mês",
    presetLastMonth: "Mês passado",
    presetFirstHalf: "Primeiro semestre",
    presetSecondHalf: "Segundo semestre",
    presetFullYear: "Ano inteiro",
  },
  datePicker: {
    title: "Selecionar data",
    placeholder: "Selecionar data",
    select: "Selecionar",
    today: "Hoje",
  },
  intents: {
    heading: "Minhas operações",
    subheading: "O que você registrou e o que aconteceu com cada registro.",
    operation: "Operação",
    status: "Situação",
    updatedAt: "Atualizado em",
    historyTitle: "Histórico",
    noHistory: "Sem histórico registrado.",
  },
  roles: {
    finance_manager: "Financeiro",
    viewer: "Somente leitura",
  },
  topbar: {
    openMenu: "Abrir menu",
    account: "Conta",
    signOut: "Sair",
    language: "Idioma",
  },
  sidebar: {
    closeMenu: "Fechar menu",
    collapseMenu: "Recolher menu",
    expandMenu: "Expandir menu",
    collapse: "Recolher",
  },
  dashboard: {
    heading: "Dashboard",
    subheading: "Quanto dinheiro entrou e saiu, e quando. Somente leitura, obtido do Ledger.",
    unavailable: "Não foi possível carregar os dados do Ledger no momento.",
    cashIn: "Entradas de caixa",
    cashOut: "Saídas de caixa",
    netFlow: "Fluxo líquido",
    positionAsOf: "Posição em {date}",
    periodLabel: "Período",
    periodApplied: "Aplicado pelo Ledger: {from} – {to}",
    recentMovements: "Movimentações",
    movementsTotal: "{count} movimentações",
    movementsUnavailable: "Não foi possível listar as movimentações agora.",
    openPositions: "Posições em aberto",
    allPositions: "Posições",
    table: {
      date: "Data",
      recordedDate: "Data do registro",
      id: "Id",
      type: "Tipo",
      amount: "Valor",
      counterparty: "Contraparte",
      status: "Situação",
      openBalance: "Saldo em aberto",
      description: "Descrição",
      document: "Número do documento",
      cashInColumn: "Entradas",
      cashOutColumn: "Saídas",
      balanceColumn: "Saldo",
      whatHappened: "O que aconteceu",
      parties: "Partes",
      selfParty: "Usina",
      eventType: "Tipo de evento",
    },
    fact: {
      whatItTouched: "Posições e documentos",
      touchedNothing: "Esta movimentação não cita nenhuma posição ou documento.",
      objectsNotPublished: "O Ledger não informou as posições e documentos desta movimentação.",
      record: "Registro",
      relation: "Relação",
      participant: "Participante",
      role: "Papel",
      direction: "Direção",
      whoTookPart: "Participantes",
      noParties: "Nenhum participante registrado.",
      partiesNotPublished: "O Ledger não informou os participantes.",
      counterpartyTag: "contraparte",
      origin: "Origem",
      untypedObject: "Tipo não informado",
      openObject: "Abrir posição",
      backToMovement: "Voltar para a movimentação",
    },
    lifecycle: {
      tabSummary: "Resumo",
      originTitle: "Originado por",
      noStandingOrigin: "Nenhuma originação vigente para esta posição.",
      originReferences: "Refere-se a",
      tabLifecycle: "Ciclo de vida",
      unknownObject: "O Ledger não conhece esta posição. Isso não afirma que nada aconteceu com ela.",
      unavailable: "Não foi possível carregar o ciclo de vida agora.",
      originated: "Originado",
      settled: "Liquidado",
      events: "Eventos",
      occurredOn: "Ocorreu em",
      recordedOn: "Registrado em",
      relatedEvent: "Evento relacionado",
      relatedElsewhere: "Evento relacionado — de outra posição",
      copyEventId: "Copiar id do evento",
      copied: "Copiado",
      retracted: "Retratado",
      retractedNote: "Uma retificação declarou que este evento nunca aconteceu. Ele permanece na história e não conta para nenhum valor.",
      openByIdLabel: "Abrir posição por id",
      openByIdPlaceholder: "ex.: intent:8f2c…",
      openByIdAction: "Abrir",
      rectify: "Retificar",
      rectifyTitle: "Este lançamento nunca aconteceu?",
      rectifyExplain:
        "A retificação declara que o lançamento não corresponde ao mundo. Ele continua na história e deixa de contar. Valor e posição vêm do registro do Ledger — você não redigita nada.",
      rectifyDescription: "O que comprovou o erro (documento, conciliação)?",
      rectifyConfirm: "Registrar retificação",
      rectifyCancel: "Cancelar",
      rectifyUnsupported: "Retificação ainda não disponível para este tipo de posição.",
      rectifyContextual: "Este evento não movimenta esta posição.",
      rectifyModeWithdraw: "Não aconteceu",
      rectifyModeRestate: "Aconteceu, com outro valor ou data",
      rectifyAmount: "Valor correto",
      rectifyDate: "Data correta",
      rectifyRestateHint:
        "Serão gravados dois fatos: a retirada do lançamento errado e o lançamento correto, sobre a mesma posição. Nada é editado.",
      rectifyLockedNote:
        "Contraparte e tipo não mudam aqui: trocar quem participou muda qual é o fato, não como ele foi medido.",
      pendingTitle: "Correção pela metade",
      pendingExplain:
        "O lançamento errado foi retirado, mas o correto ainda não foi gravado. A posição fica sem base até isso ser concluído.",
      pendingResume: "Concluir correção",
      pendingIncomplete:
        "Não foi possível descrever o lançamento correto a partir do registro — falta informar: {slot}.",
      pendingNotReissuable:
        "O Treasury não sabe registrar este tipo de lançamento novamente. Nada foi gravado; só a retirada está disponível.",
      actionsTitle: "Registrar novo fato",
      actionsHint: "A conversa começa já sabendo de qual posição se trata.",
      actionOpensAnother: "(abre outra posição)",
    },
    hero: {
      badge: "Fluxo financeiro",
      cta: "Nova operação",
      netLabel: "Líquido",
      dayDetailTitle: "Movimentações de {date}",
      balanceLabel: "Saldo do dia",
      viewAll: "Ver fluxo completo",
      allMovementsTitle: "Fluxo completo",
      chartTitle: "Fluxo diário",
      chartLabel: "Entradas e saídas por dia, com a evolução do saldo em caixa",
      chartInflow: "Entradas",
      chartOutflow: "Saídas",
      chartBalance: "Saldo",
      truncatedNote: "Mostrando as primeiras movimentações do período. Para ver todas, use a lista de Movimentações abaixo.",
    },
  },
  cashEffect: {
    cash_in: "Entrada",
    cash_out: "Saída",
    cash_internal: "Interno",
    non_cash: "Não-caixa",
    contingent: "Contingente",
  },
  positionStatus: {
    open: "Em aberto",
    partially_settled: "Parcialmente liquidado",
    fully_settled: "Liquidado",
    reversed: "Estornado",
    // The Ledger saw a settlement but not what was originated — never to be read as zero.
    unknown_origin: "Origem desconhecida",
  },
  /*
   * Nouns, not verbs, and deliberately not participles.
   *
   * The verb form ("Liquida") is grammatically right — the event is the subject — but a pill carries
   * no subject, so it reads as a fragment. The participle would be worse: "Liquidado" and
   * "Estornado" already name where the POSITION stands in `positionStatus`, and reusing them here
   * would put the same word on two badges that answer different questions.
   *
   * The noun names the kind of step, which is what this column actually holds.
   */
  eventRelation: {
    originates: "Originação",
    adjusts: "Ajuste",
    settles: "Liquidação",
    reverses: "Estorno",
    references: "Referência",
    retracts: "Retratação",
  },
  partyRole: {
    payer: "Pagador",
    payee: "Recebedor",
    intermediary: "Intermediário",
    beneficiary: "Beneficiário",
    platform: "Plataforma",
  },
  partyDirection: {
    out: "Saiu",
    in: "Entrou",
    neutral: "Sem movimento",
  },
  intentStatus: {
    draft: "Rascunho",
    gathering: "Coletando informações",
    awaiting_confirmation: "Aguardando confirmação",
    confirmed: "Confirmado",
    submitted: "Enviado",
    awaiting_correction: "Aguardando correção",
    accepted: "Aceito",
    rejected: "Rejeitado",
  },
  positionOutcome: {
    gain: "Recuperado",
    partial_loss: "Perda parcial",
    full_loss: "Perda total",
    cancelled: "Cancelado",
    pending: "Em andamento",
  },
  objectType: {
    commission_entitlement: "Direito à comissão",
    commission_pool: "Pool de comissão",
    commission_receivable: "Comissão a receber",
    commission_payable: "Comissão a pagar",
    loan: "Empréstimo",
    advance: "Adiantamento",
    receivable: "A receber",
    payable: "A pagar",
    contract: "Contrato",
    proposal: "Proposta",
    installment: "Parcela",
    settlement_batch: "Lote de liquidação",
    penalty: "Multa",
    chargeback: "Estorno",
    contingent_claim: "Reivindicação contingente",
    dispute: "Disputa",
    incentive: "Incentivo",
    campaign: "Campanha",
    bonus: "Bônus",
    payroll: "Folha de pagamento",
    service_fee: "Taxa de serviço",
    infrastructure_cost: "Custo de infraestrutura",
    tax: "Imposto",
    // Demo-fixture-only values (treasury's in-memory/stub adapters), not part of
    // the ledger's canonical ObjectType enum — kept here so the demo data never
    // renders as a raw, untranslated string.
    charge: "Cobrança",
    purchase: "Compra",
    commission: "Comissão",
    unknown: "Não classificado",
  },
  eventType: {
    payroll_payment: "Pagamento de folha",
    infrastructure_expense: "Despesa de infraestrutura",
    service_fee_payment: "Pagamento de taxa de serviço",
    tax_payment: "Pagamento de imposto",
    commission_received: "Comissão recebida",
    commission_split: "Divisão de comissão",
    commission_waiver: "Isenção de comissão",
    penalty_payment: "Pagamento de multa",
    advance_payment: "Pagamento de adiantamento",
    advance_settlement: "Liquidação de adiantamento",
    loan_origination: "Concessão de empréstimo",
    loan_repayment: "Pagamento de empréstimo",
    direct_payment_acknowledged: "Pagamento direto reconhecido",
    incentive_payment: "Pagamento de incentivo",
    ledger_correction: "Correção de lançamento",
    commission_expected: "Comissão prevista",
    outbound_payment: "Pagamento efetuado",
    obligation_recognized: "Obrigação reconhecida",
  },
};

const en: Translations = {
  common: {
    loading: "Loading…",
    noRecords: "No records.",
    close: "Close",
    previous: "Previous",
    next: "Next",
    previousMonth: "Previous month",
    nextMonth: "Next month",
    pageOf: "Page {page} of {total}",
    viewDetails: "View details",
    copyId: "Copy id",
    copied: "Copied",
    unrecognizedStatus: "Unrecognized status",
    unknown: "Unknown",
  },
  nav: {
    operations: "Operations",
    dashboards: "Dashboard",
    positions: "Positions",
    intents: "My entries",
  },
  positions: {
    heading: "Economic positions",
    subheading: "What is still outstanding, what has closed, and how each object evolved.",
    exposure: "Open exposure",
    capitalAtRisk: "Capital at risk",
    exposureUnavailable: "Couldn't read the book's exposure right now.",
    capitalAtRiskNote: "Originated over 30 days ago, with nothing settled against it yet.",
    listUnavailable: "Couldn't list positions right now.",
    upcomingEntries: "Upcoming entries",
    upcomingEntriesNote: "Outstanding obligations whose due date is still ahead.",
    overdueEntries: "Overdue entries",
    overdueEntriesNote: "Outstanding obligations whose due date has passed.",
    undatedEntries: "No due date stated",
    undatedEntriesNote: "Outstanding, but the document that established them stated no due date. Neither upcoming nor overdue.",
    dueOn: "Due",
    noDueDate: "No due date stated",
    truncatedList: "The list below shows only the first positions. The figures above cover the whole book.",
    commitments: "Recognized commitments",
    commitmentsNote: "What Usina owes on obligations already recognized and not yet paid.",
    composition: "Composition by kind",
    compositionUnknown: "The book did not publish this total's composition.",
    compositionEmpty: "Nothing outstanding of this kind.",
    total: "{count} positions",
  },
  filters: {
    heading: "Filters",
    from: "From",
    to: "To",
    status: "Status",
    objectType: "Type",
    outcome: "Outcome",
    allOutcomes: "All",
    effect: "Direction",
    allEffects: "All",
    party: "Counterparty (id)",
    partyPlaceholder: "e.g. party-acme",
    sortBy: "Sort by",
    sortOrder: "Order",
    sortAsc: "Ascending",
    sortDesc: "Descending",
    clear: "Clear filters",
    selectedCount: "{count} selected",
    all: "All",
    sortCreatedAt: "Entry date",
    sortDueAt: "Due date",
    sortOccurredAt: "Movement date",
    sortRecordedAt: "Recorded date",
  },
  dateRangePicker: {
    title: "Select period",
    placeholder: "Select period",
    selectStart: "Start",
    selectEnd: "End",
    apply: "Apply filter",
    cancel: "Cancel",
    presetToday: "Today",
    presetYesterday: "Yesterday",
    presetTomorrow: "Tomorrow",
    presetThisWeek: "This week",
    presetLastWeek: "Last week",
    presetThisMonth: "This month",
    presetLastMonth: "Last month",
    presetFirstHalf: "First half",
    presetSecondHalf: "Second half",
    presetFullYear: "Full year",
  },
  datePicker: {
    title: "Select date",
    placeholder: "Select date",
    select: "Select",
    today: "Today",
  },
  intents: {
    heading: "My entries",
    subheading: "What you recorded, and what became of each record.",
    operation: "Operation",
    status: "Status",
    updatedAt: "Updated",
    historyTitle: "History",
    noHistory: "No history recorded.",
  },
  roles: {
    finance_manager: "Finance",
    viewer: "Read only",
  },
  topbar: {
    openMenu: "Open menu",
    account: "Account",
    signOut: "Sign out",
    language: "Language",
  },
  sidebar: {
    closeMenu: "Close menu",
    collapseMenu: "Collapse menu",
    expandMenu: "Expand menu",
    collapse: "Collapse",
  },
  dashboard: {
    heading: "Cash",
    subheading: "How much money came in and out, and when. Read-only, sourced from the Ledger.",
    unavailable: "Couldn't load Ledger data right now.",
    cashIn: "Cash in",
    cashOut: "Cash out",
    netFlow: "Net flow",
    positionAsOf: "Position as of {date}",
    periodLabel: "Period",
    periodApplied: "Applied by the Ledger: {from} – {to}",
    recentMovements: "Movements",
    movementsTotal: "{count} movements",
    movementsUnavailable: "Couldn't list movements right now.",
    openPositions: "Open positions",
    allPositions: "Positions",
    table: {
      date: "Date",
      recordedDate: "Recorded date",
      id: "Id",
      type: "Type",
      amount: "Amount",
      counterparty: "Counterparty",
      status: "Status",
      openBalance: "Open balance",
      description: "Description",
      document: "Document number",
      cashInColumn: "Cash in",
      cashOutColumn: "Cash out",
      balanceColumn: "Balance",
      whatHappened: "What happened",
      parties: "Parties",
      selfParty: "Usina",
      eventType: "Event type",
    },
    fact: {
      whatItTouched: "Positions and documents",
      touchedNothing: "This movement names no position or document.",
      objectsNotPublished: "The Ledger didn't state this movement's positions and documents.",
      record: "Record",
      relation: "Relation",
      participant: "Participant",
      role: "Role",
      direction: "Direction",
      whoTookPart: "Participants",
      noParties: "No party recorded.",
      partiesNotPublished: "The Ledger didn't state the parties.",
      counterpartyTag: "counterparty",
      origin: "Source",
      untypedObject: "Type not stated",
      openObject: "Open position",
      backToMovement: "Back to the movement",
    },
    lifecycle: {
      tabSummary: "Summary",
      originTitle: "Originated by",
      noStandingOrigin: "No standing origination for this position.",
      originReferences: "Refers to",
      tabLifecycle: "Lifecycle",
      unknownObject: "The Ledger knows no such position. That doesn't assert nothing happened to it.",
      unavailable: "Couldn't load the lifecycle right now.",
      originated: "Originated",
      settled: "Settled",
      events: "Events",
      occurredOn: "Occurred on",
      recordedOn: "Recorded on",
      relatedEvent: "Related event",
      relatedElsewhere: "Related event — from another position",
      copyEventId: "Copy event id",
      copied: "Copied",
      retracted: "Retracted",
      retractedNote: "A rectification declared this event never happened. It stays in the history and counts towards no figure.",
      openByIdLabel: "Open position by id",
      openByIdPlaceholder: "e.g. intent:8f2c…",
      openByIdAction: "Open",
      rectify: "Rectify",
      rectifyTitle: "Did this entry never happen?",
      rectifyExplain:
        "A rectification declares the entry doesn't correspond to the world. It stays in the history and stops counting. The amount and position come from the Ledger's own record — you retype nothing.",
      rectifyDescription: "What established the error (document, reconciliation)?",
      rectifyConfirm: "Record rectification",
      rectifyCancel: "Cancel",
      rectifyUnsupported: "Rectifying this kind of position isn't supported yet.",
      rectifyContextual: "This event doesn't move this position.",
      rectifyModeWithdraw: "It never happened",
      rectifyModeRestate: "It happened, with a different amount or date",
      rectifyAmount: "Correct amount",
      rectifyDate: "Correct date",
      rectifyRestateHint:
        "Two facts will be recorded: the withdrawal of the wrong entry and the correct entry, on the same position. Nothing is edited.",
      rectifyLockedNote:
        "Counterparty and kind don't change here: changing who took part changes which fact it is, not how it was measured.",
      pendingTitle: "Correction half done",
      pendingExplain:
        "The wrong entry was withdrawn, but the correct one hasn't been recorded yet. The position has no baseline until this is finished.",
      pendingResume: "Finish correction",
      pendingIncomplete:
        "The correct entry couldn't be described from the record — this is still needed: {slot}.",
      pendingNotReissuable:
        "Treasury can't record this kind of entry again. Nothing was written; only the withdrawal is available.",
      actionsTitle: "Record a new fact",
      actionsHint: "The conversation opens already knowing which position this is about.",
      actionOpensAnother: "(opens another position)",
    },
    hero: {
      badge: "Financial flow",
      cta: "New entry",
      netLabel: "Net",
      dayDetailTitle: "Movements on {date}",
      balanceLabel: "Daily balance",
      viewAll: "View full flow",
      allMovementsTitle: "Full flow",
      chartTitle: "Daily flow",
      chartLabel: "Cash in and cash out per day, with the running cash balance",
      chartInflow: "Cash in",
      chartOutflow: "Cash out",
      chartBalance: "Balance",
      truncatedNote: "Showing the period's first movements. See the Movements list below for the rest.",
    },
  },
  cashEffect: {
    cash_in: "Cash in",
    cash_out: "Cash out",
    cash_internal: "Internal",
    non_cash: "Non-cash",
    contingent: "Contingent",
  },
  positionStatus: {
    open: "Open",
    partially_settled: "Partially settled",
    fully_settled: "Settled",
    reversed: "Reversed",
    unknown_origin: "Unknown origin",
  },
  /** Nouns here too, and for the same reason — see the pt-BR block above. */
  eventRelation: {
    originates: "Origination",
    adjusts: "Adjustment",
    settles: "Settlement",
    reverses: "Reversal",
    references: "Reference",
    retracts: "Retraction",
  },
  partyRole: {
    payer: "Payer",
    payee: "Payee",
    intermediary: "Intermediary",
    beneficiary: "Beneficiary",
    platform: "Platform",
  },
  partyDirection: {
    out: "Out",
    in: "In",
    neutral: "No movement",
  },
  intentStatus: {
    draft: "Draft",
    gathering: "Gathering information",
    awaiting_confirmation: "Awaiting confirmation",
    confirmed: "Confirmed",
    submitted: "Submitted",
    awaiting_correction: "Awaiting correction",
    accepted: "Accepted",
    rejected: "Rejected",
  },
  positionOutcome: {
    gain: "Recovered",
    partial_loss: "Partial loss",
    full_loss: "Full loss",
    cancelled: "Cancelled",
    pending: "In progress",
  },
  objectType: {
    commission_entitlement: "Commission entitlement",
    commission_pool: "Commission pool",
    commission_receivable: "Commission receivable",
    commission_payable: "Commission payable",
    loan: "Loan",
    advance: "Advance",
    receivable: "Receivable",
    payable: "Payable",
    contract: "Contract",
    proposal: "Proposal",
    installment: "Installment",
    settlement_batch: "Settlement batch",
    penalty: "Penalty",
    chargeback: "Chargeback",
    contingent_claim: "Contingent claim",
    dispute: "Dispute",
    incentive: "Incentive",
    campaign: "Campaign",
    bonus: "Bonus",
    payroll: "Payroll",
    service_fee: "Service fee",
    infrastructure_cost: "Infrastructure cost",
    tax: "Tax",
    charge: "Charge",
    purchase: "Purchase",
    commission: "Commission",
    unknown: "Uncategorized",
  },
  eventType: {
    payroll_payment: "Payroll payment",
    infrastructure_expense: "Infrastructure expense",
    service_fee_payment: "Service fee payment",
    tax_payment: "Tax payment",
    commission_received: "Commission received",
    commission_split: "Commission split",
    commission_waiver: "Commission waiver",
    penalty_payment: "Penalty payment",
    advance_payment: "Advance payment",
    advance_settlement: "Advance settlement",
    loan_origination: "Loan origination",
    loan_repayment: "Loan repayment",
    direct_payment_acknowledged: "Direct payment acknowledged",
    incentive_payment: "Incentive payment",
    ledger_correction: "Ledger correction",
    commission_expected: "Commission expected",
    outbound_payment: "Outbound payment",
    obligation_recognized: "Obligation recognized",
  },
};

const translations: Record<Language, Translations> = { "pt-BR": ptBR, en };

/** Fills `{token}` placeholders, e.g. formatTemplate(t.dashboard.positionAsOf, { date: "22/07/2026" }). */
export function formatTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""));
}

const STORAGE_KEY = "treasury.language";

function readInitialLanguage(): Language {
  if (typeof window === "undefined") return "pt-BR";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "pt-BR" || stored === "en" ? stored : "pt-BR";
}

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(readInitialLanguage);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language);
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: translations[language] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
