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

    dash_classification: "Saúde de classificação",
    dash_uncategorized: "Pagamentos sem categoria",
    dash_share: "Participação",
    dash_oldest: "Mais antigo",
    dash_days: "{n} dias",
    dash_aging_fresh: "≤ 30 dias",
    dash_aging_recent: "31–90 dias",
    dash_aging_stale: "> 90 dias",
    dash_classification_hint:
      "Saídas registradas sem uma categoria específica. Promova-as a uma operação dedicada (ex.: Folha de pagamento) para reduzir este número.",
    dash_unavailable:
      "Não foi possível carregar os dados do Ledger no momento.",
    dash_empty: "Nenhum registro.",
    col_date: "Data",
    col_recorded: "Data do registro",
    col_type: "Tipo",
    col_amount: "Valor",
    col_counterparty: "Contraparte",
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
    register_payment: {
      title: "Registrar pagamento geral",
      description: "Registrar uma saída de caixa geral, não coberta por uma operação específica (ex.: fornecedor). Use uma operação específica quando existir (ex.: Folha de pagamento).",
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
      description: "Registrar um adiantamento concedido pela usina a um corretor ou parceiro (saída de caixa; origina um adiantamento a ser liquidado depois).",
    },
    register_loan: {
      title: "Registrar concessão de empréstimo",
      description: "Registrar um empréstimo concedido pela usina a um corretor (saída de caixa; origina um empréstimo a receber, a ser pago depois).",
    },
  },

  slots: {
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
      kind: "É um incentivo ou um bônus?",
      amount: "Qual é o valor?",
      currency: "Qual é a moeda?",
      occurredAt: "Em que data foi pago?",
      description: "Uma breve descrição (opcional).",
    },
    register_advance: {
      payee: "Quem está recebendo o adiantamento (corretor ou parceiro)?",
      amount: "Qual é o valor do adiantamento?",
      currency: "Qual é a moeda?",
      occurredAt: "Em que data o adiantamento foi concedido?",
      description: "Uma breve descrição (opcional).",
    },
    register_loan: {
      payee: "Quem está recebendo o empréstimo (tomador)?",
      amount: "Qual é o valor do empréstimo?",
      currency: "Qual é a moeda?",
      occurredAt: "Em que data o empréstimo foi concedido?",
      description: "Uma breve descrição (opcional).",
    },
  },

  status: {
    gathering: "Coletando informações",
    awaiting_confirmation: "Aguardando confirmação",
    awaiting_correction: "Aguardando correção",
    submitted: "Enviado",
    accepted: "Aceito",
    rejected: "Rejeitado",
  },

  events: {
    "intent.started": "Iniciado",
    "slot.answered": "Respondido",
    "slot.rejected": "Resposta inválida detectada",
    "intent.submitted": "Enviado ao Ledger",
    "intent.correction": "Correção necessária",
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
