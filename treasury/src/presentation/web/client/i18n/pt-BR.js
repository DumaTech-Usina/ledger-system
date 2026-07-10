/*
 * Brazilian Portuguese (pt-BR) message catalog. Only the VALUES are translated; every key is a
 * stable English identifier matching the domain (scenario ids, slot keys, status/event enums).
 * Add a new language by copying this file (e.g. en.js) and calling I18N.register("en", { ... }).
 */
I18N.register("pt-BR", {
  ui: {
    nav_operations: "Operações",
    nav_dashboards: "Painéis",
    page_title_operations: "Operações",
    page_title_dashboards: "Painéis",
    who_role: "CFO",
    foot: "User App · ecossistema Ledger",

    ops_lead: "O que você gostaria de fazer?",
    ops_sub: "Diga a ação de negócio — nós guiamos o restante.",
    start: "Iniciar →",

    dash_lead: "Verdade financeira",
    dash_sub:
      "Visões somente leitura obtidas do Ledger. Posição de caixa, extratos e projeções.",
    dash_placeholder:
      "Estas visões leem valores ao vivo do Ledger (somente leitura) e serão conectadas em seguida.<br>" +
      "O User App nunca recalcula a verdade financeira — apenas exibe o que o Ledger informa.",

    restart: "Voltar",
    lifecycle: "Ciclo de vida",
    no_activity: "Nenhuma atividade ainda.",
    starting: "Iniciando…",
    send: "Enviar",
    skipped: "(pulado)",
    intro: "Vamos lá! {description}",

    confirm_title: "Confirme antes de registrar",
    confirm_hint:
      "É exatamente isto que será proposto ao Ledger. Nada é registrado até você confirmar.",
    f_operation: "Operação",
    f_amount: "Valor",
    f_counterparty: "Contraparte",
    f_date: "Data",
    f_description: "Descrição",
    effect_label: "Efeito financeiro:",
    effect_cash_in: "entrada de caixa prevista",
    effect_cash_out: "saída de caixa a pagar",
    effect_suffix: "de {amount}, atribuído a você.",
    confirm_submit: "Confirmar e enviar",
    back_to_start: "Voltar ao início",
    submitting: "Enviando…",
    accepted: "✓ Aceito pelo Ledger — referência {ref}",
    rejected: "✕ Rejeitado — {reason}",
    submit_error: "Não foi possível enviar ao Ledger. Tente novamente.",

    required: "Este campo é obrigatório.",
    choose_one: "Escolha uma das opções: {options}.",

    dash_cash_in: "Entradas de caixa",
    dash_cash_out: "Saídas de caixa",
    dash_net: "Fluxo líquido",
    dash_receivables: "A receber em aberto",
    dash_contingent: "Exposição contingente",
    dash_asof: "Posição em {date}",
    dash_movements: "Movimentações recentes",
    dash_positions: "Posições em aberto",
    dash_unavailable:
      "Não foi possível carregar os dados do Ledger no momento.",
    dash_empty: "Nenhum registro.",
    col_date: "Data",
    col_type: "Tipo",
    col_amount: "Valor",
    col_description: "Descrição",
    col_object: "Objeto",
    col_status: "Situação",
    col_open: "Saldo em aberto",

    login_title: "Entrar no Treasury",
    login_subtitle: "Acesse com sua conta para continuar.",
    login_user: "Usuário",
    login_pass: "Senha",
    login_submit: "Entrar",
    login_error: "Usuário ou senha inválidos.",
    logout: "Sair",
    no_permission: "Você não tem permissão para esta ação.",
    viewer_notice:
      "Seu perfil tem acesso somente leitura. Operações não estão disponíveis.",
  },

  roles: {
    finance_manager: "Gerente financeiro",
    viewer: "Visualizador",
  },

  cashEffects: {
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

  scenarios: {
    add_charge: {
      title: "Adicionar cobrança",
      description: "Registrar uma cobrança devida à usina por uma contraparte.",
    },
    record_purchase: {
      title: "Registrar compra",
      description: "Registrar uma compra que a usina deve a um fornecedor.",
    },
  },

  slots: {
    add_charge: {
      counterparty: "Quem está sendo cobrado?",
      amount: "Qual é o valor da cobrança?",
      currency: "Qual é a moeda?",
      occurredAt: "A qual data esta cobrança se refere?",
      description: "Uma breve descrição (opcional).",
    },
    record_purchase: {
      supplier: "De qual fornecedor você comprou?",
      amount: "Qual é o valor da compra?",
      currency: "Qual é a moeda?",
      occurredAt: "Qual é a data da compra?",
      description: "O que foi comprado? (opcional)",
    },
  },

  status: {
    gathering: "Coletando informações",
    awaiting_confirmation: "Aguardando confirmação",
    submitted: "Enviado",
    accepted: "Aceito",
    rejected: "Rejeitado",
  },

  events: {
    "intent.started": "Iniciado",
    "slot.answered": "Respondido",
    "slot.rejected": "Resposta inválida detectada",
    "intent.submitted": "Enviado ao Ledger",
    "intent.accepted": "Aceito",
    "intent.rejected": "Rejeitado",
  },

  messages: {
    "Enter a valid amount, e.g. 1500.00.":
      "Informe um valor válido, ex.: 1500.00.",
    "Amount must be greater than zero.": "O valor deve ser maior que zero.",
    "Enter a valid date.": "Informe uma data válida.",
    "Flagged for manual review (description contains 'test').":
      "Sinalizado para revisão manual (a descrição contém 'test').",
    "Duplicate: this intent was already submitted to the Ledger.":
      "Duplicado: esta intenção já foi enviada ao Ledger.",
  },
});
