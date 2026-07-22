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
  common: { loading: string; noRecords: string; close: string };
  nav: { operations: string; dashboards: string };
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
    openReceivables: string;
    positionAsOf: string;
    recentMovements: string;
    openPositions: string;
    classificationHealth: {
      title: string;
      uncategorized: string;
      share: string;
      oldest: string;
      oldestDays: string;
      fresh: string;
      recent: string;
      stale: string;
      note: string;
    };
    table: {
      date: string;
      recordedDate: string;
      type: string;
      amount: string;
      counterparty: string;
      status: string;
      openBalance: string;
    };
    hero: {
      badge: string;
      cta: string;
      netLabel: string;
      dayDetailTitle: string;
      balanceLabel: string;
      viewAll: string;
      allMovementsTitle: string;
    };
  };
  /** Keyed by the domain enum's raw string value (e.g. CashEffect, ObjectType). */
  cashEffect: Record<string, string>;
  positionStatus: Record<string, string>;
  objectType: Record<string, string>;
  eventType: Record<string, string>;
}

const ptBR: Translations = {
  common: {
    loading: "Carregando…",
    noRecords: "Nenhum registro.",
    close: "Fechar",
  },
  nav: {
    operations: "Operações",
    dashboards: "Dashboards",
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
    heading: "Verdade financeira",
    subheading: "Visões somente leitura obtidas do Ledger. Posição de caixa, extratos e projeções.",
    unavailable: "Não foi possível carregar os dados do Ledger no momento.",
    cashIn: "Entradas de caixa",
    cashOut: "Saídas de caixa",
    netFlow: "Fluxo líquido",
    openReceivables: "A receber em aberto",
    positionAsOf: "Posição em {date}",
    recentMovements: "Movimentações recentes",
    openPositions: "Posições em aberto",
    classificationHealth: {
      title: "Saúde de classificação",
      uncategorized: "Pagamentos sem categoria",
      share: "Participação",
      oldest: "Mais antigo",
      oldestDays: "{days} dias",
      fresh: "≤ 30 dias",
      recent: "31–90 dias",
      stale: "> 90 dias",
      note: "Saídas registradas sem uma categoria específica. Promova-as a uma operação dedicada (ex.: Folha de pagamento) para reduzir este número.",
    },
    table: {
      date: "Data",
      recordedDate: "Data do registro",
      type: "Tipo",
      amount: "Valor",
      counterparty: "Contraparte",
      status: "Situação",
      openBalance: "Saldo em aberto",
    },
    hero: {
      badge: "Fluxo financeiro",
      cta: "Nova operação",
      netLabel: "Líquido",
      dayDetailTitle: "Movimentações de {date}",
      balanceLabel: "Saldo do dia",
      viewAll: "Ver fluxo completo",
      allMovementsTitle: "Fluxo completo",
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
    unknown: "Não classificado",
  },
  eventType: {
    payroll_payment: "Pagamento de folha",
    infrastructure_expense: "Despesa de infraestrutura",
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
  },
};

const en: Translations = {
  common: {
    loading: "Loading…",
    noRecords: "No records.",
    close: "Close",
  },
  nav: {
    operations: "Operations",
    dashboards: "Dashboards",
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
    heading: "Financial truth",
    subheading: "Read-only views sourced from the Ledger. Cash position, statements and projections.",
    unavailable: "Couldn't load Ledger data right now.",
    cashIn: "Cash in",
    cashOut: "Cash out",
    netFlow: "Net flow",
    openReceivables: "Open receivables",
    positionAsOf: "Position as of {date}",
    recentMovements: "Recent movements",
    openPositions: "Open positions",
    classificationHealth: {
      title: "Classification health",
      uncategorized: "Uncategorized payments",
      share: "Share",
      oldest: "Oldest",
      oldestDays: "{days} days",
      fresh: "≤ 30 days",
      recent: "31–90 days",
      stale: "> 90 days",
      note: "Outbound payments recorded without a specific category. Promote them to a dedicated operation (e.g. Payroll) to reduce this number.",
    },
    table: {
      date: "Date",
      recordedDate: "Recorded date",
      type: "Type",
      amount: "Amount",
      counterparty: "Counterparty",
      status: "Status",
      openBalance: "Open balance",
    },
    hero: {
      badge: "Financial flow",
      cta: "New entry",
      netLabel: "Net",
      dayDetailTitle: "Movements on {date}",
      balanceLabel: "Daily balance",
      viewAll: "View full flow",
      allMovementsTitle: "Full flow",
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
    unknown: "Uncategorized",
  },
  eventType: {
    payroll_payment: "Payroll payment",
    infrastructure_expense: "Infrastructure expense",
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
