# Treasury — Requisitos Refinados

> **Retomando o trabalho?** Comece por **§16.1 — Onde paramos e o que decidir**.
>
> **Escopo desta versão.** Documenta o **que o Treasury já faz hoje**, na linguagem do negócio:
> a fronteira com o Ledger, o catálogo de operações, a coleta guiada, o envio, a recusa, a
> correção e a retificação, as consultas, a entrada por texto livre e o acesso.
> **Fica fora desta versão:** o módulo de cadastro mestre (MDM) de contrapartes; a visão por
> pessoa e por grupo de pessoas, com encadeamento (deixada **pronta para a próxima rodada**,
> `DEC-001`); aprovação em duas etapas (`DEC-004`); os novos estados e entidades que virão com o
> MDM (`DEC-007`, `DEC-008`).
> A seção **Contrapartes (§5) já nasce depreciada**: o MDM vai substituí-la.
>
> **Rodada do cadastro de partes (2026-11-04, fechada).** Cobre o cadastro de partes (§5, que
> substitui Contrapartes) e a visão por pessoa e grupo (§8.2). O repasse de comissão (§4.4) foi
> **adiado** até ter um ciclo na álgebra do Ledger (`DEC-017`; saiu de "adiado" na rodada 12). O nome "MDM" não é usado nas regras; o termo de negócio é **cadastro de
> partes** (`Q-046`).
>
> **Rodada das operações compostas (2026-11-06).** §4.4, §4.5, §8.3, `REQ-525`, `REQ-805` e `REQ-806`
> registram regras decididas. **Já implementados:** `REQ-253`, `REQ-254` e `REQ-525`. O restante e o
> próximo passo estão em §16.
>
> **Rodada da página da parte (2026-11-12, rodada 18).** §8.4 registra a página de cada parte, com operação,
> histórico e resultados, que responde à `DEC-030`. Operação e Histórico implementados e refinados
> (commit `6b9ad7c`); Resultados depende do passo 6. O que falta está em §16.1, "Para a retomada".
>
> **Rodada da primeira versão (2026-11-13, rodada 19).** Descoberta de produto com o dono do produto: quem
> é a equipe financeira, o que dói e o que é a primeira versão utilizável. **§18 passa a definir a ordem do
> trabalho** até essa versão, com o TODO priorizado (PRI-0, PRI-1, PRI-2). Nenhuma regra foi revogada.
>
> **Rodada do sistema de seguro (2026-11-09).** §4.6 registra como o Treasury absorve o que o sistema
> de seguro sabe: sinal externo, fatos propostos e só expectativas. Implementados os blocos A a D, a
> integração (rodada 15) e a lista de sinais (`REQ-280`); o bloco E foi adiado.
>
> **Fonte — diário de decisões**
>
> | Data | Rodada | O que aconteceu |
> | --- | --- | --- |
> | 2026-11-03 | 0 — leitura | Leitura do código em `treasury/` e do `CLAUDE.md` da raiz. Entregues: entendimento (a.1–a.8), entidades, fluxos e estados, perguntas `Q-001`–`Q-010` e esqueleto. Nenhum requisito foi escrito. |
> | 2026-11-03 | 1 — respostas | O dono do produto respondeu `Q-001`–`Q-010` e aprovou o esqueleto. **Decidido:** anexo com os termos do Ledger (`Q-001`); catálogo aberto, que cresce com a álgebra do Ledger (`Q-002`); empresa única, a Usina (`Q-003`); dois papéis (`Q-004`); visão por pessoa ou grupo fica para a próxima rodada (`Q-005`); os estados "rascunho" e "confirmada" ficam registrados como não utilizados (`Q-006`); até 2 casas, arredondamento pela ABNT NBR 5891 e moeda padrão BRL (`Q-007`); contraparte não identificável só em comissão recebida, com cobrança de complemento (`Q-008`); alcance da retificação confirmado (`Q-009`); texto livre é requisito e a classificação será revista (`Q-010`). **Também decidido:** a seção Contrapartes nasce depreciada; a criação de contraparte durante a operação deixa de ser o caminho desejado. Nada foi revogado nesta rodada. |
> | 2026-11-03 | 2 — respostas | **Decidido:** o entendimento a.1–a.8 vale como confirmado (`Q-011`); valor com mais de 2 casas é recusado e o sistema sugere o arredondado pela NBR 5891 (`Q-013`); BRL padrão e entrada no formato brasileiro (`Q-014`); valor maior que zero e sem teto (`Q-015`); limiar de confiança 0,5 vale agora (`Q-016`); as 17 fichas de §4.1 foram confirmadas (`Q-017`); toda operação é auditada permanentemente, com o autor identificado (`Q-019`); datas no fuso de São Paulo (`Q-020`); pré-preenchimento da contraparte só nas três operações atuais (`Q-022`). **Continua em aberto:** quais consultas são requisito (`Q-018` → `DEC-009`). **Reformuladas com exemplos**, por não terem ficado claras: `Q-012` e `Q-021`. **Ficou sem resposta:** a data futura (parte de `Q-020` → `Q-025`). Nada foi revogado. |
> | 2026-11-03 | 3 — respostas | **Decidido:** quem aparece como parte em cada registro fica para a rodada do MDM (`Q-012` → `DEC-010`); o usuário pode corrigir na prévia antes de enviar, e o estado "aguardando confirmação" passa a se chamar **"pronta para envio"** (`Q-021`); só BRL até surgir requisito de outra moeda (`Q-023` → `DEC-011`); a auditoria cobre só o que é operação, e os logs de comportamento da conversa ficam em aberto (`Q-024` → `REQ-804`, `DEC-012`); data de ocorrência futura é recusada, e a provisão ou lançamento futuro fica em aberto (`Q-025` → `REQ-226`, `REQ-227`, `DEC-013`); máscara de digitação em centavos e proibição da convenção brasileira fora da digitação e exibição (`REQ-224`, `REQ-228`). **Alterado:** `REQ-224` (antes: "ponto separa milhar, vírgula separa decimais", com o exemplo "2.000 → 2.000,00 ⚠"; agora: máscara que preenche a partir dos centavos, em que "2000" → R$ 20,00). **Contradição levantada:** com a máscara em centavos, não dá para digitar mais de 2 casas, e `REQ-221` deixa de ter onde se aplicar na coleta guiada (`Q-026`). |
> | 2026-11-03 | 4 — respostas | **Confirmados todos os `⚠ CONFIRMAR` pendentes** (`Q-027`–`Q-035`): resposta inválida não é registrada (`REQ-211`); envio só após a prévia e o clique em "enviar" (`REQ-213`); a intenção aceita guarda a referência do fato, para consultar o caderno (`REQ-501`); na correção pode-se mudar **qualquer campo** (`REQ-510`); a retirada não apaga o original (`REQ-524`); o campo não aplicado do texto livre é perguntado (`REQ-703`); auditoria = quem, quando e o quê (`REQ-803`); estorno ≠ retificação (§2); as três notas de §4.1. **Novo:** premissa "a Usina vive de exceções" (§1); abrir o caderno a usuários contábeis vira `DEC-014`. **Continua sem resposta:** `Q-026`. Nada foi revogado. |
> | 2026-11-03 | 5 — fechamento | `Q-026` respondida com a opção **A**: `REQ-221` vale para toda entrada que não passa pela máscara, como o texto livre (**alterado**; antes valia para valor "digitado"). O dono do produto **declarou atingido o critério de parada** da documentação do que existe. |
> | 2026-11-04 | 6 — cadastro de partes | Depois de uma conversa de pesquisa (referências de mercado sobre cadastro mestre, ledgers e grupos), o dono do produto respondeu e **decidiu**: as partes vêm de um sistema separado, de planilhas e de anotações pessoais, e são cerca de 250; a carga é feita pelo próprio Treasury, não pelo `validators/`; só um usuário com poder de curadoria cadastra partes; parte não cadastrada → o fato é registrado com **identidade provisória** e incômodo visual persistente; o mapeamento de identidade fica **no Treasury, só de acréscimo**; o passado é mapeado, não corrigido ("o Treasury auxilia, o Ledger canoniza"); grupo: a priori uma empresa, uma pessoa pode estar em vários, e a relação nasce no **evento**; a visão por grupo é para **filtrar e enxergar**; sugestão a partir do **último evento**; o cliente final é **contexto**; Unimed, João e Argo são partes cadastradas; o fluxo do repasse de comissão foi descrito. **Retirado:** o comportamento antigo de contrapartes (criar parte durante a operação), substituído por `REQ-311`/`REQ-320`. **Abertas:** `Q-036`–`Q-046`. |
> | 2026-11-04 | 7 — respostas e fechamento | **Decidido:** não identificável e provisória são coisas diferentes, e as duas continuam com a mesma notificação (`Q-036`); a curadoria é uma **permissão** dada a um usuário que já tem outro papel (`Q-037`); resolver uma provisória = **ligá-la a uma parte já cadastrada** (`Q-038`); todos veem a notificação (`Q-039`); grupo = parte do tipo empresa, por enquanto (`Q-040`); o filtro mostra **todos** os eventos em que a parte tem algum papel (`Q-041`); CPF/CNPJ obrigatório para quem recebe ou paga por conta bancária (`Q-042`); eventos do sistema externo **esperam a confirmação** de um usuário, e uma parte com dúvida vira provisória (`Q-044`); nome "cadastro de partes" confirmado (`Q-046`). **Adiado:** o repasse sai desta rodada, porque precisa antes de um ciclo próprio na álgebra do Ledger (`Q-043` → `DEC-017`). **Viraram decisão pendente:** desfazer uma ligação errada (`DEC-015`), a insistência da notificação ao longo do tempo e se ela bloqueia algo (`DEC-016`), a conciliação bancária (`DEC-018`). **Os `⚠ CONFIRMAR` restantes ficam para outra rodada.** O dono do produto **declarou fechado o ciclo** do cadastro de partes, para começar a planejar os primeiros testes. |
> | 2026-11-06 | 8 — decisões da implementação | **Decidido:** os passos da conversa ficam fora da auditoria, num log separado que serve à tela de histórico (`REQ-804`, `DEC-012` segue aberta); a semelhança de nomes não confirma nem escolhe, mas a busca do operador pode listar nomes parecidos para ele escolher (`REQ-311`); a coluna e a linha de saldo calculadas na tela saem, e as barras diárias de entrada e saída ficam, com aviso quando a lista vier cortada (`REQ-601`); a mesma pessoa não cadastrada reaproveita a identidade provisória quando o nome normalizado é igual (`REQ-320`). **Direção:** usar o sistema pela identidade das partes é mais interessante do que por eventos e posições; por enquanto **só se acrescenta**, e a grade de operações e as posições continuam (§1). Nada foi revogado. |
> | 2026-11-06 | 9 — decisões do cadastro | **Decidido:** dois cadastros com o mesmo nome exato são listados para o operador escolher, nunca o primeiro (`REQ-311`); "recebe ou paga por conta bancária" é um campo marcado por quem tem curadoria ao cadastrar (`REQ-314`). **Adiado:** a carga a partir das planilhas e do sistema separado, até essas fontes estarem disponíveis (§5, contexto). Nada foi revogado. |
> | 2026-11-06 | 10 — notificação | **Alterado:** a notificação cobre só identidades usadas em um fato que o Ledger aceitou (`REQ-321`). Nada foi revogado. |
> | 2026-11-06 | 11 — operações compostas | Discussão de arquitetura sobre eventos, partes e posições. **Decidido:** compensação é um único evento (`REQ-250`–`REQ-252`); a obrigação de comissão passa a existir sem caixa (`REQ-253`, `REQ-254`); a operação composta é do Treasury (`REQ-255`); o valor é definido pelo usuário e cada beneficiário tem a sua obrigação (`REQ-257`, `REQ-258`); "fluxo" não é uma unidade do sistema (`REQ-259`); a retirada cita todas as posições (`REQ-525`); o resultado é exposto por parte e por contexto, e a qualidade de um corretor é avaliação da direção (`REQ-620`–`REQ-627`). **Ficou em aberto:** `DEC-019`–`DEC-027`. **Alterado:** a segunda frase de `REQ-612` passa a falar só de grupo, e `DEC-017` foi parcialmente respondida. **Nada disso está implementado.** |
> | 2026-11-06 | 12 — fluxo do repasse | O dono do produto descreveu o fluxo da venda ao pagamento e aceitou as recomendações. **Decidido:** o repasse sai de "adiado" (`DEC-017`); o molde do evento não muda e o autor registrado diz quem anotou (`REQ-805`); confiança conforme a origem do conhecimento (`REQ-806`); o sinal externo só entra no Ledger depois da confirmação (`REQ-323`); extrato de recebível é o demonstrativo e não cria fato (`REQ-244`); qualquer operador registra o pagamento (`REQ-248`); lote é um evento por pessoa (`REQ-246`, `DEC-026`); anexo opcional, guardado no Treasury e auditado (`REQ-247`, `REQ-804`). |
> | 2026-11-07 | 13 — teste na tela e sistema de seguro | O dono do produto testou os passos 2 e 3 e achou o sistema ainda difícil para um leigo, com eventos desconexos das partes. **Corrigido:** data esperada da comissão prevista (`REQ-229`) e lista de seleção encoberta. **Levantado:** o sistema de seguro (Anexo B). **Em aberto:** `DEC-028`–`DEC-032` e `Q-047`–`Q-051`. A situação está em §16.1. |
> | 2026-11-09 | 14 — sinal externo do sistema de seguro | Discussão de negócio e arquitetura sobre como o Treasury absorve o que o sistema de seguro sabe, sem API. O dono do produto aceitou as recomendações. **Decidido:** o **sinal externo** é um conceito do Treasury, uma cópia imutável que nunca vai ao Ledger e gera um fato proposto por acontecimento (`REQ-260`, `REQ-261`); o sistema de seguro só gera expectativas, e a obrigação com o corretor nasce na elegibilidade (`REQ-262`, `Q-047`); a elegibilidade diz que a seguradora declarou ter pago, o que não é recebimento (`REQ-263`); o valor retido não é evento e isso fica explícito (`REQ-264`); referência da origem para evitar duplicidade (`REQ-265`); mudança na origem vira novo sinal (`REQ-266`); partes pelo id externo e apólice como contexto `contract` (`REQ-267`, `DEC-029`); o Treasury recomenda ligações e avisa o repasse sem entrada (`REQ-268`); quatro cenários de recebimento e conciliação opcional por lote (`REQ-269`, `Q-049`); obrigação inteira, com o adiantamento à mostra (`REQ-270`); data esperada opcional com alerta de pendência (`REQ-271`); nesta etapa o usuário preenche a partir da tela (`REQ-261`). **Em aberto:** alcance da retificação × ajuste (`DEC-033`), outros beneficiários vindos do sistema de seguro (`DEC-034`), elegibilidade por parcela (`Q-052`). **Depois, no mesmo dia:** ordem dos blocos (`DEC-031`); blocos A, B e C implementados; contextos fora da lista de posições (`DEC-035` → `REQ-605`); a elegibilidade também propõe a comissão prevista, com a seguradora como pagadora e a data da apólice (`REQ-272`–`REQ-274`, `DEC-010` em parte). **Alterado:** a tabela de `REQ-262` (antes, a elegibilidade propunha só a obrigação). **Corrigido:** id externo guardado com o cadastro de origem, depois que a seguradora e o corretor "123" viraram a mesma parte (`REQ-267`). **Decidido:** herdar o contexto e contar a história da apólice (`REQ-275`, `REQ-276`); bloco E adiado por não ser caso real; crédito da seguradora em lote, com o resto como recebimento sem origem (`REQ-277`); a lacuna de enriquecer a origem depois ficou em `DEC-036`. Nada foi revogado. |
> | 2026-11-09 | 15 — integração com o sistema de seguro | **Decidido:** só a elegibilidade é publicada; leitura a cada 5 minutos; RabbitMQ em servidor próprio, conectado por `.env`, fora do `docker-compose`. **Implementado:** produtor, contrato único, consumidor com descarte de leitura repetida e fila de mortas, autoria do sistema, aviso no menu (`REQ-278`, `REQ-279`). Falta validar com um broker de verdade. Nada foi revogado. |
> | 2026-11-11 | 16 — lista de sinais e commits | **Registrado:** a lista de sinais passou a ser paginada e, por padrão, mostra só o que ainda espera o usuário; o aviso do menu conta todos os sinais, não só a primeira página (`REQ-280`). **Commits:** blocos A a D (`0fd5a62`, 2026-11-09), integração (`874a260`, 2026-11-10) e lista de sinais (`308e90e`, 2026-11-11). Nada foi revogado. |
> | 2026-11-11 | 17 — lote, antecipação e compensação | Investigação dos cenários de lote ao corretor. **Confirmado:** o extrato bancário continua opcional, inclusive no lote (`REQ-247`). **Decidido:** um evento por obrigação quitada, inclusive várias da mesma pessoa, e pagamento parcial dentro do lote (`REQ-246`); o envio do lote não para num recusado (`REQ-249`). **Alterado:** `REQ-246` (antes, "um evento por pessoa"). **Em aberto:** `DEC-037`. Nada implementado; o Ledger não muda. **Depois, no mesmo dia:** aprovado o desenho do evento de compensação no Ledger e a compensação parcial (`REQ-250`, `CA-250c`, Anexo A); decididos os tipos iniciais: adiantamento e empréstimo contra obrigação de comissão (`DEC-025`, `REQ-251`); decidido o resultado da posição compensada: em dinheiro, compensado e baixado lado a lado, e "fechada por compensação" sem ganho nem perda (`REQ-624`); a exposição coberta só por expectativa ficou em `DEC-038`. A compensação está pronta para testes e implementação (passo 5). **Depois:** a perda parcial quando há compensação e baixa (`REQ-624`); "pessoa" → "parte" em `REQ-252`, com João × Argo em `DEC-022`; **implementada a compensação no Ledger**, validada por HTTP, sem commit. Nada foi revogado. |
> | 2026-11-12 | 18 — página da parte | Rodada de domínio da `DEC-030`. **Decidido:** página própria para toda parte, com três seções (operação, histórico, resultados), a lista de partes como entrada, o bloco "depende de" pelo mesmo contexto, os alertas em lista extensível, a prevenção do pagamento a mais pela divisão, o histórico em frases com sinais e as duas datas, o lote preparado e o extrato de recebível do lote (§8.4, `REQ-630`–`REQ-638`, `REQ-239`). **Confirmados:** os termos recebedor e destinatário final (§2) e a segunda frase de `REQ-612`. **Alterados:** `REQ-244` (antes, o extrato era de tudo o que está aberto, e precedia todo pagamento), `REQ-804` (passa a incluir o descarte do lote preparado), `REJ-244` (vale só para o lote; o segundo caso com o mesmo ID virou `REJ-244b`). **Respondidas:** `DEC-030`, `DEC-032`, `Q-048` (prevenção; o remédio foi para `DEC-033`). **Abertas:** `DEC-039` (visão comparativa), `DEC-040` (recomendação em chips), `DEC-041` (autenticação e autorização). Nada foi revogado. |
> | 2026-11-12 | 18 (cont.) — página da parte implementada e refinada | **Implementado e refinado na tela:** lista ordenada de partes → página própria com abas; Operação com uma seção por lado, filtros e paginação do Ledger, contagem sem total, "depende de" como indicador; Histórico com viés de auditoria (data de registro, quem registrou, quem retirou, filtros, paginação) e sinais pendentes num bloco no topo. **Decidido:** depois que o sinal vira fato, só o fato aparece (`REQ-636`); o Ledger publica quem retirou cada evento (§17, C1, feito). **Criados:** §17 "Antes de produção" (urgente para o deploy), `DEC-042` (filtros e paginação de leitura no Ledger), §1.1 "Valor do produto" e `DEC-043` (rotina financeira, modo interativo). **Removido da tela:** "Registrado também como". Commit do dono do produto: `6b9ad7c`. |
> | 2026-11-13 | 19 — primeira versão funcional | Descoberta de produto em duas rodadas (diagnóstico e priorização). **Confirmado:** a equipe (5 pessoas e os seus papéis), o volume (moda de ≈1.140 repasses e pagamentos por semana no 1º tri de 2026), as três instituições, o escopo (o financeiro inteiro), o prazo (versão avaliável ainda em 2026), que o passado pode ficar nas planilhas, que não há controle do a receber nem entregas periódicas, e que o sinal da operadora não é dinheiro na conta (§18.1). **Decidido:** a definição de primeira versão utilizável e o TODO priorizado (§18). **Abertos:** `DEC-044`, `DEC-045`, `Q-053`–`Q-056`. Nada foi revogado; muda só a prioridade. |
> | 2026-11-13 | 19 (cont.) — acesso | O dono do produto indicou um **molde de autenticação e autorização** como referência e decidiu as adaptações: três papéis, o molde inteiro sem o envio de e-mail, base limpa no piloto e o comando de criação de usuário só em desenvolvimento. **Decidido:** §6 reescrita a partir do molde, `REQ-807` (quem assina é quem está logado), `DEC-041`. **Alterado:** `REQ-401` (antes, dois papéis) e `REQ-638` (antes, "quem vê o quê" ficava em `DEC-041`). **Aberto:** o `⚠ CONFIRMAR` de `REQ-402` (o Administrador dá e retira a curadoria). Também nesta data: `TODO-04` feito. |
> | 2026-11-13 | 19 (cont.) — acesso confirmado | **Confirmados** os dois `⚠ CONFIRMAR` de §6: o Administrador tem acesso irrestrito, com a curadoria pelo papel (`REQ-401`, `REQ-402`, `CA-421`), e o comando do primeiro administrador recusa quando já existe um ativo (`REQ-405`). **Alterado:** `REQ-401` (antes, o Administrador dava a curadoria, mas não a tinha pelo papel). **Decidido:** a verificação das telas no navegador não fecha o `TODO-01`; ela acontece no piloto. **Princípio de trabalho:** refinar só diante de uma necessidade concreta, não de uma possibilidade de melhoria. `TODO-01` feito. |
> | 2026-11-13 | 19 (cont.) — backup | **Decidido:** a cópia fora da máquina vai ao Cloudflare R2 que a Usina já usa, sob prefixo próprio, guardando as 30 mais recentes. `TODO-02` feito. Nada foi revogado. |
> | 2026-11-13 | 19 (cont.) — agenda a pagar | **Decidido:** não há prazo combinado para pagar o corretor depois da elegibilidade, então o repasse fica em "sem vencimento" (§8.5); o Ledger publica a agenda por janela de vencimento, com os totais (`REQ-642`, `DEC-042` item 1 em parte). **Novo:** §8.5 (`REQ-640`–`REQ-645`, `CA-640`–`CA-645`, `REJ-641`, `REJ-642`). **`TODO-05` feito; E2 fechado.** §17 C2 resolvido. Nada foi revogado. |
> | 2026-11-13 | 19 (cont.) — volume | **`TODO-03` feito:** um mês à volumetria real (≈1.150 pagamentos e repasses por semana, 12.330 fatos); as telas do dia ficaram abaixo de 1 s, sem mudança. **E1 fechado.** O que cresce com o livro foi para §17, com os números. Nada foi revogado. |
> | 2026-11-13 | 19 (cont.) — pagamentos do dia | **Decidido:** a `DEC-044`: o fato de caixa cita a instituição como contexto (`cash_account`), no máximo uma, nunca num fato sem dinheiro; sem ela, "instituição desconhecida", e os eventos anteriores ficam assim, nunca distribuídos. A transferência entre instituições fica para o E6. **Novo:** §8.6 (`REQ-650`–`REQ-654`, `CA-650`–`CA-654`, `REJ-650`, `REJ-650b`, `REJ-653`). **Ampliado:** `REQ-239` (o lote também é montado na agenda, de vários credores). **`TODO-08` feito; E3 fechado.** §17 R1 resolvido. Nada foi revogado. |
>
> **Versão anterior.** Não existe versão anterior deste documento. Os textos já presentes em
> `treasury/docs/` (`treasury_api_reference.md`, `treasury_identity_enrichment.md`,
> `treasury_object_continuity.md`) são **material de registro e não fonte da verdade**. O código
> também não é fonte da verdade: a comparação com ele acontece depois da validação deste documento.
>
> **Marca `⚠ CONFIRMAR`.** Indica um trecho que derivei por encadeamento lógico e que o dono do
> produto não disse com todas as letras. **Não é regra até ser confirmado.** Todos aparecem
> reunidos em §15.
>
> **Convenção de identificadores.** Um ID nunca é reutilizado. Uma regra retirada continua citada
> como retirada.
>
> | Prefixo | Significado |
> | --- | --- |
> | `REQ-nnn` | Requisito / regra de negócio |
> | `CA-nnn` | Critério de aceitação |
> | `REJ-nnn` | Caso que **deve ser rejeitado** |
> | `FA-nnn` | Fluxo alternativo |
> | `EX-nnn` | Exceção |
> | `DEC-nnn` | Decisão pendente (sequencial) |
> | `Q-nnn` | Pergunta em aberto (sequencial) |
> | `FP-nn` | Fluxo principal |
> | `TODO-nn` | Item do plano da primeira versão (§18) |
>
> | Série | Bloco |
> | --- | --- |
> | `1xx` | Fronteira Treasury × Ledger |
> | `2xx` | Operações e coleta guiada (bloco principal) |
> | `3xx` | Cadastro de partes (substitui Contrapartes, depreciado) |
> | `4xx` | Acesso |
> | `5xx` | Envio, recusa, correção e retificação |
> | `6xx` | Consultas |
> | `7xx` | Entrada por texto livre |
> | `8xx` | Auditoria e rastro |
>
> `CA-`, `REJ-`, `FA-` e `EX-` usam a mesma série do `REQ` que verificam.

---

## 1. Premissas centrais

**O Ledger é o caderno canônico; o Treasury é o sistema simples de operar.** O Ledger registra
tudo com viés contábil e financeiro, é imutável e tem altíssima confiança. O Treasury traduz isso
para uma linguagem de alto nível (linguagem natural), e assim quem opera não precisa aprender a
álgebra do Ledger.

**O Ledger é descritivo, não normativo.** Se uma operação produz déficit ou perda, o Ledger a
registra e a expõe. O Treasury facilita tudo o que o Ledger diz ou produz; ele não filtra o que
é desconfortável.

**O catálogo de operações é aberto.** As operações atuais são as que já foram mapeadas. A Usina
tem eventos que fogem das regras convencionais, então novas operações vão surgir, inclusive
operações de perda. Cada uma precisa existir antes na álgebra do Ledger.

**A Usina vive de exceções; o Ledger as transforma em regras de primeira ordem.** Já não é
possível acrescentar regras normativas à operação da Usina. O Ledger elimina o enrijecimento
normativo: cada fluxo novo entra como fluxo de **primeira ordem**, com suas próprias arestas e
ciclo de vida, e não como exceção.

**A operação atual ainda é complexa para quem usa.** O Treasury de hoje mostra posições e cria
eventos. A direção já declarada (fora desta versão) é mostrar **pessoas e ações**: o usuário vai
à pessoa ou ao grupo, e o Treasury monta por baixo o esquema que o Ledger exige (`DEC-001`).
Por decisão de 2026-11-06, esse caminho é **acrescentado**: a usabilidade atual não foi invalidada, e o
que for removido ou alterado depois será decidido pelo dono do produto.

### 1.1 Valor do produto: o que um setor financeiro profissional precisa ter ao alcance

> Aprovada pelo dono do produto em 2026-11-12.

O Ledger é o caderno factual: registra o que aconteceu, imutável, sem prever nem normatizar. Mas quem
usa o produto é o setor financeiro, e para ele o produto — **Treasury + Ledger** — precisa ser
competente em tudo o que um financeiro profissional tem ao seu alcance. Esta lista é a régua desse
valor: diz o que o produto já cobre, o que falta e onde cada coisa deve morar.

**Regras da lista**
- Cada competência mora em um lugar: no **Ledger** (fato e consequência financeira imediata), no
  **Treasury** (operação, leitura, controle, documento) ou **fora do produto**, por decisão do dono
  do produto (por exemplo, a contabilidade formal pode ficar com o contador). "Fora" é uma decisão
  registrada, nunca um esquecimento.
- Nada aqui muda a constituição do Ledger. Fechar um mês, conciliar ou exportar para a contabilidade
  são **leituras e controles** sobre fatos imutáveis: nenhum deles reescreve um fato nem acrescenta
  regra normativa ao Ledger.
- Um item entra, muda de lugar ou sai só com o aval do dono do produto, e a situação é atualizada
  quando algo é implementado. Os itens ⬜ e "a decidir" são mapeados na `DEC-043`.

| Área | Competência | Por que o financeiro precisa | Onde mora | Situação |
| --- | --- | --- | --- | --- |
| Registro e prova | Registrar entradas, saídas, obrigações, comissões e repasses | É o trabalho de base | Ledger + Treasury | ✅ §4 |
| | Anexar comprovantes ao fato | Provar o que foi registrado | Treasury | 🔶 `REQ-247`, não implementado |
| | Nota fiscal e documento fiscal | Sustentar obrigação e imposto | A decidir | ⬜ nenhuma menção |
| | Trilha de auditoria (quem fez o quê) | Responder a auditor e a sócio | Treasury | ✅ §10, histórico com autor (§8.4) |
| Pagar e receber | Agenda do que vence: a pagar e a receber | Planejar o dia e a semana | Treasury (leitura) | 🔶 a pagar no painel; a receber ⬜ |
| | Pagamento em lote com extrato de recebível | Pagar dezenas de repasses de uma vez | Treasury | 🔶 lote montado na agenda e pago ✅ (§8.6); extrato de recebível (`REQ-244`) e recibos (`REQ-245`) não |
| | Cobrança e recuperação (adiantamento, empréstimo) | Trazer de volta o que a parte deve | Treasury | 🔶 ações da posição; sem rotina de cobrança |
| Caixa e banco | Posição e extrato de caixa | Saber quanto há e por quê | Ledger | ✅ |
| | Conciliação bancária (banco × livro) | Garantir que o livro bate com o banco | Treasury | ⬜ `DEC-018` |
| | Importar extrato bancário (OFX/CNAB) | Não digitar o que o banco já sabe | Treasury | ⬜ |
| Correção | Retificação (o que nunca aconteceu) | Corrigir sem apagar | Ledger + Treasury | ✅ §7.3 |
| | Estorno | Desfazer um pagamento real | A decidir | 🔶 `DEC-033` |
| | Compensação (encontro de contas) | Quitar uma dívida com outra | Ledger + Treasury | 🔶 Ledger ✅; Treasury no passo 7 |
| Resultado e fechamento | Resultado por parte e por contexto | Saber quem e o que dá lucro ou prejuízo | Ledger (leitura) | 🔶 passo 6 |
| | Fechamento de período (mês) | Congelar a leitura de um mês e comparar | Treasury (leitura datada) | ⬜ |
| | Relatórios do período | Prestar contas à direção | Treasury | ⬜ depende do passo 6 |
| Fiscal | Obrigação e pagamento de imposto | Cumprir o fisco | Ledger + Treasury | ✅ catálogo |
| | Retenções sobre comissões e repasses | Pagar o líquido certo e recolher o resto | A decidir | ⬜ |
| Contabilidade | Plano de contas e exportação ao contador | Entregar o mês sem retrabalho | Treasury ou fora | ⬜ |
| Controles | Papéis (gestor, visualizador, curadoria) | Cada um faz só o que pode | Treasury | ✅ §6 |
| | Aprovação em duas etapas e segregação de funções | Quem registra não é quem aprova o pagamento | Treasury | ⬜ `DEC-004`, `DEC-041` |
| Continuidade | Backup e restauração | Não perder o livro | Infraestrutura | ✅ `TODO-02`: cópia diária no R2 |
| | Desempenho e resiliência em produção | Não travar com volume real | Ambos | ⬜ §17 |
| Rotina | Mapa da rotina diária, semanal e mensal | Saber se o produto cobre o dia real | Documento | ⬜ `DEC-043` |

Legenda: ✅ coberto · 🔶 em parte ou só decidido · ⬜ ausente. A confirmar na `DEC-043`: adiantamento a
fornecedor, centro de custo, orçamento × realizado e várias contas bancárias.

O corte da primeira versão sobre esta lista, feito com o dono do produto em 2026-11-13, está em §18.
Ele responde em parte à `DEC-043`: a rotina do CFO está em §18.1, e as demais rotinas ficam para o piloto
(`TODO-13`).

---

## 2. Glossário

| Termo | Definição |
| --- | --- |
| **Usina** | A empresa que o Treasury representa. Negocia com pessoas, empresas e serviços. |
| **Ledger** | O caderno canônico, imutável e de alta confiança, onde ficam os fatos financeiros. Só ele decide se algo vira fato. |
| **Treasury** | O sistema que traduz a operação do usuário para o Ledger e mostra ao usuário o que o Ledger registrou. |
| **Álgebra do Ledger** | O conjunto de operações financeiras que o Ledger sabe calcular. Uma operação só existe no Treasury se existir nessa álgebra. |
| **Operação** | Um tipo de acontecimento financeiro que o usuário pode registrar (ex.: folha, adiantamento). |
| **Campo** | Uma informação que a operação precisa, feita como pergunta na conversa. |
| **Intenção** | A conversa em andamento para registrar **uma** operação. |
| **Candidato** | O que o Treasury monta a partir da intenção e envia ao Ledger: uma **proposta** de fato. |
| **Fato** | Um candidato que o Ledger aceitou. Imutável. |
| **Prévia** | A exibição, antes do envio, exatamente do candidato que será enviado. |
| **Contraparte** | Quem está do outro lado da operação com a Usina. |
| **Contraparte não identificável** | Contraparte declarada explicitamente como impossível de identificar. Não é uma contraparte ausente. |
| **Pendente de validação** | Uma movimentação que precisa de complemento futuro (ex.: contraparte não identificada). |
| **Posição** | Algo em aberto ou encerrado entre a Usina e alguém (um adiantamento, um empréstimo, uma comissão a receber), como o Ledger o projeta. |
| **Movimento de caixa** | Uma entrada ou saída de dinheiro registrada no Ledger. |
| **Origem** | O fato que deu início àquilo que uma operação está quitando (ex.: o adiantamento que uma recuperação quita). |
| **Recusa corrigível** | Recusa do Ledger que o usuário resolve corrigindo um campo. |
| **Recusa definitiva** | Recusa do Ledger que encerra a intenção (duplicado ou erro interno). |
| **Retificação** | Declaração de que um lançamento registrado **nunca aconteceu**. |
| **Retirada** | O primeiro passo da retificação: o lançamento deixa de contar, mas continua no histórico. |
| **Reemissão** | O segundo passo, opcional, da retificação: registrar o que de fato aconteceu. |
| **Estorno** | Desfazer algo que **aconteceu**. |
| **Parte** | Pessoa ou empresa com relacionamento financeiro com a Usina, direto ou indireto, registrada no cadastro de partes. |
| **Cadastro de partes** | A lista de partes mantida pelo Treasury. Substitui o antigo diretório de contrapartes. |
| **Curadoria** | A permissão de cadastrar partes e resolver identidades provisórias. É dada a um usuário que já tem outro papel. |
| **Usuário** | Pessoa da Usina com acesso ao Treasury. Entra com o e-mail e é referenciada pelo id (`REQ-400`). Não é uma parte: uma parte é com quem a Usina tem relação financeira. |
| **Administrador** | O papel que, além de operar, faz a gestão de usuários (`REQ-401`). |
| **Convite** | Link de uso único, válido por 72 horas, pelo qual a pessoa conclui o cadastro e define a senha (`REQ-420`). |
| **Sessão** | O acesso aberto pelo login. Guardada no servidor; expira 12 horas depois do login (`REQ-412`). |
| **Identidade provisória** | A identidade dada a alguém **ainda não cadastrado**, para que o fato possa ser registrado. Fica pendente até ser resolvida. |
| **Mapeamento de identidade** | O registro, no Treasury, de que identificadores diferentes são a mesma parte. Só de acréscimo. |
| **Grupo** | Por enquanto, uma **parte do tipo empresa** (razão social, CNPJ). Não existe conceito separado de grupo (`Q-040`). |
| **Recebedor** | Quem recebe o dinheiro na conta (ex.: a Argo). Confirmado em 2026-11-12. |
| **Destinatário final** | A quem o dinheiro de fato se destina (ex.: o João). Confirmado em 2026-11-12. |
| **Contexto** | Informação que descreve um evento sem ser parte dele (ex.: o cliente final, o plano). |
| **Repasse** | A parte de uma comissão recebida que a Usina passa a outra parte. |
| **Demonstrativo de recebimento** | Documento que mostra o que alguém vai receber, emitido **antes** do pagamento bancário. |
| **Recibo de pagamento** | Documento emitido **depois** do pagamento bancário, com os dados do evento. |
| **Compensação** | Um único acontecimento, sem caixa, que reduz pelo mesmo valor algo a receber e algo a pagar. |
| **Obrigação de comissão** | O que a Usina reconhece dever a alguém a título de comissão, antes de qualquer pagamento. |
| **Operação composta** | Uma ação do usuário que resulta em vários fatos, cada um verdadeiro por si só. Existe só no Treasury. |
| **Resultado conhecido** | O que os fatos registrados mostram até agora, junto com o que continua aberto. Não afirma que nada mais vai acontecer. |
| **Página da parte** | A página de uma parte, com o que está em aberto com ela, a história em frases e os resultados (§8.4). |
| **Depende de** | Uma expectativa que cita o mesmo contexto de uma posição da parte (ex.: a comissão que a Allianz deve na apólice de que sai o repasse do Halisson). |
| **Lote preparado** | Obrigações escolhidas para um pagamento bancário, antes de o banco pagar. Rascunho do Treasury, nunca fato (`REQ-239`). |
| **Sinal externo** | O que um sistema externo (ex.: o sistema de seguro) disse, guardado no Treasury como cópia imutável. Não é fato e nunca vai ao Ledger (§4.6). |
| **Fato proposto** | Uma intenção já preenchida a partir de um sinal externo, à espera da confirmação de um usuário. |
| **Elegibilidade** | A declaração, no sistema de seguro, de que a seguradora registrou ter pago a Usina e de que o corretor já pode receber a sua parte. |
| **Valor retido** | O que fica com a Usina numa apólice: a comissão prevista menos a obrigação com o corretor. É uma diferença, não um evento. |

> **Compensação e saldo positivo não são sinônimos.** A compensação é um evento entre posições. Já
> "a venda grande compensou as ruins" ou "a Maria compensa outros corretores" descreve um resultado
> que se lê nos totais, sem nenhum evento próprio.
>
> **Intenção, candidato e fato não são sinônimos.** A intenção é a conversa. O candidato é a
> proposta que sai dela. O fato é o candidato que o Ledger aceitou.
>
> **Retificação e estorno não são sinônimos.** A retificação diz que o lançamento nunca
> aconteceu. O estorno desfaz algo que aconteceu.
>
> **Não identificável e provisória não são sinônimos.** Não identificável: não se sabe quem é.
> Provisória: sabe-se quem é, mas a parte ainda não está cadastrada.
>
> **Recebedor e destinatário final não são sinônimos.** No repasse ao João pela conta da Argo, a
> Argo é a recebedora e o João é o destinatário final.
>
> **Origem e posição não são sinônimos.** A origem é um **fato** anterior. A posição é aquilo que
> esse fato abriu e que outros fatos movimentam.
>
> **Extrato de recebível e extrato bancário não são sinônimos.** O extrato de recebível é o documento
> que o Treasury gera com o que uma pessoa tem a receber. O extrato bancário é o documento do banco,
> que comprova que o dinheiro saiu e pode ser anexado.
>
> **Sinal externo e fato não são sinônimos.** O sinal é o que outro sistema disse; o fato é o que o
> Ledger aceitou depois que um usuário confirmou. "A Allianz diz que pagou" é sinal; "o crédito da
> Allianz entrou na conta" é fato.
>
> **Quem anotou e quem confirmou não são sinônimos.** Um sistema externo pode ter sinalizado o fato e
> um usuário ter confirmado. O evento diz quem anotou; a auditoria do Treasury diz quem confirmou.

---

## 3. Fronteira Treasury × Ledger

`REQ-101` O Treasury é a **porta de entrada humana** para o Ledger. O usuário descreve uma
operação, o Treasury monta um **candidato** e o envia. **Só o Ledger decide** se o candidato vira
fato.

`REQ-102` O Treasury **não esconde** déficit, perda ou qualquer outro resultado que o Ledger
produza. Ele os apresenta numa linguagem simples.

> Protege a natureza descritiva do Ledger: uma tradução que filtra o desconfortável deixa de ser
> tradução.

`REQ-103` O Treasury traduz o que o Ledger produz para linguagem de alto nível. O usuário opera
**sem precisar conhecer** a álgebra do Ledger.

`REQ-104` O Treasury representa **uma única empresa, a Usina**. Várias empresas ficam fora de
escopo.

`REQ-105` Da contraparte, ao Ledger **só chega o identificador**. Nome, documento e demais dados
ficam no Treasury.

> Protege o Ledger de guardar dados que mudam (um nome, um documento) dentro de fatos imutáveis.

---

## 4. Operações e coleta guiada — bloco principal

### 4.1 Catálogo de operações

`REQ-201` O catálogo de operações é **aberto**. Ele cresce à medida que a álgebra do Ledger
cresce, inclusive com operações que representam perda.

`REQ-202` O Treasury só oferece uma operação que **tem correspondente explícito** na álgebra do
Ledger.

> Protege contra um "fato" que o Ledger não sabe calcular.

`REQ-203` O catálogo atual tem as **17 operações** da tabela abaixo, com os campos e efeitos
indicados (confirmado em `Q-017`). Os termos do Ledger para cada uma estão no **Anexo A**. Quem
aparece como parte em cada registro será decidido na rodada do MDM (`DEC-010`).

| # | Operação | O que registra | Caixa | Efeito na posição | Contraparte | Campos obrigatórios | Campos opcionais |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Pagamento geral | Saída que não tem operação específica (ex.: fornecedor) | Sai | Quita uma obrigação a pagar | Quem recebe | recebedor, valor, moeda, data do pagamento | obrigação reconhecida que paga, descrição |
| 2 | Folha | Pagamento aos empregados | Sai | Quita folha | Quem recebe | recebedor, valor, moeda, data | obrigação reconhecida que paga, descrição |
| 3 | Infraestrutura | Custo operacional ou de infraestrutura | Sai | Quita custo de infraestrutura | Fornecedor | recebedor, valor, moeda, data | obrigação reconhecida que paga, descrição |
| 4 | Taxa de serviço | Taxa de serviço paga | Sai | Quita taxa de serviço | Fornecedor | recebedor, valor, moeda, data | obrigação reconhecida que paga, descrição |
| 5 | Imposto | Imposto pago | Sai | Quita imposto | Autoridade fiscal | recebedor, valor, moeda, data | obrigação reconhecida que paga, descrição |
| 6 | Multa | Multa ou penalidade paga | Sai | Quita multa | Autoridade ou contraparte | recebedor, valor, moeda, data | descrição |
| 7 | Incentivo / bônus | Incentivo **ou** bônus a corretor ou parceiro | Sai | Quita incentivo ou bônus | Corretor ou parceiro | recebedor, tipo (incentivo / bônus), valor, moeda, data | descrição |
| 8 | Adiantamento | Adiantamento a corretor ou parceiro | Sai | **Abre** um adiantamento | Corretor ou parceiro | recebedor, valor, moeda, data | descrição |
| 9 | Recuperação de adiantamento | Devolução de um adiantamento | Entra | Quita o adiantamento | Quem devolve | pagador, valor, moeda, data, **origem** | posição, descrição |
| 10 | Empréstimo | Empréstimo concedido a corretor | Sai | **Abre** um empréstimo | Tomador | recebedor, valor, moeda, data | descrição |
| 11 | Quitação de empréstimo | Pagamento de um empréstimo | Entra | Quita o empréstimo | Tomador | pagador, valor, moeda, data, **origem** | posição, descrição |
| 12 | Comissão prevista | Comissão que a Usina espera receber | Não move | **Abre** uma comissão a receber | Nenhuma | valor, moeda, data | descrição |
| 13 | Comissão recebida | Comissão que chegou | Entra | Quita a comissão a receber | Quem pagou (**aceita não identificável**, `REQ-301`) | pagador, valor, moeda, data | origem, posição, descrição |
| 14 | Pagamento direto ao corretor | A operadora pagou o corretor sem passar pela Usina | Não move | Quita a comissão a receber **e** o direito de comissão do corretor | Corretor | recebedor, valor, moeda, data | descrição |
| 15 | Renúncia de comissão | A Usina abre mão do direito de comissão de um corretor | Não move | Quita (renúncia) ou reverte (concessão indevida) o direito de comissão | Corretor ou parceiro | recebedor, base (renúncia / reversão), valor, moeda, data | descrição |
| 16 | Reconhecimento de obrigação | Algo que a Usina deve, estabelecido por fato externo (nota, folha fechada, imposto lançado) | Não move | **Abre** uma obrigação (folha, serviço, infraestrutura, imposto ou outra) | Credor | tipo, credor, valor, moeda, data em que foi estabelecida | vencimento, pagamento já registrado que ela explica, descrição |
| 17 | Retificação | Um lançamento que nunca aconteceu (§7.3) | Não move | Retira a contribuição do lançamento | — | lançamento a retificar, data em que o erro foi estabelecido | o que estabeleceu o erro, reemissão |

> **Comissão recebida sem origem.** O fato é registrado mesmo assim, como origem desconhecida e
> pendente de complemento. Nunca se inventa uma origem para ele.
>
> **Reconhecimento depois do pagamento.** Quando o pagamento chegou primeiro, o reconhecimento
> aponta para a posição desse pagamento e declara que o conhecimento chegou tarde. Nada é
> reescrito.
>
> **Vencimento vazio.** A obrigação fica sem vencimento conhecido. Ela nunca é tratada como
> vencendo hoje.

### 4.2 Coleta guiada

`REQ-210` Cada operação é uma **lista ordenada de perguntas**. O sistema sempre pergunta o
**próximo campo obrigatório vazio**.

`REQ-211` O sistema **valida a forma** de cada resposta. Uma resposta inválida **não é
registrada**, e o campo é perguntado de novo.

`REQ-212` Quando todos os campos obrigatórios estão preenchidos, o sistema mostra uma **prévia
exata**: o que a prévia mostra é **exatamente** o que será enviado.

`REQ-213` O envio só acontece **depois da prévia** e do clique do usuário em **"enviar"**.

`REQ-214` Com a prévia na tela (estado **pronta para envio**), o usuário **pode corrigir**
qualquer resposta antes de enviar. A resposta corrigida passa pela mesma validação (`REQ-211`), e
a **prévia é refeita**.

```
Prévia: folha de 1.500,00 em 09/07/2026
O usuário corrige o valor para 1.550,00 → nova prévia: folha de 1.550,00 em 09/07/2026
O que é enviado: 1.550,00 (nunca 1.500,00)
```

### 4.3 Valores, moeda, datas e limites

> Já decidido: até 2 casas decimais; mais de 2 casas é recusado com sugestão pela NBR 5891; só
> BRL; máscara de digitação em centavos; convenção brasileira só na digitação e exibição; valor
> maior que zero e sem teto; fuso de São Paulo; ocorrência não pode ser futura.

`REQ-220` Todo valor tem **no máximo 2 casas decimais**.

`REQ-221` Um valor com **mais de 2 casas** que chega **sem passar pela máscara** de `REQ-224`
(por exemplo, pelo texto livre) é **recusado**. O sistema **sugere** o valor
arredondado pela **ABNT NBR 5891**, e o valor só é registrado se o usuário **aceitar** a sugestão.

> Protege o que o usuário disse: o sistema nunca altera um valor em silêncio.
>
> **Alterado na rodada 5 (`Q-026`).** Antes: "um valor **digitado** com mais de 2 casas é
> recusado". Essa regra conflitava com a máscara em centavos (`REQ-224`), que não deixa digitar
> mais de 2 casas. Agora ela vale para toda entrada que não passa pela máscara.

```
Texto livre: "paguei 10,125 de taxa"
→ valor recusado; sugestão 10,12 (NBR 5891)
→ o usuário aceita → 10,12 registrado · não aceita → o valor é perguntado na máscara
```

```
Arredondar para 2 casas (NBR 5891), olhando o algarismo seguinte ao último conservado:
  < 5                          → mantém           10,124  → 10,12
  > 5                          → soma 1           10,126  → 10,13
  = 5 seguido de algo ≠ 0      → soma 1           10,1251 → 10,13
  = 5 seguido só de zeros      → fica par:
      último conservado par    → mantém           10,125  → 10,12
      último conservado ímpar  → soma 1           10,135  → 10,14
```

`REQ-222` A moeda é **BRL**. Outra moeda só entra quando surgir esse requisito (`DEC-011`).

`REQ-223` O valor deve ser **maior que zero**. **Não existe teto.** Zero e negativo são recusados.

`REQ-224` O campo de valor usa uma **máscara no formato brasileiro**, aplicada **à medida que se
digita**. Os dígitos preenchem **a partir dos centavos**.

```
Dígitos digitados, na sequência  → o campo mostra
5                                → R$ 0,05
2000                             → R$ 20,00
200000                           → R$ 2.000,00
150050                           → R$ 1.500,50
```

> Alterado na rodada 3. Antes: "ponto separa o milhar e vírgula separa as casas decimais", com o
> exemplo "2.000 → 2.000,00 ⚠". Agora a máscara preenche a partir dos centavos, e "2000" é
> R$ 20,00.

`REQ-228` A convenção brasileira (vírgula decimal, ponto de milhar, "R$") vale **somente na
digitação e na exibição**. Nos cálculos internos e em tudo o que é enviado ao Ledger, ela é
**proibida**: nenhum valor sai com vírgula, e o valor segue o formato que o Ledger exige.

> O Ledger guarda valores como inteiros (bigint). Um valor com vírgula na fronteira pode ser lido
> errado: "1,500" é um e meio ou mil e quinhentos?

`REQ-225` Todas as datas valem no **fuso de São Paulo** (horário de Brasília).

> Protege contra uma data que o usuário digitou como 10/07 ser gravada como 09/07 por causa de
> fuso.

`REQ-226` A **data de ocorrência não pode ser futura**. Ela é recusada se for posterior a hoje,
sendo "hoje" o dia no fuso de São Paulo (`REQ-225`). A data de hoje é aceita.

> Fatos não podem ser previstos: um pagamento futuro ainda não aconteceu. A necessidade de
> registrar uma **provisão** ou um **lançamento futuro** é real e fica em `DEC-013`.

```
Hoje: 03/11/2026 (São Paulo)
Folha paga em 03/11/2026 → aceita
Folha paga em 02/11/2026 → aceita
Folha paga em 10/11/2026 → recusada
```

`REQ-227` O **vencimento** de uma obrigação (reconhecimento de obrigação, §4.1) **pode ser
futuro**.

> O vencimento não é a data de um fato: é o que o documento que estabeleceu a obrigação diz.

`REQ-229` A **comissão prevista** tem duas datas: quando a expectativa **surgiu**, que é um fato e não
pode ser futura (`REQ-226`), e quando se **espera receber**, opcional e que pode ser futura.

```
Apólice emitida em 06/11/2026; comissão esperada para 15/12/2026
  surgiu em: 06/11/2026 · espera receber em: 15/12/2026 → aceita
Surgiu em 15/12/2026, com hoje em 06/11/2026 → recusada
```

### 4.4 Repasse de comissão

> Ficou fora da rodada do cadastro de partes (`Q-043`) até ter um ciclo próprio na álgebra do Ledger
> (`REQ-202`). **Saiu de "adiado" em 2026-11-06:** o ciclo e a definição do valor estão em §4.5, e as
> regras abaixo passam a valer. A conciliação linha a linha com o extrato bancário continua em
> `DEC-018`.

```
1. Comissão prevista: plano X da Unimed, cliente Y, corretor João   ← sistema externo ou usuário
2. Comissão recebida da Unimed                                       ← sistema externo ou usuário
3. O Treasury mostra o repasse → o usuário define quem recebe, quanto e como (ou que não há repasse)
4. Extrato de recebível de cada pessoa, para quem tem acesso ao banco
5. Pagamento bancário Usina → Argo, unitário ou em lote
6. Anotado como pago → recibo do evento + recibo-resumo (extrato bancário anexo, opcional)
```

`REQ-240` A comissão prevista e a comissão recebida podem chegar **sinalizadas pelo sistema
externo** (cadastro visto lá; comissão baixada lá) ou ser **informadas por um usuário** que soube
do fato por uma planilha, uma conversa ou um sistema ainda não integrado. O evento é o mesmo nos
dois casos; muda quem aparece como autor (`REQ-805`).

`REQ-241` Depois do recebimento de uma comissão, o Treasury **ajuda o usuário a organizar o repasse**
às partes envolvidas: corretores, supervisores e tributos. Pode não haver repasse.

`REQ-242` **Somente o usuário** define como o repasse acontece (ex.: o João recebe pela conta da
Argo). O Treasury **não decide**.

`REQ-243` O Ledger anota a forma do repasse definida pelo usuário, com recebedor e destinatário
final (`REQ-613`).

`REQ-244` O **extrato de recebível** (o demonstrativo de recebimento) é gerado a partir das
obrigações selecionadas para um **lote preparado** (`REQ-239`), é entregue a quem tem acesso ao banco e
**precede** o pagamento bancário do lote. Gerar o extrato **não cria fato** no Ledger: nada conta como
pago até o pagamento ser registrado. O pagamento de uma obrigação só, lançado direto da posição ou da
página da parte, **dispensa** o extrato.

> **Alterado na rodada 18 (2026-11-12).** Antes: "gerado para cada pessoa a partir do que está em aberto
> com ela" e precedendo todo pagamento. Uma foto de tudo o que está aberto não bate com um pagamento que
> quita só parte, e exigir um lote para pagar uma obrigação era atrito sem ganho de controle.

`REQ-239` **Lote preparado** (decidido em 2026-11-12). Antes do pagamento bancário, o usuário escolhe,
na página da parte, as obrigações e o valor de cada uma. O lote preparado é um **rascunho do Treasury**:
**não é fato** e nada vai ao Ledger. Ele aparece na página da parte. **Uma obrigação está em no máximo
um lote preparado** de cada vez. Se o banco não pagar, o usuário **descarta** o lote: as obrigações ficam
livres para outro lote, e o descarte é auditado (`REQ-804`). Quando o pagamento é anotado, o lote vira os
eventos de `REQ-246`.

```
Lote preparado para o Halisson: 10 obrigações, 1.180,00 → extrato de recebível entregue ao banco
  o banco paga → anotado como pago → 10 repasses (REQ-246)
  o banco não paga → descartado → as 10 obrigações voltam a poder entrar em outro lote
```

`REQ-245` Concluído o pagamento bancário, o usuário anota que **foi pago**, e só então o dinheiro
conta como saído da conta da Usina. O Treasury emite um **recibo de pagamento** com os dados do
evento e dos eventos relacionados, e um **recibo-resumo**, com o **extrato bancário** como anexo
opcional (`REQ-247`).

`REQ-246` Um **lote** é um único pagamento bancário que quita várias obrigações, da mesma pessoa, de
várias pessoas ou as duas coisas. Vira **um evento por obrigação quitada**, todos citando o mesmo
contexto de lote (`settlement_batch`). A soma dos eventos deve bater com o débito único no banco; quem
confere é o Treasury, antes de enviar, porque o Ledger não conhece o débito. O pagamento unitário é o
mesmo evento, sem o contexto de lote. Uma obrigação pode ser paga **em parte** dentro do lote: o
usuário define o valor (`REQ-257`) e o restante continua aberto e visível.

> **Alterado na rodada 17 (2026-11-11).** Antes: "um pagamento bancário para várias pessoas. Vira **um
> evento por pessoa**". Com várias obrigações da mesma pessoa, um evento por pessoa não funciona (nota
> abaixo). O Ledger não muda: o repasse já quita a obrigação, inteira ou em parte, e qualquer evento
> pode citar o lote.
>
> Um único evento não serve: ele conta o valor inteiro em cada posição que cita, então não representa
> posições de valores diferentes. Os vários eventos não fabricam fatos: cada um diz quanto da
> transferência real foi para cada obrigação, e o lote os liga a essa transferência.

```
Lote de 500,00: João 300,00 e Maria 200,00
  dois eventos, mesmo contexto de lote · soma 500,00 · caixa da Usina: -500,00
  obrigação do João aberta: 0,00 · obrigação da Maria aberta: 0,00

Lote de 1.200,00 ao Halisson: 10 obrigações de 120,00
  10 repasses, cada um quitando a sua obrigação e citando o mesmo lote
  soma 1.200,00 = débito no banco · caixa: -1.200,00 · as 10 obrigações com 0,00 em aberto

Lote com 100,00 numa obrigação de 120,00 → 20,00 continuam abertos nela
```

`REQ-249` **Envio do lote** (decidido em 2026-11-11). Os eventos do lote são enviados **todos**, um de
cada vez. Um evento recusado **não impede** o envio dos demais: cada um é um fato verdadeiro, porque o
dinheiro já saiu do banco ("a validade de um fato independe da sua linhagem", `CLAUDE.md`). O recusado
fica visível para ser corrigido, e a diferença entre o débito no banco e o que foi registrado aparece
no lote.

```
Lote de 1.200,00 ao Halisson; a obrigação nº 3 já tinha sido paga por outro operador
  o Ledger recusa o nº 3 · os outros nove são registrados (1.080,00)
  diferença com o banco: 120,00, exatamente onde está o problema (pago a mais, Q-048)
```

> Difere de `REQ-277`, em que o recebimento em lote da seguradora para no primeiro recusado. A
> diferença ficou em `DEC-037`.

`REQ-247` O **extrato bancário** é um anexo **opcional**, guardado **no Treasury**, com uma impressão
digital (hash) que permite provar que o arquivo não foi trocado. Pode ser anexado depois do
pagamento, e um mesmo arquivo pode valer para vários eventos. Anexar **não altera** o evento no
Ledger.

> **Confirmado em 2026-11-11 (rodada 17):** o extrato continua **opcional**, também no lote. O pagamento
> conta como feito quando é anotado (`REQ-245`), com ou sem extrato. Exigir o extrato desde o início
> dificultaria o uso; deixá-lo opcional permite questionar depois um pagamento que ficou sem ele.

`REQ-248` **Qualquer operador** pode registrar o pagamento, e a auditoria mostra quem foi. Se o uso
mostrar necessidade, isso vira uma permissão, como a de curadoria (`REQ-402`).

### 4.5 Compensação, obrigação de comissão e operação composta

> Decidido em 2026-11-06. **Implementados:** `REQ-253` e `REQ-254`; a compensação no Ledger (`REQ-250`, `REQ-251`,
> `REQ-624`) em 2026-11-11, ainda sem tela no Treasury (passo 7); o restante ainda não. O sistema é descritivo: o que não estiver
> mapeado no Ledger é criado e exposto, e quem movimenta os eventos é o usuário do Treasury. A
> compensação e a obrigação de comissão dependem de contrato novo no Ledger (`REQ-202`) e entram com
> os testes escritos antes do código, numa mudança isolada e fácil de remover enquanto nenhum fato
> real tiver sido gravado. Depois disso, remover significa só deixar de aceitar novos: um fato
> gravado continua no caderno.

`REQ-250` A compensação é **um único evento**, sem caixa, que cita duas ou mais posições pelo
**mesmo valor**. Se o valor não couber em alguma delas, o evento inteiro é recusado e nenhuma
posição muda.

> Protege contra metade de uma compensação: registrada como dois eventos, um lado poderia ficar
> quitado e o outro não.

```
Adiantamento 300,00 e obrigação de comissão 600,00 com o João. Compensação de 300,00:
  adiantamento em aberto: 0,00 · obrigação em aberto: 300,00 · caixa: não muda
Mesma compensação com obrigação de 200,00: recusada; nada muda.
```

A compensação pode ser **parcial** (decidido em 2026-11-11): "mesmo valor" quer dizer que os dois lados
descem pelo mesmo valor, não que um deles fecha inteiro. O usuário define o valor (`REQ-257`), até o
menor saldo aberto entre as posições citadas, e o restante continua aberto e visível.

```
Adiantamento 300,00 e obrigação 600,00 com o João. Compensação de 100,00:
  adiantamento em aberto: 200,00 · obrigação em aberto: 500,00 · caixa: não muda
```

> **Desenho no Ledger, aprovado em 2026-11-11 (rodada 17).** Um tipo de evento novo, `compensation`, sem
> caixa (`NON_CASH`), com motivo próprio (`compensation`). Cita cada posição com `settles` pelo valor do
> evento e, se houver, os contextos com `references` (`REQ-275`). Não exige `relatedEventId`: são duas
> posições com origens diferentes, e cada uma é identificada pelo seu id. O molde é o do pagamento direto
> ao corretor, que já quita duas posições sem caixa pelo mesmo valor. A recusa de quem não cabe já existe
> (a trava de conservação mede cada posição). Os termos estão no Anexo A. Tipos iniciais em `REQ-251`;
> a leitura da posição compensada em `REQ-624`.

`REQ-251` A compensação cita **pelo menos uma posição a receber e uma a pagar**. O Ledger exige
isso porque é o que define uma compensação: sem essa regra, duas dívidas sumiriam sem caixa. O lado
de cada tipo de posição vem da classificação do próprio Ledger. Os tipos iniciais (decididos em
2026-11-11, `DEC-025`) são adiantamento e empréstimo, a receber, contra obrigação de comissão, a pagar.
Outro tipo entra quando aparecer um caso real, com o seu teste; o desconto de adiantamento na folha
ainda não existe, porque o sistema não foi para produção.

`REQ-252` O Treasury oferece compensação apenas entre posições da **mesma parte**. O Ledger **não
bloqueia** outro caso, porque isso é qualitativo e não aritmético: ele não guarda um "dono" da posição,
e quem é a mesma parte é julgado pelo cadastro e pelo mapeamento do Treasury (`REQ-330`). Identificadores
ligados à mesma parte (`REQ-332`) contam como a mesma parte. A compensação entre partes diferentes fica
em `DEC-022`.

> Alterado em 2026-11-11: "pessoa" → "**parte**", porque uma parte pode ser uma empresa (CNPJ), e não só
> uma pessoa (CPF).

`REQ-253` A obrigação de comissão pode nascer **sem caixa**, com `obligation_recognized`, e segue o
mesmo ciclo das demais obrigações. O ideal é haver um fato por trás dela, como uma comissão a
repassar, mas **quem decide abri-la é o usuário**.

`REQ-254` A obrigação de comissão em aberto é **algo que a Usina deve**: entra no que a Usina tem a
pagar e **não** entra no que devem à Usina.

> Muda um número publicado: um saldo em aberto desse tipo que já exista troca de lado.

No Treasury, a obrigação é aberta em "Reconhecer obrigação a pagar", com o tipo **Comissão a
repassar**, e paga em **"Pagar repasse de comissão"**, que quita a mesma posição.

`REQ-255` Uma **operação composta** é um plano que o usuário confirma e que o Treasury envia ao
Ledger **em ordem**, um fato de cada vez. O Ledger não recebe lote nem identificador de operação.
Parar no meio não é inconsistência: cada fato enviado continua verdadeiro, e o histórico fica
incompleto de forma visível. A estratégia para retomar é `DEC-024`.

> O que precisa ser atômico é um único acontecimento, e isso já está em `REQ-250`. Um pagamento que
> aconteceu não pode deixar de existir porque outro fato foi recusado.

`REQ-256` Quando há obrigação aberta e a pessoa pede um adiantamento, **as duas leituras são
válidas**: adiantamento mais compensação, ou pagamento parcial da obrigação. O usuário escolhe e o
Treasury mostra a consequência de cada uma, sem escolher por ele. Adiantamento pressupõe algo que
será recebido, ou não; crédito pressupõe juros.

`REQ-257` **O usuário define o valor** e o que acontece com ele: pagar, compensar, negociar ou
incluir em um lote. O Treasury mostra o que estiver disponível sobre o que pode ser pago, sem
decidir. O Ledger registra o valor resultante e não calcula percentuais.

```
Produto de R$ 100,00 por mês; a operadora paga à Usina 30%, ou seja, R$ 30,00.
A comissão do corretor pode partir da parcela (R$ 100,00) ou do que a Usina recebeu (R$ 30,00).
O supervisor pode ter X% da parcela, do que a Usina recebeu ou do que o corretor vai receber.
```

`REQ-258` Cada pessoa com direito tem a **sua própria obrigação**, inclusive quem não é corretor,
como um supervisor. Uma obrigação **maior que o recebido é aceita** e o resultado negativo fica
exposto.

`REQ-259` "Fluxo" é só uma forma de descrever um conjunto de fatos em determinado momento. Não
existe entidade de fluxo nem evento de encerramento (ver `REQ-622`).

### 4.6 Sinal externo do sistema de seguro

> Decidido em 2026-11-09 (rodada 14, `DEC-028`). **Implementados:** blocos A (`REQ-260`, `REQ-261`,
> `REQ-265`), B (`REQ-267`), C (`REQ-263`, `REQ-264`, `REQ-268`, `REQ-270`, `REQ-271`) e D (`REQ-269`,
> `REQ-277`), na tela "Sistema de seguro" e na prévia; a integração (`REQ-278`, `REQ-279`) e a lista de
> sinais (`REQ-280`) também. O bloco E (`REQ-266`) foi adiado. O reconhecimento
> operacional nasce fora; o controle financeiro acontece dentro. O sistema de seguro **não movimenta
> dinheiro** (Anexo B.1): ele diz o que se espera, e o Treasury mantém a própria visão do que de fato
> aconteceu. Esta etapa é **sem API**; a leitura automática fica para a etapa de integração, e o
> desenho abaixo não muda com ela.

```
Sistema de seguro          Treasury                                       Ledger
Apólice / elegibilidade ─► SINAL EXTERNO (cópia imutável, nunca vai ao Ledger)
                              │ identifica apólice, corretor e seguradora
                              ▼
                           FATOS PROPOSTOS (um por acontecimento, cada um confirmado à parte)
                              ▼
                           Usuário confere a prévia e confirma ─────────► expectativa (média)
Banco / usuário ──────────► Comissão recebida (lote opcional) ──────────► caixa (alta)
Usuário ──────────────────► Repasse, compensação ou nada ───────────────► fato
```

`REQ-260` Um **sinal externo** guarda, no Treasury e de forma imutável, o que o sistema de seguro
disse: o sistema de origem, o id do registro (a apólice), o tipo do sinal (apólice registrada ou
elegibilidade), o conteúdo completo com a sua impressão digital (hash), quando foi lido e quem o
trouxe. O sinal **não é fato** e **nunca vai ao Ledger**. A base do cálculo (prêmio, CT, CTU, CR)
fica nele, e não no Ledger (`REQ-257`, `DEC-020`).

`REQ-261` Cada sinal gera **um fato proposto por acontecimento**. O fato proposto é uma intenção já
preenchida, no estado **pronta para envio**, que passa pela mesma prévia e pelo mesmo envio das demais
(`REQ-212`, `REQ-213`). **Cada um é confirmado à parte** (`REQ-323`): confirmar um não confirma os
outros. Nesta etapa, sem API, o usuário preenche o sinal a partir do que vê na tela do sistema de
seguro; o autor do evento é então o **usuário**, com confiança **média** (`REQ-805`, `REQ-806`).

`REQ-262` O sistema de seguro gera **só expectativas**:

| Sinal | Fato proposto | Valor |
| --- | --- | --- |
| Apólice registrada | Comissão prevista, citando a apólice | `usinaValue` |
| Elegibilidade | Obrigação de comissão com o corretor, citando a apólice (`REQ-253`), **e** a comissão prevista (`REQ-272`) | `payout` e `usinaValue` |

A obrigação com o corretor **nasce na elegibilidade** (responde `Q-047`). O sinal **nunca** gera
comissão recebida nem pagamento: o fato financeiro é diferente do que o domínio externo diz. Quem
aparece como parte na comissão prevista continua em `DEC-010`.

`REQ-263` A elegibilidade afirma que **a seguradora declarou, no próprio sistema, que pagou a Usina**,
e que o corretor já pode receber. Essa afirmação é **mostrada** ao usuário e **não** vira recebimento:
o recebimento só é registrado com evidência do lado financeiro (`REQ-806`).

```
"A Allianz diz que pagou R$ 128,77 pela apólice 5177…285. O recebimento ainda não foi visto no banco."
```

`REQ-264` O **valor retido não é evento**. Ele é a diferença entre a comissão prevista e a obrigação
com o corretor, e o Treasury o mostra **dizendo explicitamente** que é uma diferença lida dos dois
fatos, e não um fato. O Treasury pode mostrar a conferência do cálculo do sinal, sem decidir nada com
ela; o Ledger guarda só os valores.

```
Prevista 128,77 · obrigação com o Halisson 77,26 → fica com a Usina 51,51 (diferença, não evento)
Conferência do sinal: 643,85 × 20% = 128,77 · × 60% = 77,26
```

`REQ-265` Cada fato proposto vai ao Ledger com uma **referência da origem** derivada do sistema, do id
da apólice e do tipo do sinal (ex.: `seguro:apolice:<id>:prevista`, `seguro:apolice:<id>:elegibilidade`).
O Treasury avisa quando o mesmo sinal já foi confirmado, e o Ledger recusa a referência repetida como
duplicada. Ressalva: a mesma apólice com dois ids (`Q-050`) escapa dessa proteção; a referência por
parcela depende de `Q-052`.

`REQ-266` (**adiado em 2026-11-09**: ainda não se viu acontecer; volta se aparecer um caso real) Uma **mudança na origem** não reescreve nada: uma nova leitura é um **novo sinal**. O Treasury
compara com o último sinal confirmado da mesma origem e **mostra a diferença**; o usuário decide se
ajusta, retifica ou deixa como está. Fechar uma obrigação cuja elegibilidade foi cancelada depende de
`DEC-019`.

```
Sinal confirmado: CR 60% → obrigação 77,26 · nova leitura: CR 65% → 83,70
→ "A origem mudou: obrigação registrada 77,26, nova leitura 83,70." Nada muda sem o usuário.
```

`REQ-267` **Partes e apólice.** Não se replica o cadastro do sistema de seguro: só entra o necessário
para o controle financeiro.

| Entidade | No Treasury | Ligação com o sistema de seguro |
| --- | --- | --- |
| Seguradora | Parte cadastrada (CNPJ, se paga por banco, `REQ-314`) | id externo da parte (`REQ-330`) |
| Corretor | Parte cadastrada | id externo, tirado da **apólice**, nunca do nome do demonstrativo |
| Cliente | **Não é parte** (`REQ-313`); só contexto, pela apólice | Seus dados pessoais não são copiados |
| Apólice | **Referenciada, não cadastrada**. No Ledger, contexto `contract` com id `seguro:apolice:<id>` (`DEC-029`) | id da apólice |
| Elegibilidade | Não é entidade: é o **motivo** da obrigação, citando a apólice | Apólice + data da elegibilidade |

Seguradora ou corretor sem ligação, ou com dúvida, recebem **identidade provisória** (`REQ-324`).

O id externo é guardado **com o cadastro de onde vem** (`seguro:corretor`, `seguro:seguradora`): no
sistema de seguro, corretores e seguradoras são cadastros diferentes, e o mesmo número pode existir nos
dois. Corrigido em 2026-11-09, depois que um demonstrativo com seguradora "123" e corretor "123" pôs o
corretor como pagador da comissão prevista.

> **Como ficou no bloco B (2026-11-09).** O corretor é buscado só pelo id do sistema de seguro,
> lido através das ligações do curador. Um único dono do id → ligado. Nenhum → identidade provisória
> com o nome visto e o id externo, reaproveitada pelos sinais seguintes; quando o curador a liga, os
> próximos sinais já chegam na parte cadastrada. ⚠ CONFIRMAR: **mais de uma parte com o mesmo id**
> não cria provisória (seria uma terceira identidade); nada é escolhido e o corretor é perguntado na
> conversa. ⚠ CONFIRMAR: **sinal sem o id** do corretor também pergunta na conversa, porque criar a
> provisória só pelo nome seria ligar pelo nome. O id da seguradora é guardado no sinal, mas ainda não
> é resolvido: nenhum evento cita a seguradora até `DEC-010`.

`REQ-268` O Treasury **recomenda as ligações** entre os fatos: o recebimento com a comissão prevista da
apólice, o repasse com a obrigação do corretor e a obrigação com a apólice. Quando um repasse **sai**
sem recebimento registrado na mesma apólice, o Treasury **avisa** antes do envio e deixa isso visível.
O Ledger aceita nos dois casos (`REQ-102`); a aritmética expõe a incongruência, e o Treasury ajuda a
ligar os fatos para que ela apareça no lugar certo (`DEC-032`).

`REQ-269` **Recebimento.** Não se sabe ainda como a seguradora paga, então valem os **quatro cenários**.
Em todos, o Treasury mostra lado a lado o que o sistema de seguro disse e o que já é fato.

| Cenário | Como vira fato |
| --- | --- |
| Pago por apólice | Uma comissão recebida, ligada à comissão prevista da apólice |
| Crédito único para várias apólices | Um contexto de lote (`settlement_batch`) e uma comissão recebida por apólice citando o lote; o que ainda não foi atribuído fica visível |
| Comissão inteira | Um recebimento fecha a comissão prevista |
| Comissão parcelada | Uma comissão prevista, com recebimentos parciais; o saldo aberto fica visível (`Q-049`) |

A **conciliação** com o extrato bancário é **opcional e por lote**, e só no recebimento: as
expectativas não movem caixa e não precisam dela. A conciliação linha a linha continua em `DEC-018`.

`REQ-277` **Crédito da seguradora** (decidido em 2026-11-09). Um crédito no banco que cobre várias
apólices é registrado como **um lote** (`settlement_batch`): um recebimento por comissão prevista, cada
um citando o lote e a sua apólice (`REQ-275`), com o valor que o usuário distribuiu (`REQ-257`). O que
sobra do crédito vira **um recebimento sem origem** citando o lote: o dinheiro entrou, então o caixa fica
completo, e a lacuna fica visível como pendente. Distribuir mais do que o crédito, ou mais do que o
aberto numa comissão prevista, é recusado antes de enviar. Os recebimentos vão um de cada vez, em ordem
(`REQ-255`); se um for recusado, os seguintes não são enviados e o usuário vê o que faltou.

```
Crédito da Allianz de 3.400,00 em 10/11
  apólice 5177…  128,77    apólice 8812…  1.000,00 (parcela de 2.000,00)    apólice 9034…  2.171,23
  não atribuído  100,00 → recebimento sem origem, citando o lote
  caixa da Usina: +3.400,00 · ainda a receber na 8812…: 1.000,00
```

`REQ-270` A obrigação com o corretor é registrada **inteira**, pelo valor da elegibilidade. Na
confirmação e no pagamento, o Treasury mostra o que já está aberto com a mesma pessoa (adiantamento,
empréstimo, outras obrigações, pagamento sem obrigação), e o **usuário** decide se compensa, paga parte
ou não paga agora (`REQ-250`, `REQ-256`, `REQ-257`). O Treasury **nunca** abre a obrigação pelo líquido.

```
Elegibilidade de 77,26; Halisson com adiantamento aberto de 50,00
→ obrigação de 77,26 · a prévia mostra o adiantamento · o usuário compensa 50,00 e paga 27,26
```

`REQ-272` A elegibilidade também propõe a **comissão prevista** da seguradora, pelo valor da Usina
(decidido em 2026-11-09). A referência da origem é a mesma vinda da apólice registrada, então um dos dois
sinais aponta para a proposta do outro (`REQ-265`). A data em que a expectativa surgiu é a **data da
apólice**, campo opcional do demonstrativo, que a tela da apólice mostra e a integração pode trazer.
Sem ela, a data é perguntada; a data da elegibilidade **nunca** é usada no lugar.

```
Demonstrativo da apólice 5177…285: valor da Usina 128,77, repasse 77,26, elegível em 21/10/2026
  → obrigação de 77,26 com o Halisson (21/10/2026)
  → comissão prevista de 128,77 da Allianz (data da apólice, se informada; senão, perguntada)
```

`REQ-273` A **seguradora** é quem vai pagar a comissão prevista: entra no evento como parte (`payer`),
achada pelo id do sistema de seguro, como o corretor (`REQ-267`). Sem o id, a comissão prevista segue
sem quem paga, como antes. Decide `DEC-010` só para a comissão prevista.

`REQ-274` A comissão prevista registrada à mão aceita, **opcional**, quem vai pagar. Registrar o
recebimento a partir da comissão prevista já traz esse pagador preenchido, e a prévia deixa trocar.

> A conversa guiada pergunta só os campos obrigatórios. Os opcionais, como este e a data esperada,
> entram pelo texto livre, pelo sinal ou pela posição, e podem ser vistos e trocados na prévia.

`REQ-275` Uma operação que **continua uma posição** cita os mesmos **contextos** que o fato que a abriu
citava: o recebimento lançado a partir da comissão prevista e o repasse lançado a partir da obrigação
também citam a apólice. Um evento pode citar vários contextos (apólice, proposta, lote), e todos são
herdados; outras posições citadas ao lado não são. A reemissão de uma retificação cita os contextos do
lançamento corrigido. O Ledger não mudou: ele já aceitava contexto em qualquer evento (decidido em
2026-11-09, opção 2 entre "o Treasury junta" e "herdar o contexto").

> Grava no fato uma relação que é conhecida, não suposta: o pagamento quita uma posição que nasceu de
> um fato sobre a apólice. Com isso, o próprio Ledger responde "tudo desta apólice", e o que entrou e não
> foi repassado (`allocationGap`) é o valor retido medido em dinheiro.

`REQ-276` A **história da apólice** conta, em ordem, cada fato que cita a apólice e cada sinal lido sobre
ela, em frases: quem esperava, devia, pagou ou recebeu quanto. Um fato retirado aparece riscado, e um
sinal aparece como o que o sistema de seguro disse, nunca como fato. Só entra o que cita a apólice: um
pagamento lançado sem ligar à obrigação não aparece (`DEC-032`).

```
Apólice 5177202641312121285
  01/10  A Usina passou a esperar R$ 128,77 da Allianz.
  21/10  A Usina reconheceu dever R$ 77,26 ao Halisson.
  08/11  Allianz pagou R$ 128,77 à Usina.
  09/11  A Usina pagou R$ 77,26 ao Halisson.
  09/11  O sistema de seguro informou a elegibilidade (registrado por cfo). É um sinal, não um fato.
```

`REQ-278` **Integração com o sistema de seguro** (rodada 15, 2026-11-09). Um **produtor** lê a API do
sistema de seguro a cada 5 minutos e publica **uma mensagem por apólice elegível** no broker (RabbitMQ,
em servidor próprio, conectado por `.env`). Um **consumidor** registra cada mensagem como sinal, de
autoria do **sistema** (`REQ-805`); os fatos propostos chegam ao Ledger com o reporter `system` e
confiança média, e a auditoria guarda quem confirmou. A integração só **preenche**: nada vai ao Ledger
sem um usuário confirmar (`REQ-261`, `REQ-323`). O formulário continua disponível como alternativa.

| Contrato | Valor |
| --- | --- |
| Exchange / routing key / fila | `treasury` (direct) / `signal.insurance` / `treasury.signals`, com mortas em `treasury.dlx` → `treasury.signals.dead` |
| Envelope | `messageId` (`seguro:eligibility:<apólice>:<sha256 dos campos>`), `type` `insurance.signal.observed`, `version` 1, `source` `seguro`, `publisher`, `observedAt`, `signal.kind` `eligibility`, `signal.fields` |
| Campos | Os do sinal (§4.6), na forma do formulário; o cliente nunca entra |
| Repetida (mesma leitura da mesma apólice) | Nada é gravado; confirmada no broker |
| Leitura diferente da mesma apólice | Novo sinal; as propostas existentes são reaproveitadas (`REQ-265`) |
| Inválida (JSON, envelope, versão, campo) | Vai para a fila de mortas, com o motivo no log |

O contrato é um arquivo só (`insuranceSignalMessage.ts`), usado pelos dois lados. De onde vem cada
campo: `GET /payouts/eligible` (valores, CT, CR, CTU, data da elegibilidade), `GET /policies/:id` (id do
corretor; `registeredAt` como data da apólice) e `GET /proposals/:id` (id da seguradora, produto). O
nome da seguradora não vem na API; o id faz as vezes de nome visto.

`REQ-279` O item **"Sistema de seguro"** do menu lateral mostra quantas propostas esperam conferência,
relido a cada 20 segundos, como o aviso de identidades provisórias.

`REQ-280` **Lista de sinais** (2026-11-11). A tela "Sistema de seguro" lista os sinais do mais novo para
o mais antigo, em páginas ("carregar mais"), sem repetir um sinal já mostrado. Por padrão, mostra só os
sinais com alguma proposta **ainda à espera do usuário** (coletando, pronta para envio ou aguardando
correção); o filtro "todos" traz também os já registrados ou recusados. Esse estado é **lido da intenção
a cada consulta**, nunca guardado no sinal, que continua imutável (`REQ-260`). O número do menu
(`REQ-279`) conta as propostas abertas de **todos** os sinais, não só da primeira página.

```
7 sinais, 2 com proposta aberta, páginas de 20
  padrão → os 2 abertos · "todos" → os 7 · a proposta é enviada e aceita → sai do padrão
```

`REQ-271` A **data esperada** da comissão prevista (`REQ-229`) continua opcional. Sem ela, a comissão
fica com um **alerta de pendência**, porque essa data serve ao controle de inadimplência. O alerta é
diferente do incômodo da identidade provisória (`REQ-321`), e uma comissão sem data esperada nunca é
tratada como atrasada.

---

## 5. Cadastro de partes

> Substitui a seção "Contrapartes" (depreciada em 2026-11-03, `DEC-002`). Já decidido em
> 2026-11-04: o cadastro é prévio e feito por quem tem curadoria; a parte não cadastrada recebe
> identidade provisória com incômodo visual; o mapeamento de identidade fica no Treasury, só de
> acréscimo; o passado é mapeado, não corrigido; o cliente final é contexto. Em 2026-11-04
> (rodada 7) também: curadoria é permissão; resolver é ligar; CPF/CNPJ para quem tem conta
> bancária; eventos externos esperam confirmação. Pendências: `DEC-015`, `DEC-016`.
>
> **Contexto (não é regra):** a Usina se relaciona com cerca de **250 partes**. Hoje elas estão
> num sistema separado, em planilhas e em anotações pessoais de quem trabalha na Usina. A carga
> no Treasury é feita pelo próprio Treasury; o mecanismo é decisão técnica, fora deste documento.

### 5.1 O cadastro

`REQ-310` O Treasury mantém um **cadastro de partes**: pessoas e empresas com relacionamento
financeiro com a Usina, **direto** (entrada ou saída de dinheiro) ou **indireto** (promessa de
entrada ou de saída).

`REQ-311` **Somente quem tem curadoria** cadastra uma parte (`REQ-402`). Quem opera **não cria
parte** no momento da operação: busca uma parte já cadastrada.

> Protege o caderno: uma parte duplicada ou errada dentro de um fato imutável vira erro
> permanente. Origem: diretriz de 2026-11-03.

`REQ-312` São partes cadastradas todos os que têm papel financeiro no evento. No repasse de uma
comissão da Unimed ao João, que recebe pela empresa Argo, **Unimed, João e Argo** são partes
cadastradas.

> "Temos que ter um controle financeiro": o extrato só mostra a Argo; o Treasury precisa saber
> dos três.

`REQ-313` O **cliente final** (ex.: o cliente Y de um plano) **não é parte cadastrada**. Ele é
**contexto** do evento, como o plano.

`REQ-314` O **CPF/CNPJ é obrigatório** para a parte que **recebe ou paga por conta bancária**.
Para as demais, é **opcional**.

> É a chave para ligar uma linha do extrato ao evento: o extrato só mostra o documento da conta
> (ex.: "Usina pagou X para Argo, CNPJ def456").

### 5.2 Identidade provisória

`REQ-320` Quando um fato envolve alguém **ainda não cadastrado**, o fato **é registrado** mesmo
assim, com uma **identidade provisória**. O registro do fato **não espera** o cadastro.

> Um pagamento que aconteceu não deixa de ter acontecido porque a parte não está cadastrada. A
> ideia é a mesma da conta transitória da contabilidade.

`REQ-321` Enquanto existir identidade provisória sem resolução **usada em um fato que o Ledger
aceitou**, o Treasury mostra um **incômodo visual persistente**: uma notificação insistente, "chata",
como as das redes sociais, até a identidade ser resolvida. **Todos os usuários** veem a notificação.
Se ela fica mais insistente com o tempo e se bloqueia algo: `DEC-016`.

> **Alterado na rodada 10.** Antes: "enquanto existir identidade provisória sem resolução". Uma conversa
> abandonada, ou um nome digitado errado nela, não deixa fato a cobrar, e o aviso perderia credibilidade.

`REQ-322` Quem tem curadoria resolve uma identidade provisória **ligando-a a uma parte já
cadastrada**. Desfazer uma ligação errada: `DEC-015`.

```
Fato: folha de 1.500,00 paga a "Maria Souza" → identidade provisória-123
O curador cadastra a parte "Maria Souza" (CPF ...) → liga provisória-123 a ela
A notificação some; a visão da Maria mostra a folha
```

`REQ-323` Um evento que chega do **sistema externo** **espera a confirmação** de um usuário no
Treasury antes de ir para o Ledger. O sistema externo apenas sinaliza: sem a confirmação, nenhum
fato é gravado.

> Protege o caixa: comissão recebida aumenta o caixa da Usina, e o saldo não pode subir sem alguém ter
> visto o dinheiro.

`REQ-324` Quando um evento do sistema externo traz uma parte com **dúvida** (ex.: a empresa que
paga, ou o corretor relacionado ao evento), essa parte recebe uma **identidade provisória**
(`REQ-320`).

### 5.3 Mapeamento de identidade

`REQ-330` O **mapeamento de identidade** ("estes identificadores são a mesma parte") fica **no
Treasury**, não no Ledger.

`REQ-331` O mapeamento é **só de acréscimo**: uma ligação **nunca é apagada nem reescrita**. Como
desfazer uma ligação errada está em `DEC-015`.

`REQ-332` **O passado não é corrigido, é mapeado.** Os fatos já no Ledger com identificadores
diferentes para a mesma parte continuam como estão; o Treasury liga esses identificadores à parte
correta.

```
No Ledger:   pagamento 1 → "Fornecedor Alfa" · pagamento 2 → "ALFA LTDA" · pagamento 3 → provisória-123
No Treasury: os três identificadores → parte "Alfa Serviços Ltda"
Visão da Alfa: os três pagamentos. Nenhum fato do Ledger foi alterado.
```

`REQ-333` O **Ledger canoniza** os fatos financeiros (imutáveis, só de acréscimo). O **Treasury
auxilia**: identifica, mapeia e sugere.

### 5.4 Regras anteriores que continuam valendo

`REQ-301` Uma contraparte **não identificável** só é aceita na **comissão recebida**. Em qualquer
outra operação, ela é recusada. Ela **não é** a identidade provisória (§2); as duas continuam
(`Q-036`).

> Protege contra uma saída de dinheiro sem destinatário conhecido. O dinheiro que **entra** pode
> chegar sem remetente conhecido; o que **sai** não.

`REQ-302` Uma movimentação com contraparte não identificável fica **pendente de validação**. O
sistema cobra o complemento futuro de forma insistente, quase obrigatória. A forma dessa
cobrança é a mesma notificação de `REQ-321` (`Q-036`).

> Contraparte não identificada **não é o estado ideal**. O Ledger a aceita porque calcula do seu
> modo, mas o Treasury precisa mapeá-la com cuidado (`DEC-006`).

### 5.5 Retirado em 2026-11-04 (registro)

O comportamento antigo de contrapartes **foi retirado** e não é requisito:

| Antes | Por quê / substituído por |
| --- | --- |
| A contraparte digitada podia ser **criada durante a operação** | Contraria a diretriz "nada de criar no momento da operação" → `REQ-311`, `REQ-320` |
| Contraparte parecida pedia confirmação; várias pediam escolha | Busca no cadastro prévio (`REQ-311`); resolução por ligação (`REQ-322`) |
| Na prévia, **uma** pergunta opcional de enriquecimento (documento ou tipo) | O documento passou a ser obrigatório para quem tem conta bancária (`REQ-314`) |
| Importação de contrapartes de fonte externa | A carga passa a ser feita pelo Treasury a partir das três fontes (§5, contexto) |

As diretrizes de 2026-11-03 viraram regra assim: "resolução concisa e forte" → §5 inteira; "não
se cria contraparte no momento da operação" → `REQ-311`; "toda e qualquer parte identificada" →
`REQ-312` e `DEC-010`; "evento com dúvida sinalizado, inclusive vindo de fora" → `REQ-321` e
`REQ-324`.

---

## 6. Acesso

> **Origem (2026-11-13, `DEC-041`).** Esta seção adota o **molde de autenticação e autorização** que o
> dono do produto indicou (`tmp/molde_de_autenticacao_autorizacao.md`). As regras do molde valem como
> estão, com quatro adaptações decididas pelo dono do produto: **três papéis**, porque o Treasury já
> tinha gestor e visualizador; o **molde inteiro agora, sem o envio de e-mail**; o piloto começa com uma
> **base limpa**, então nada precisa ser migrado (molde `[INT-06]`); e o comando de criação de usuário
> existe **só em desenvolvimento** (molde `Q-415`).
>
> **Identificadores.** Os do molde foram mantidos para preservar a rastreabilidade, salvo quando o número
> já existia aqui com outro sentido: molde `REQ-402` → `REQ-408`, molde `REQ-216` → `REQ-807` (§10),
> molde `CA-401` → `CA-418` e molde `REJ-401` → `REJ-409`.
>
> **A distinção que esta seção existe para manter: o controle de acesso é do servidor.** A tela pode
> esconder o que o usuário não pode fazer, mas nunca é ela que impede.

### 6.1 Usuários e papéis

`REQ-400` **Usuário.** Pessoa da Usina com acesso ao Treasury. Entra com o **e-mail** e a senha; o e-mail
é o login, e não existe outro nome de usuário. É referenciado pelo seu **id**, que é o que as
assinaturas guardam (`REQ-807`). Tem um **nome opcional**, informado ao aceitar o convite. A exibição do
usuário é o nome ou, sem nome, o e-mail.

`REQ-401` **Papéis.** Existem **três** papéis, e cada usuário tem **exatamente um**:

| Papel | Inicia operação | Envia ao Ledger | Consulta | Gestão de usuários |
| --- | --- | --- | --- | --- |
| **Administrador** | Sim | Sim | Sim | **Sim** |
| **Gestor financeiro** | Sim | Sim | Sim | Não |
| **Visualizador** | **Não** | **Não** | Sim | Não |

O Administrador tem **acesso irrestrito**: faz tudo o que o Gestor financeiro faz, tem a **curadoria de
partes pelo próprio papel** (cadastra partes e as liga às provisórias, `REQ-402`) **e** faz a gestão de
usuários: convidar (`REQ-420`), desativar (`REQ-403`), trocar o papel (`REQ-404`) e dar ou retirar a
curadoria dos demais (`REQ-402`). Decidido em 2026-11-13.
Todo usuário autenticado **consulta tudo**. A gestão de usuários é exclusiva do Administrador **também no
servidor**, qualquer que seja o caminho da requisição.

> **Alterado em 2026-11-13.** Antes: "Existem **dois papéis**", o Gestor financeiro e o Visualizador. O
> Administrador vem do molde (molde `REQ-401`), e os outros dois continuam como eram. Papéis mais
> customizáveis, como "quem prepara mas não envia" com a aprovação de outra pessoa, continuam em aberto
> (`DEC-004`).

`REQ-402` A **curadoria de partes** é uma **permissão**, não um papel: ela é dada a um usuário que
já tem outro papel. Só quem a tem cadastra partes (`REQ-311`) e resolve identidades provisórias
(`REQ-322`). O **Administrador a tem pelo papel** (`REQ-401`). Aos demais, **quem dá e retira a curadoria
é o Administrador**, e a mudança fica registrada como a troca de papel: quem mudou, quando, antes e depois
(`REQ-404`). Confirmado pelo dono do produto em 2026-11-13.

> Com poucos usuários, um terceiro papel seria custo sem ganho (`Q-037`). O Administrador, acrescentado
> em 2026-11-13, não muda isso: ele existe para a gestão de usuários, não para a curadoria.

`REQ-408` **Pessoas de fora não acessam o Treasury.** Corretores, parceiros, operadoras, seguradoras e
clientes **não têm papel**. Dar acesso a qualquer um deles é uma decisão nova (molde `REQ-402`,
`[INT-02]`).

`REQ-403` **Desativação.** Um administrador pode **desativar** um usuário. O usuário **nunca é apagado**,
porque as assinaturas o referenciam. Desativado, ele não entra mais, e as suas sessões são encerradas
na hora. **Não há reativação**: quem volta recebe um novo convite (`REQ-421`).

`REQ-404` **Troca de papel.** Um administrador pode trocar o papel de um usuário. A troca registra
**quem** trocou, **quando**, o papel **anterior** e o **novo**, e vale **a partir da próxima operação**
do usuário, sem novo login.

`REQ-405` **Primeiro administrador.** O primeiro administrador nasce por um **comando executado no
servidor**, que emite um convite de administrador e o exibe a quem executou. **Não existe usuário nem
senha padrão.** Com um administrador ativo, o comando recusa: daí em diante, administradores são
convidados por administradores, para que o comando não seja usado indiscriminadamente. Confirmado pelo
dono do produto em 2026-11-13.

`REQ-406` **Último administrador.** A desativação ou a troca de papel que deixaria o Treasury **sem
nenhum administrador ativo** é **recusada**.

`REQ-407` **Usuário criado por comando, só em desenvolvimento.** Um comando executado no servidor cria um
usuário ativo, com e-mail, senha, papel e nome opcional, sem convite. A senha é **digitada sem eco**, num
prompt à parte, nunca como argumento do comando. Valem as regras de senha (`REQ-415`) e de e-mail
(`REQ-421`). Em produção o comando **recusa**: lá todo usuário entra por convite, que registra quem
convidou. Decidido em 2026-11-13 (molde `Q-415`).

### 6.2 Autenticação e sessão

`REQ-410` **Tudo exige login.** Toda operação do Treasury exige um usuário autenticado. As exceções são
**exatamente** estas: o login, o aceite do convite, a verificação de saúde do serviço e as páginas, que
não contêm dados. A redefinição de senha entra nesta lista quando existir (§6.4). Uma operação nova
nasce **protegida**.

`REQ-411` **Login e logout.** O login é feito com e-mail e senha e abre uma **sessão**. O logout encerra
a sessão **no servidor**, não só na tela.

`REQ-412` **Sessão.** A sessão expira **12 horas depois do login**, qualquer que seja o uso nesse
intervalo. Ela também é encerrada pelo logout, pela redefinição de senha (`REQ-426`) e pela desativação
do usuário (`REQ-403`). **Ela sobrevive a um reinício do Treasury** (decidido em 2026-11-13).

`REQ-413` **Login recusado não revela a conta.** E-mail inexistente, senha errada, usuário desativado e
conta suspensa (`REQ-414`) recebem **a mesma mensagem**.

`REQ-414` **Tentativas.** Depois de **5 falhas seguidas** de login numa conta, o login dela fica
**suspenso por 15 minutos**. Um login bem-sucedido zera a contagem.

`REQ-415` **Senha.** De **12 a 128 caracteres**, sem regra de composição (maiúscula, número, símbolo).

`REQ-416` **Segredos nunca em claro.** A senha, o identificador da sessão e os links de convite e de
redefinição **não são guardados em claro**. A senha é guardada só como resultado de uma função
irreversível, com sal próprio.

`REQ-417` **Requisição de outro site.** Uma operação que altera dados, vinda de uma página que não é a do
próprio Treasury, é **recusada**, mesmo que o navegador tenha uma sessão aberta.

### 6.3 Convite

`REQ-420` **Convidar.** Um administrador convida informando o **e-mail** e o **papel**. O Treasury gera
um **link de uso único**, válido por **72 horas**. O convite registra **quem convidou** e **quando**.

`REQ-421` **Um convite por e-mail.** Um novo convite para o mesmo e-mail **invalida o anterior**: só o
último vale. Convidar o e-mail de um usuário **ativo** é **recusado**. O e-mail de um usuário
**desativado** pode ser convidado; o aceite cria **um novo usuário**, com um novo id, e as assinaturas
antigas continuam apontando para o usuário desativado.

`REQ-422` **Aceite.** Pelo link, a pessoa define a **senha** (`REQ-415`) e, se quiser, o **nome**
(`REQ-400`). O usuário é criado **ativo**, com o papel do convite, e depois faz o login normalmente. Um
link **expirado, já usado, substituído ou desconhecido** é recusado com **uma única mensagem**, sem dizer
qual desses é o caso.

### 6.4 Recuperação de senha

`REQ-425` **Pedido.** "Esqueci a senha" recebe o e-mail e responde **sempre a mesma coisa**, exista a
conta ou não. Só um usuário **ativo** recebe o e-mail, com um **link de uso único**, válido por **1 hora**.

`REQ-426` **Conclusão.** Pelo link, o usuário define a nova senha (`REQ-415`). O link deixa de valer,
assim como qualquer outro link de redefinição pendente do usuário, e **todas as suas sessões são
encerradas**. Um link inválido segue `REQ-422`: uma única mensagem.

> **Enquanto não houver envio de e-mail** (decidido em 2026-11-13), `REQ-425` e `REQ-426` não estão
> disponíveis, porque o link não teria por onde chegar. Quem esquece a senha é **desativado e
> reconvidado** (`FA-404`). Elas entram com o envio de e-mail (`TODO-17`), sem mudar nenhuma outra
> regra.

### 6.5 Autorização

`REQ-430` **O servidor decide.** Toda operação verifica, no servidor, se o usuário tem o papel que ela
exige (`REQ-401`). A tela pode esconder o que o papel não permite, mas isso é conveniência, nunca a
proteção.

`REQ-431` **Respostas.**

| Situação | Comportamento |
| --- | --- |
| Sem sessão, ou com a sessão encerrada | A operação é recusada e a tela leva ao login |
| Autenticado, sem o papel que a operação exige | A operação é recusada, com mensagem |
| Usuário desativado | As sessões já foram encerradas: vale a primeira linha |

> A primeira linha é uma resposta de **autenticação** (não se sabe quem é); a segunda, de
> **autorização** (sabe-se quem é, e ele não pode). São recusas distintas.

### 6.6 E-mail

`REQ-435` **Envio desacoplado.** O convite e a redefinição de senha chegam por **e-mail**. O meio de
envio é **desacoplado** das regras: o meio escolhido entra depois sem mudar nenhuma regra desta seção. O
e-mail de acesso **não é** uma notificação de negócio e não aparece entre as notificações (`REQ-321`).

`REQ-436` **Sem envio configurado.** Enquanto o envio de e-mail não estiver configurado, o **link do
convite é exibido ao administrador** que convidou, na tela, para ele repassar, como o comando do
primeiro administrador já faz (`REQ-405`). Configurado o envio, o link vai só por e-mail.

### 6.7 Tela de usuários

`REQ-440` **Usuários.** O administrador tem uma tela de usuários com:

- a **lista** de usuários, com **nome**, **e-mail**, **papel**, **curadoria** e **situação** (ativo ou
  desativado);
- os **convites pendentes** na mesma lista, com o e-mail, o papel e a validade;
- as ações **convidar** (`REQ-420`), **reenviar convite** (um novo link, que invalida o anterior,
  `REQ-421`), **desativar** (`REQ-403`), **trocar o papel** (`REQ-404`) e **dar ou retirar a
  curadoria** (`REQ-402`).

Não há cancelamento de convite: reenviar já invalida o anterior. A tela é só do administrador; o
servidor recusa as ações a qualquer outro papel (`REQ-430`). A lista vem **inteira**, sem paginação: são
poucos usuários (molde `[INT-08]`).

### 6.8 Fluxos, exceções, aceitação e rejeição

**Primeiro administrador.** No servidor, alguém executa o comando (`REQ-405`), que exibe o link do
convite; a pessoa aceita o convite (`REQ-422`) e entra pelo login.

**Login.** Sem sessão, a tela leva ao login (`REQ-410`, `REQ-431`). O usuário informa e-mail e senha
(`REQ-411`); uma recusa não revela a conta (`REQ-413`), e as falhas seguidas suspendem o login da conta
(`REQ-414`). Aberta a sessão, o usuário volta à página em que estava.

**Convite.** Um administrador convida pelo e-mail e pelo papel (`REQ-420`, `REQ-421`); recebe o link na
tela e o repassa (`REQ-436`); a pessoa define a senha e, se quiser, o nome (`REQ-422`), e entra pelo
login.

**Ato assinado.** O usuário logado executa um ato auditado; o servidor confere a sessão e o papel
(`REQ-430`), e o autor registrado é o usuário da sessão, pelo id (`REQ-807`).

| ID | Situação | Comportamento |
| --- | --- | --- |
| `FA-401` | Convite reenviado ao mesmo e-mail | O anterior deixa de valer; só o último vale (`REQ-421`) |
| `FA-402` | Redefinição pedida para e-mail sem conta ativa | Mesma resposta; nenhum e-mail é enviado (`REQ-425`) |
| `FA-403` | Sessão expirada no meio do trabalho | A operação é recusada; a tela leva ao login e depois volta à página (`REQ-412`, `REQ-431`) |
| `FA-404` | Usuário desativado volta à Usina, ou esqueceu a senha sem envio de e-mail | Recebe um novo convite; o aceite cria um novo usuário (`REQ-403`, `REQ-421`, §6.4) |
| `FA-405` | Convite aceito sem nome | Permitido; a exibição usa o e-mail (`REQ-400`, `REQ-422`) |

| ID | Situação | Comportamento |
| --- | --- | --- |
| `EX-401` | Operação sem sessão válida | Recusada; a tela leva ao login (`REQ-410`, `REQ-431`) |
| `EX-402` | Operação sem o papel exigido | Recusada, com mensagem (`REQ-430`, `REQ-431`) |
| `EX-403` | Link de convite ou de redefinição expirado, usado, substituído ou desconhecido | Recusado com uma única mensagem (`REQ-422`, `REQ-426`) |
| `EX-404` | Login de usuário desativado, ou login durante a suspensão | Recusado com a mesma mensagem de qualquer falha (`REQ-413`, `REQ-414`) |
| `EX-405` | Operação que altera dados vinda de outro site | Recusada (`REQ-417`) |
| `EX-406` | Convite para o e-mail de um usuário ativo | Recusado (`REQ-421`) |
| `EX-407` | Senha com menos de 12 ou mais de 128 caracteres | Recusada (`REQ-415`) |

**Critérios de aceitação**

| ID | Critério | Regra |
| --- | --- | --- |
| `CA-418` | Toda operação, exceto as de `REQ-410`, é recusada sem sessão (molde `CA-401`) | `REQ-410` |
| `CA-402` | O login correto abre a sessão; depois do logout, a mesma sessão é recusada | `REQ-411` |
| `CA-403` | A sessão é recusada 12 horas depois do login; antes disso, sobrevive a um reinício do Treasury | `REQ-412` |
| `CA-404` | E-mail inexistente, senha errada e usuário desativado recebem a mesma mensagem | `REQ-413` |
| `CA-405` | A sexta tentativa depois de 5 falhas seguidas é recusada mesmo com a senha certa; passados 15 minutos, o login volta a funcionar | `REQ-414` |
| `CA-406` | Nada do que está guardado contém a senha, a sessão ou um link de convite em claro | `REQ-416` |
| `CA-407` | O convite aceito cria o usuário ativo com o papel convidado e o nome informado; o mesmo link, usado de novo, é recusado | `REQ-420`, `REQ-422` |
| `CA-408` | Um convite com mais de 72 horas é recusado; reenviado o convite, o link anterior é recusado | `REQ-420`, `REQ-421` |
| `CA-409` | A redefinição troca a senha, o link deixa de valer e as sessões anteriores são recusadas; um link com mais de 1 hora é recusado. **Entra com o envio de e-mail (§6.4)** | `REQ-425`, `REQ-426` |
| `CA-410` | O pedido de redefinição responde o mesmo para e-mail com e sem conta. **Entra com o envio de e-mail (§6.4)** | `REQ-425` |
| `CA-411` | Um Gestor financeiro ou um Visualizador é recusado ao convidar, desativar, trocar papel ou mudar a curadoria; um Administrador consegue | `REQ-401`, `REQ-430` |
| `CA-421` | O Administrador tem a curadoria pelo papel, sem concessão | `REQ-401`, `REQ-402` |
| `CA-412` | Um Administrador e um Gestor financeiro executam todas as operações e consultas; um Visualizador consulta tudo e não inicia nem envia operação (`CA-401`, `REJ-401`) | `REQ-401` |
| `CA-413` | O usuário desativado perde a sessão na hora e não entra mais | `REQ-403` |
| `CA-414` | A troca de papel e a mudança de curadoria registram quem, quando, o antes e o depois, e valem na operação seguinte do usuário | `REQ-402`, `REQ-404` |
| `CA-415` | Um ato assinado praticado com sessão registra como autor o id do usuário da sessão e exibe o nome, ou o e-mail sem nome | `REQ-807` |
| `CA-416` | Um autor enviado no corpo da requisição não vira o autor do ato | `REQ-807` |
| `CA-417` | Pelas telas: login, convite aceito, logout e uma operação recusada por papel | `REQ-410`–`REQ-431` |
| `CA-419` | A desativação ou a troca de papel do último administrador ativo é recusada | `REQ-406` |
| `CA-420` | O comando de criação de usuário recusa em produção; o do primeiro administrador não aceita senha nem cria usuário sem convite | `REQ-405`, `REQ-407` |

**Casos que devem ser rejeitados**

| ID | Caso | Regra |
| --- | --- | --- |
| `REJ-409` | Controlar o acesso só na tela (molde `REJ-401`) | `REQ-430` |
| `REJ-402` | Guardar senha, sessão ou link de convite ou de redefinição em claro | `REQ-416` |
| `REJ-403` | Aceitar duas vezes o mesmo link de convite ou de redefinição | `REQ-420`, `REQ-425` |
| `REJ-404` | Tomar o autor de um ato assinado do que a tela envia | `REQ-807` |
| `REJ-405` | Apagar um usuário | `REQ-403` |
| `REJ-406` | Responder login ou redefinição de forma que revele se a conta existe | `REQ-413`, `REQ-425` |
| `REJ-407` | Usuário, senha ou administrador padrão | `REQ-405` |
| `REJ-408` | Dar acesso a quem `REQ-408` declara sem acesso | `REQ-408` |

---

## 7. Envio, recusa, correção e retificação

### 7.1 Desfechos do envio

`REQ-501` Quando o Ledger **aceita**, a intenção termina **aceita** e guarda a referência do fato
gerado no Ledger.

> A referência permite consultar o caderno (o Ledger) sempre que for preciso. Abrir o caderno
> para usuários com formação contábil é uma ideia futura (`DEC-014`).

`REQ-502` Quando o Ledger recusa por motivo **corrigível**, o Treasury **volta a perguntar o campo
afetado**, e a intenção fica **aguardando correção**.

`REQ-503` Quando o Ledger recusa por motivo **não corrigível** (duplicado ou erro interno), a
intenção termina **recusada**.

### 7.2 Correção corrigível

`REQ-510` Uma intenção aguardando correção é corrigida e **reenviada pela mesma conversa**, sem
recomeçar. O usuário pode corrigir **qualquer campo**, não só o afetado. Depois da correção, a
intenção volta a **pronta para envio**, com a prévia refeita (`REQ-214`).

```
Quitação de empréstimo recusada: origem inválida
O usuário corrige a origem e também o valor (de 900,00 para 950,00)
→ nova prévia com a origem corrigida e 950,00 → o usuário clica em "enviar"
```

### 7.3 Retificação

`REQ-520` A retificação serve só para um lançamento que **nunca aconteceu**.

`REQ-521` A retificação tem **dois passos**: primeiro a **retirada** e depois, se houver o valor
correto, a **reemissão**. A ordem é **sempre retirar antes de reemitir**.

> Protege contra um número duplicado que ninguém percebe. Se o processo for interrompido entre os
> passos, a posição fica **subestimada**, o que é visível e recuperável, em vez de **duplicada**.

```
Adiantamento lançado como 400,00 que na verdade era 450,00:
  1. retirada de 400,00  → posição: 0,00   (400,00 continua no histórico, sem contar)
  2. reemissão de 450,00 → posição: 450,00
Interrompido após o passo 1 → posição: 0,00 (subestimada), nunca 850,00 (duplicada).
```

`REQ-522` A retificação alcança apenas **adiantamento, empréstimo e comissão a receber**.

> O Anexo A também lista `COMMISSION_PAYABLE`. O alcance da retificação, e se ela continua existindo
> ao lado do ajuste, ficou em aberto em `DEC-033`.

`REQ-523` Na reemissão, **só valor, data e descrição** podem mudar. A **contraparte nunca muda**.

> Protege contra a reemissão virar outro fato: mudar quem participou muda qual fato é.

`REQ-524` A retirada **não apaga nem reescreve** o lançamento original; ele continua no histórico, mas **deixa de contar**.

`REQ-525` A retirada de um lançamento que cita várias posições cita **todas elas**. O Treasury monta
a retirada assim, e o Ledger **recusa** a que citar só uma parte. A regra vale para novas retiradas;
as já gravadas continuam como estão.

> Protege contra um caderno inconsistente: retirada citando só o adiantamento, o adiantamento volta
> a ficar aberto, e a outra posição continua contando o que foi retirado.

---

## 8. Consultas

### 8.1 Consultas atuais

`REQ-601` As consultas mostram **só o que o Ledger publicou**. O Treasury **não recalcula
dinheiro**.

`REQ-602` Se o Ledger está fora do ar, a tela mostra **"indisponível"**, **nunca zero**.

> Protege contra um zero que parece um livro saudável quando, na verdade, o livro não foi lido.

`REQ-603` A partir de uma posição, o sistema **oferece as próximas ações possíveis** e já preenche
o que a posição sabe: moeda, posição, origem e, em alguns casos, a contraparte.

`REQ-604` A contraparte vem pré-preenchida a partir da posição **somente** em **folha**,
**recuperação de adiantamento** e **quitação de empréstimo**. Nas demais operações, ela é
perguntada.

> Existe para simplificar o uso. A lista pode crescer, e o mecanismo deve mudar com o MDM
> (`DEC-002`).

`REQ-605` A lista de posições e o painel mostram **só o que tem saldo**. Apólice, proposta, parcela,
lote e campanha são contextos: não são algo em aberto com ninguém e ficam fora dessas listas, inclusive
das opções do filtro de tipo. Quais tipos são contexto vem do próprio Ledger (`algebra.json`). O
Ledger não muda: o Treasury pede só os tipos com saldo, e a paginação e o total continuam sendo os do
Ledger (decidido em 2026-11-09, `DEC-035`).

```
Apólice 5177… citada pela comissão prevista e pela obrigação
  Antes: a lista de posições mostrava "Contrato · aberta · R$ 0,00"
  Agora: não aparece; o que se sabe dela está em "Ver situação no Ledger" (§4.6)
```

> Quais telas de consulta são requisito (painel, exposição, posições, movimentos, contas a pagar,
> ciclo de vida, saúde de classificação) continua em aberto (`DEC-009`).

### 8.2 Visão por pessoa e grupo

> **Rodada 18 (2026-11-12):** a tabela de eventos por parte deixa de ser uma tela. A entrada passa a ser
> uma **lista de partes**, que leva à página da parte (§8.4). As regras abaixo continuam valendo dentro
> dela.

> Decidido em 2026-11-04: uma pessoa pode estar em vários grupos; grupo é uma parte do tipo
> empresa; a relação nasce no evento; a visão é para filtrar e enxergar; o filtro mostra todos os
> eventos em que a parte tem algum papel; a sugestão vem do último evento.

`REQ-610` Uma pessoa pode se relacionar com **uma ou mais** empresas ou grupos.

`REQ-611` Pessoa e grupo são **independentes**. A relação entre eles **nasce no evento**
financeiro, não numa regra de cadastro.

> Evita regras de agregação e normas cadastrais: o determinismo fica no evento. Também preserva a
> história: se o João recebeu pela Argo em março e por conta própria em outubro, cada evento diz
> a verdade da sua época.

`REQ-612` A visão por pessoa ou grupo serve para **filtrar e enxergar** os eventos. Somar valores
por grupo **não** é objetivo; os totais por parte são `REQ-620`, publicados pelo Ledger. (Confirmado em
2026-11-12: a página do João mostra a Argo, sem somar os números das duas, `REQ-633`.)

`REQ-613` Quando um pagamento vai para uma empresa em nome de uma pessoa (o João recebe pela
Argo), o Treasury **sabe** disso e o Ledger **anota as duas**: a recebedora (Argo) e o
destinatário final (João).

> O extrato bancário mostra só "Usina pagou X para Argo (CNPJ)". O Treasury e o Ledger guardam o
> fato completo, com a cadeia e as identidades.

`REQ-614` Ao registrar um novo pagamento a uma pessoa, o Treasury **sugere** a forma usada **no
último evento** dela (ex.: "da última vez, o João recebeu pela Argo"). A sugestão **não decide**:
o usuário confirma ou muda.

`REQ-615` O filtro por uma parte mostra **todos** os eventos em que ela tem **algum papel**
(paga, recebe, é destinatária final ou outro).

```
Filtro "João": a comissão prevista em que ele é o corretor + o repasse em que ele é destinatário
final + o adiantamento que ele recebeu → os três aparecem
```

### 8.3 Resultado por parte e por contexto

> Decidido em 2026-11-06. **Ainda não implementado.** O Ledger cuida da aritmética e da exposição. A
> qualidade de um corretor é subjetiva e cabe à direção.

`REQ-620` O Ledger publica, **por parte e por período**, quanto entrou, quanto saiu e o saldo de
caixa dos eventos que citam essa parte, sem contar os retirados. O saldo pode ser **negativo**.

```
Corretor A: entrou 2.000,00; saiu 1.400,00; saldo +600,00   (sobra dinheiro em toda venda)
Corretor B: entrou 5.000,00; saiu 3.600,00; saldo +1.400,00 (vendas ruins e uma venda grande)
Corretor C: entrou 3.000,00; saiu 3.150,00; saldo -150,00   (muito volume, resultado negativo)
```

`REQ-621` O Ledger publica o mesmo por **contexto**, como o produto (`proposal`). A diferença não
para em zero, e assim prejuízo e zero a zero deixam de parecer iguais. O contexto mostra só o caixa
que **cita** aquele contexto, e o Treasury deixa isso claro. Outras categorias são `DEC-023`.

`REQ-622` Essas leituras mostram o **resultado conhecido** e, junto, as posições abertas. Nada
presume que acabou: um tributo ainda desconhecido não é tributo zero.

`REQ-623` Fato sem parte ou contexto associado continua **visível como não atribuído**, sem rateio
automático. A soma das partes mais o não atribuído fecha com o caixa do caderno.

`REQ-624` Uma posição fechada por compensação **não afirma ganho nem perda**: ela informa só que foi
fechada por compensação. O ganho ou a perda aparecem nos totais.

```
Adiantamento 300,00 compensado com obrigação de 300,00:
  o produto paga 1.000,00 → saldo do corretor +700,00
  o produto nunca paga    → saldo do corretor -300,00
A compensação é igual nos dois casos.
```

**Como a posição mostra isso** (decidido em 2026-11-11). A leitura de uma posição separa o que a
fechou em três números: **em dinheiro**, **compensado** e **baixado sem caixa**. O resultado da posição
quitada:

| Como fechou | Resultado |
| --- | --- |
| Só dinheiro | Como hoje (`DEC-027` não muda) |
| Compensação, com ou sem dinheiro, e nenhuma baixa | **Fechada por compensação**: não afirma ganho nem perda |
| Houve baixa sem caixa de outra natureza | Perda: **parcial** se algo voltou em dinheiro **ou por compensação**; **total** só se nada voltou. A parte compensada nunca conta como perda |
| Ainda aberta | Pendente, como hoje |

```
Adiantamento: aberto em 300,00 · em dinheiro 0,00 · compensado 100,00 · em aberto 200,00
Os 200,00 restantes são declarados perdidos → perda parcial (100,00 voltaram por compensação)
```

> Uma posição zerada por compensação não é um ciclo fechado (`REQ-622`): o caixa que saiu continua
> fora até outro fato o trazer de volta. Como alertar e mostrar de onde vem essa saída é `DEC-038`.

`REQ-625` Para o resultado por corretor, o Treasury cita o corretor nos eventos em que ele é
**conhecido**, inclusive tributos ligados à venda. Quando não é conhecido, o evento continua válido
e entra como não atribuído.

`REQ-626` O Treasury traduz os totais em **linguagem do usuário**, sem classificar. "O João trouxe
3.000,00 e custou 3.150,00 neste período" é um fato; dizer que ele é um mau corretor cabe à direção.

`REQ-627` O Treasury **não calcula** esses totais: ele mostra o que o Ledger publica (`REQ-601`).

### 8.4 Página da parte

> Decidido em 2026-11-12 (rodada 18, responde `DEC-030`). **Nada está implementado.** Responde ao que o
> teste na tela mostrou em 2026-11-07: eventos desconexos das partes, histórico fraco, pagamento a mais
> invisível (§16.1). Substitui a proposta do Anexo B.4. As três seções servem a públicos com ritmos
> diferentes: quem opera e quem paga no banco, todo dia e sob pressão; e a direção, que avalia. Comparar
> várias partes lado a lado fica fora (`DEC-039`).

`REQ-630` **Toda parte tem uma página própria**: pessoa ou empresa, cadastrada ou provisória, corretor,
seguradora, fornecedor, funcionário ou parceiro. Ela é aberta ao clicar no nome da parte, onde quer que ele
apareça. A entrada é a **lista de partes** (§8.2). A provisória mostra **"(provisória)"** junto do nome;
depois de ligada, os fatos dela aparecem na página da parte cadastrada (`REQ-332`).

`REQ-631` A página tem **três seções, nesta ordem**: **Operação** (a que abre), **Histórico** e
**Resultados**. As três leem o mesmo Ledger, e um número aparece igual em qualquer seção: o Treasury não
soma (`REQ-627`). Resultados expõe números por período; o juízo é de quem olha (`REQ-626`). Resultados
depende de `REQ-620` (passo 6); Operação e Histórico, não.

`REQ-632` **Operação** mostra as posições abertas da parte, **os dois lados separados** (o que a Usina
deve a ela e o que ela deve à Usina), **sem saldo líquido**: um líquido seria soma do Treasury e sugeriria
uma compensação que ninguém decidiu. Cada posição é uma linha (⚠ CONFIRMAR com o uso), com a idade
("aberta há N dias"), ordenadas da mais nova (padrão) ou da mais antiga. Um bloco **"depende de"** mostra as
expectativas que citam o **mesmo contexto** de uma posição da parte, com o que já foi recebido nelas.
Posição sem contexto não tem "depende de".

> **Refinamento de tela (2026-11-12).** Cada lado é uma **seção própria**, empilhada (nunca lado a lado,
> que convida a um líquido de cabeça): "{parte} tem a receber da Usina" e "{parte} deve à Usina". Cada
> seção tem seus filtros (ordem por abertura ou vencimento, tipo, período de abertura), sua lista em
> colunas fixas (posição, aberta há, vence em, em aberto) e sua **paginação feita pelo Ledger** (20 por
> página, ou 50), com a **contagem** do Ledger no título ("137 em aberto"), nunca um total. O "depende de"
> é um indicador curto na linha, e os detalhes abrem ao clicar. Os alertas ficam acima das seções e são
> lidos à parte, para não dependerem da página que está à vista. Motivo: uma parte pode ter centenas de
> posições por semana. Filtrar por **vencidas** e por **apólice** pede um filtro de leitura novo no Ledger
> (`DEC-042`).

```
Halisson
  A Usina deve:      77,26  obrigação de repasse · apólice 5177…        aberta há 22 dias
     depende de:     Allianz deve 128,77 na apólice 5177… · recebido 0,00
  Halisson deve:     50,00  adiantamento                                  aberta há 40 dias
  (sem líquido)
```

> O "depende de" torna visível o caso de `DEC-038`: repasse já pago e a expectativa da apólice ainda
> aberta.

`REQ-633` **Recebe também por.** A página de uma pessoa mostra as empresas pelas quais ela recebeu
(recebedoras em fatos em que ela foi destinatária final, `REQ-613`), com link para a página delas e **sem
somar** os números (`REQ-611`, `REQ-612`). A página da empresa mostra o que ela recebeu, inclusive para um
destinatário final (`REQ-615`). Há dois casos: o direito é da pessoa e a empresa é o caminho (a obrigação é
da pessoa), ou o direito é da empresa (a obrigação é da empresa). A Usina registra só o que conhece: quando
sabe que, de 300,00 pagos à Argo, 200,00 são do João e 100,00 da Argo, são **dois repasses**, um por
direito, na mesma transferência (`REQ-246`); o que a Argo faz depois com o dinheiro não é fato da Usina.

`REQ-634` **Alertas da página**, numa lista que pode ganhar e perder itens:

| Alerta | Regra |
| --- | --- |
| Pago sem obrigação: só no **repasse de comissão**, por enquanto; outros tipos podem entrar | `DEC-032` |
| Identidade provisória | `REQ-321` |
| Comissão prevista sem data esperada | `REQ-271` |
| Obrigação com vencimento passado | `REQ-227` |
| Repasse sem recebimento na apólice | `REQ-268` |

O alerta **expõe; não conclui**. Um pagamento sem obrigação e uma obrigação aberta com a mesma parte
aparecem lado a lado, e o Treasury nunca afirma sozinho que houve pagamento a mais: pode ser um
adiantamento combinado (`REQ-102`, `REQ-626`).

`REQ-635` **Prevenção do pagamento a mais** (responde `Q-048`). Quando um repasse passa do que está
aberto com a parte, a prévia mostra a obrigação aberta e oferece: pagar o aberto da obrigação **e o
excedente como adiantamento**, que fica como algo que a parte deve e pode ser compensado depois
(`REQ-250`, `REQ-256`), ou outra forma. Como corrigir um pagamento a mais já registrado sem vínculo fica em
`DEC-033`.

```
Obrigação aberta com o Halisson: 20,00 · o usuário vai pagar 30,00
  → "pagar 20,00 da obrigação + 10,00 como adiantamento" · "outra"
  escolhida a primeira: a obrigação fecha e o Halisson passa a dever 10,00
```

`REQ-636` **Histórico** conta em frases, em ordem, os fatos que **citam a parte** (`REQ-615`), no molde
da história da apólice (`REQ-276`), com link para a história de cada apólice citada. Entram também os
**sinais** sobre a parte, marcados como "sinal, ainda não registrado". Depois que o sinal vira fato,
**só o fato** aparece: a mesma coisa não é contada duas vezes (decidido em 2026-11-12). Quando a data do
fato e a do registro diferem, as **duas** aparecem. Um fato retirado aparece **riscado**, com a frase da retirada logo
abaixo. Os recibos (`REQ-245`) são abertos a partir da frase.

> **Refinamento de tela (2026-11-12), com viés de auditoria.** O Histórico segue o molde da Operação:
> uma lista ordenada pela **data de registro** (mais recente ou mais antigo primeiro), com filtros
> próprios (período de registro, tipo de fato, **registrado por**, situação válido/retirado),
> paginação (20 ou 50) e a contagem de registros. Cada linha mostra registrado em (com hora), o fato,
> **quem registrou** e o valor; a data do fato aparece só quando difere da do registro; o fato retirado
> vem riscado com "Retirado em … por …" (quem registrou a retificação). Os detalhes (identificador,
> origem, as duas datas, papel, posições e contextos citados, retificação) abrem ao clicar. Os **sinais
> ainda não registrados** ficam num bloco próprio no topo do Histórico, fora da lista dos fatos: são
> pendências, não história. Quem registrou vem do Ledger (o autor que ele guarda em cada fato); quem
> retirou, também (§17, C1).

```
09/11  A Usina pagou R$ 77,26 ao Halisson, pela Argo — repasse de comissão da apólice 5177…
       quitou a obrigação de 21/10 · registrado por cfo em 10/11
12/11  O sistema de seguro informou que o Halisson tem R$ 128,00 a receber na apólice 9034…
       (sinal, ainda não registrado)
```

> Um sinal de corretor ainda não ligado aparece na página da provisória. Um sinal com o corretor
> indefinido (os dois `⚠ CONFIRMAR` de `REQ-267`) não aparece em página de parte, só na tela do sistema de
> seguro.

`REQ-637` **Ações.** Cada linha da Operação oferece as ações que já existem a partir de uma posição
(`REQ-603`): pagar ligado à obrigação, receber ligado à comissão prevista, recuperar o adiantamento,
retificar. O **lote** (passo 4, `REQ-239`, `REQ-246`) e a **compensação** (passo 7, `REQ-252`) nascem
nesta página, selecionando posições da mesma parte. O lote preparado aparece na Operação.

`REQ-638` **Quem vê.** O visualizador vê as três seções, sem as ações (`REQ-401`). Todo usuário
autenticado consulta tudo (§6, decidido em 2026-11-13 com a `DEC-041`).

### 8.5 Agenda a pagar

> Decidida em 2026-11-13 (E2, `TODO-05`). Responde à dor 1 de §18.2: o CFO não sabe o que precisa ser
> pago hoje, e contas aparecem do nada.

`REQ-640` **O que entra.** A agenda mostra **tudo o que a Usina deve e ainda está em aberto**: as posições
dos tipos que o Ledger chama de "a Usina deve" (conta a pagar, obrigação de comissão, folha, taxa de
serviço, infraestrutura e imposto), com saldo em aberto maior que zero. Uma posição quitada, retirada
(`REQ-525`) ou de saldo desconhecido não entra: a de saldo desconhecido é um pagamento sem obrigação
conhecida, que não é uma dívida (`DEC-032`).

`REQ-641` **As janelas.** Cada posição cai em exatamente uma janela, pelo vencimento:

| Janela | Vencimento |
| --- | --- |
| **Vencido** | antes de hoje |
| **Hoje** | hoje |
| **Próximos dias** | de amanhã até daqui a 7 dias (`Q-055`; o piloto ajusta) |
| **Depois** | depois disso |
| **Sem vencimento** | nenhum vencimento conhecido |

"Hoje" é o dia no fuso de São Paulo (`REQ-225`). Uma posição **sem vencimento nunca é vencida nem de
hoje**: não saber o prazo não é estar atrasado (§4.1, `CLAUDE.md`, "Derivations must not assume
completeness").

`REQ-642` **Os totais de cada janela vêm do Ledger** (`REQ-601`). O Treasury não soma valores. O Ledger
publica a agenda como **uma leitura** sobre os fatos: não muda nenhum fato nem regra (`DEC-042`, item 1,
decidido em 2026-11-13).

`REQ-643` **A ordem.** Nas janelas com data, do vencimento mais antigo para o mais novo. Em "sem
vencimento", da posição aberta há mais tempo para a mais nova, com "aberta há N dias".

> **Os repasses a corretor caem em "sem vencimento"** (decidido em 2026-11-13): não há prazo combinado
> para pagar o corretor depois da elegibilidade, e o Treasury não inventa um. Se um prazo passar a existir,
> ele entra como fato, na obrigação.

`REQ-644` **Cada linha** mostra o credor, o que é, o valor em aberto (e o original, quando já foi pago em
parte) e o vencimento, ou "aberta há N dias" quando não há vencimento. Dela parte o **pagamento já ligado
àquela posição** (`REQ-603`). O visualizador vê tudo, sem a ação (`REQ-401`).

`REQ-645` Se o Ledger está fora do ar, a agenda diz **"indisponível"**, nunca uma janela vazia nem um total
zero (`REQ-602`).

| ID | Critério | Regra |
| --- | --- | --- |
| `CA-640` | Uma obrigação de comissão aberta aparece na agenda (antes, "a pagar" a deixava de fora, §17 C2) | `REQ-640` |
| `CA-641` | Vencimento ontem → vencido; hoje → hoje; daqui a 7 dias → próximos dias; daqui a 8 → depois; nenhum → sem vencimento | `REQ-641` |
| `CA-641b` | Às 23h de São Paulo, uma posição que vence hoje continua em "hoje" (e não em "vencido" nem no dia seguinte) | `REQ-641`, `REQ-225` |
| `CA-642` | O total de cada janela é o publicado pelo Ledger e é igual à soma dos saldos em aberto das suas posições | `REQ-642` |
| `CA-643` | "Sem vencimento" lista a mais antiga primeiro | `REQ-643` |
| `CA-644` | Uma posição paga em parte mostra o que falta; paga por inteiro, sai da agenda | `REQ-640`, `REQ-644` |
| `CA-644b` | Uma posição retirada sai da agenda | `REQ-640` |
| `CA-645` | Com o Ledger fora do ar, a agenda diz "indisponível" | `REQ-645` |

| ID | Caso que deve ser rejeitado | Regra |
| --- | --- | --- |
| `REJ-641` | Tratar uma posição sem vencimento como vencida ou de hoje | `REQ-641` |
| `REJ-642` | O Treasury somar os saldos para mostrar um total | `REQ-642` |

### 8.6 Pagamentos do dia em lote e a instituição do dinheiro

> Decidida em 2026-11-13 (E3, `TODO-08`). Responde à dor 3 de §18.2: com ≈1.140 pagamentos e repasses por
> semana, registrar um a um pela conversa é inviável. As regras do lote já estavam decididas (`REQ-239`,
> `REQ-246`, `REQ-249`); aqui entram a montagem a partir da agenda, a gravação do lote e a instituição
> (`DEC-044`).

`REQ-650` **A instituição do dinheiro** (`DEC-044`, decidida em 2026-11-13). Em que instituição o dinheiro
entrou ou saiu é um fato observado, e o fato de caixa passa a poder dizê-lo: o evento **cita a instituição
como contexto** (`cash_account`, relação `references`), do mesmo jeito que cita o lote. O molde do evento,
o hash e os eventos já gravados não mudam.
- Um evento de entrada ou de saída de dinheiro cita **no máximo uma** instituição.
- Um evento sem movimento de dinheiro (`NON_CASH`) **não cita** instituição: não há dinheiro para estar em
  algum lugar.
- Um evento que não cita instituição é de **"instituição desconhecida"**. Os eventos anteriores a esta
  regra ficam assim para sempre, **nunca distribuídos por suposição**.
- A transferência entre instituições (`CASH_INTERNAL`, que precisa de origem e destino) fica para o E6
  (`TODO-06`); até lá, o Ledger recusa a instituição nesse efeito.
- As instituições são uma lista do Treasury (hoje Bradesco, Itaú e a corretora). O identificador de cada
  uma (`instituicao:<nome>`) **não muda depois de usado**, porque fica gravado nos fatos.

`REQ-651` **Montar o lote na agenda** (amplia `REQ-239`). Na agenda a pagar (§8.5), quem pode registrar
pagamentos marca as linhas que vai pagar, de qualquer janela e de vários credores. O valor de cada linha
começa no saldo em aberto e pode ser **menor** (pagamento em parte, `REQ-246`), **nunca maior** (`Q-048`,
prevenção). Uma linha sem credor conhecido, com mais de um credor ou em outra moeda **não entra no lote**:
é paga pela posição, como antes. O lote preparado continua sendo rascunho do Treasury e nunca fato.

`REQ-652` **O lote preparado é gravado** (§17 R1): sobrevive a um reinício. Fica de pé até ser pago ou
descartado, e uma obrigação está em no máximo um lote de pé (`REJ-239`). Preparar, descartar e pagar são
auditados (`REQ-804`).

`REQ-653` **Anotar que pagou.** Depois de pagar no banco, o usuário informa **a data, a instituição e o
valor debitado** no banco. A instituição é escolhida na lista ou marcada explicitamente como **"não
informada"**: nunca preenchida por suposição. Antes de enviar qualquer coisa, o Treasury confere que o
débito é igual à soma das linhas do lote (`REQ-246`); se não for, **nada é enviado**. Conferido, vira **um
evento por linha** (`REQ-246`), cada um quitando a sua obrigação, pago ao credor dela, citando o lote e a
instituição. Um recusado não impede os demais (`REQ-249`). O resultado mostra cada linha (registrada ou
recusada, com o motivo) e a diferença entre o débito e o que foi registrado.
> A soma do lote não contradiz `REQ-642`: são os valores que o próprio usuário escolheu, conferidos contra
> o extrato, e não saldos do Ledger.

`REQ-654` **Um lote é pago uma vez.** Anotado o pagamento, o lote sai dos lotes de pé e guarda o resultado.
Anotar de novo é recusado: o dinheiro saiu do banco uma vez. Uma linha recusada continua visível no lote, e
a correção é feita pela posição.

| ID | Critério | Regra |
| --- | --- | --- |
| `CA-650` | Pagamento anotado no Itaú → o evento cita `instituicao:itau` como contexto; o caixa e a posição mudam como antes | `REQ-650` |
| `CA-650b` | Pagamento com a instituição "não informada" → o evento não cita instituição | `REQ-650`, `REQ-653` |
| `CA-651` | Na agenda, João 300,00 (repasse) e um fornecedor 200,00 → um lote preparado com as duas linhas, de dois credores | `REQ-651` |
| `CA-651b` | 150,00 numa obrigação de 120,00 em aberto → recusado ao preparar | `REQ-651` |
| `CA-652` | Lote preparado, servidor reiniciado → o lote continua de pé com as mesmas linhas | `REQ-652` |
| `CA-653` | Débito de 500,00 no lote de 300,00 + 200,00, no Itaú → dois eventos, os dois citando o mesmo lote e o Itaú; as duas obrigações saem da agenda | `REQ-653` |
| `CA-653b` | Débito de 510,00 no mesmo lote → recusado, nenhum evento enviado, o lote continua de pé | `REQ-653` |
| `CA-653c` | Lote de três linhas, uma já paga por outro caminho → as outras duas registradas, a recusada aparece com o motivo, e a diferença com o débito é o valor dela | `REQ-653`, `REQ-249` |
| `CA-654` | Anotar de novo o pagamento de um lote já pago → recusado | `REQ-654` |

| ID | Caso que deve ser rejeitado | Regra |
| --- | --- | --- |
| `REJ-650` | Distribuir eventos sem instituição entre as instituições, por suposição | `REQ-650` |
| `REJ-650b` | Um evento citando duas instituições, ou uma instituição num evento sem dinheiro | `REQ-650` |
| `REJ-653` | Enviar algum evento quando o débito não bate com a soma do lote | `REQ-653` |

---

## 9. Entrada por texto livre

> Já decidido: é requisito; o texto só propõe; o limiar de confiança é 0,5. A revisão da
> classificação, com confirmação e troca de operação, é melhoria futura (`DEC-005`).

`REQ-701` O usuário pode começar uma operação por **texto livre**. O sistema classifica a frase
numa operação, preenche o que conseguir extrair com confiança e **pergunta o resto** pela coleta
guiada (`REQ-210`).

`REQ-702` O texto livre **só propõe**. Toda proposta passa pela **mesma validação** da coleta
guiada antes de ser registrada.

`REQ-703` Uma proposta do texto livre com confiança **abaixo de 0,5 não é aplicada**. Com
confiança **igual ou maior que 0,5**, ela segue para a validação de `REQ-702`. O campo de uma
proposta não aplicada é perguntado normalmente pela coleta guiada.

```
Proposta "valor = 2.000,00", confiança 0,8 → validada e registrada
Proposta "data = 10/07/2026", confiança 0,5 → validada e registrada
Proposta "recebedor = João", confiança 0,3 → não aplicada; o sistema pergunta "quem recebe"
```

> O limiar pode mudar com a revisão da classificação (`DEC-005`).

---

## 10. Auditoria e rastro

> Já decidido: toda operação é auditada permanentemente, com o autor identificado; a auditoria
> cobre só o que é operação. Observar cada passo da conversa fica em aberto (`DEC-012`).

`REQ-801` **Toda operação é auditada de forma permanente.** O registro de auditoria **nunca é
apagado**.

`REQ-802` Todo registro de auditoria **identifica o autor**: um **usuário identificado** ou um
**sistema externo identificado**. Não existe registro de auditoria sem autor.

> Protege a rastreabilidade: sempre dá para responder "quem fez isto", inclusive quando o evento
> veio de fora do Treasury.

`REQ-803` Todo registro de auditoria diz **quando** aconteceu e **o que** foi feito. A auditoria responde a três perguntas: **quem**, **quando** e **o quê**.

`REQ-804` A auditoria cobre **somente o que conta como operação**: o que é **enviado ao Ledger**, os
**anexos** de um fato (`REQ-247`) e o **descarte de um lote preparado** (`REQ-239`, acrescentado em
2026-11-12). Cada passo da conversa (respostas, recusas de campo, correções
antes do envio) **não é** auditado por esta regra.

> Observar o comportamento do usuário antes de ele confirmar uma ação é uma ideia em aberto, como
> log (`DEC-012`), e não faz parte da auditoria.

`REQ-805` O **molde do evento não muda** conforme a origem do fato. O evento diz quem o anotou: o
**sistema integrado**, quando veio de fora, ou o **usuário**, quando veio de dentro (planilha,
conversa, sistema ainda não integrado). Quando um usuário confirma um sinal externo (`REQ-323`), o
autor do evento é o sistema, e a auditoria do Treasury registra o usuário que confirmou.

`REQ-807` **Quem assina é quem está logado** (molde `REQ-216`, adotado em 2026-11-13). O autor de um
ato auditado (`REQ-804`) e de um ato da gestão de usuários (§6) é o **usuário autenticado** que o pratica.
O autor **não é digitado** nem enviado pela tela: o ato continua explícito ("enviar", "convidar"), e quem
assina é quem está logado. O autor é guardado pelo **id do usuário** e exibido pelo nome ou, sem nome,
pelo e-mail (`REQ-400`). Data e hora são as do momento em que o ato é registrado. A forma de identificar
o usuário fica desacoplada das regras que exigem a assinatura. `REQ-805` continua valendo: o que vem de
um sistema integrado é anotado pelo sistema, e a auditoria registra o usuário que confirmou.

> Nenhum ato passa a ter autor só porque o login existe: a lista de atos assinados é a de `REQ-804` mais a
> gestão de usuários (molde `DEC-401`, `[INT-05]`).

`REQ-806` A **confiança** do fato acompanha a forma como ele ficou conhecido:

```
Sinal de sistema externo, confirmado por um usuário        → média
Usuário soube por planilha, conversa ou outro sistema      → média
Usuário viu o banco ou o documento                         → alta
```

O Ledger recusa confiança baixa nos eventos que exigem no mínimo a média, como comissão recebida; por
isso um sinal sem confirmação não vira fato. A retificação continua exigindo confiança alta.

---

## 11. Estados e transições

### 11.1 Intenção

> Os estados vão mudar bastante depois do MDM (`DEC-007`). Abaixo está o que vale hoje.

| Estado | Significado | Editável |
| --- | --- | --- |
| **Coletando** | Faltam campos obrigatórios | As respostas |
| **Pronta para envio** | Todos os campos obrigatórios foram respondidos, a prévia está na tela e o usuário ainda **não apertou "enviar"** | As respostas, refazendo a prévia (`REQ-214`) |
| **Enviada** | Candidato enviado; aguardando o Ledger | Nada |
| **Aguardando correção** | Recusa corrigível (`REQ-502`) | Qualquer campo (`REQ-510`) |
| **Aceita** | O Ledger aceitou (`REQ-501`) | **Nada** |
| **Recusada** | Recusa definitiva (`REQ-503`) | **Nada** |

| De | Para | Quem / o quê move |
| --- | --- | --- |
| (início) | Coletando | O usuário inicia a operação (`REQ-210`, `REQ-701`) |
| Coletando | Pronta para envio | O último campo obrigatório é preenchido (`REQ-212`) |
| Pronta para envio | Pronta para envio | O usuário corrige uma resposta e a prévia é refeita (`REQ-214`) |
| Pronta para envio | Enviada | O usuário confirma (`REQ-213`) |
| Enviada | Aceita | O Ledger aceita (`REQ-501`) |
| Enviada | Aguardando correção | Recusa corrigível (`REQ-502`) |
| Enviada | Recusada | Recusa definitiva (`REQ-503`) |
| Aguardando correção | Pronta para envio | O usuário corrige qualquer campo (`REQ-510`) |

> **Renomeado na rodada 3:** "aguardando confirmação" → **"pronta para envio"**, um nome mais
> claro para quem opera (`Q-021`).

**Não utilizados:** **rascunho** e **confirmada** existem no código, mas nenhum fluxo os usa
(`Q-006`). Não são estados do negócio.

### 11.2 Parte

Os estados antigos (identificada / não identificável / mesclada) foram substituídos. Em definição:

| Estado | Significado | Quem / o quê move |
| --- | --- | --- |
| **Provisória** | Fato registrado com alguém ainda não cadastrado (`REQ-320`) | Uma operação com parte não cadastrada |
| **Resolvida** | Ligada a uma parte cadastrada (`REQ-322`) | Quem tem curadoria |
| **Cadastrada** | Parte criada por quem tem curadoria (`REQ-311`) | Quem tem curadoria |

---

## 12. Alteração e correção

- **Antes do envio:** as respostas da intenção podem mudar, inclusive com a prévia na tela
  (`REQ-214`). Essas mudanças **não** são auditadas (`REQ-804`).
- **Depois do aceite:** o fato **não muda**. A única correção é a **retificação** (§7.3), que é
  auditada com autor identificado (`REQ-801`, `REQ-802`), quando foi feita e o que foi feito
  (`REQ-803`, `REQ-804`).
- **Partes:** uma parte cadastrada ou um mapeamento de identidade **nunca é apagado nem reescrito**; como desfazer uma ligação errada está em `DEC-015` (`REQ-331`). O fato no Ledger nunca muda por causa de identidade (`REQ-332`).

---

## 13. Fluxos principais

**FP-01 — Operação guiada**
1. O gestor financeiro escolhe uma operação do catálogo (`REQ-201`, `REQ-203`, `REQ-401`).
2. O sistema pergunta o próximo campo obrigatório vazio (`REQ-210`).
3. Cada resposta é validada (`REQ-211`, `REQ-220`–`REQ-225`).
   - valor com mais de 2 casas → recusado, com o valor arredondado sugerido; aceito → registrado
     (`REQ-221`).
   - data de ocorrência futura → recusada (`REQ-226`).
4. Com tudo preenchido, o sistema mostra a prévia exata (`REQ-212`); o estado é "pronta para
   envio".
   - o usuário corrige uma resposta → a resposta é validada e a prévia é refeita (`REQ-214`).
5. O usuário confirma e o candidato é enviado (`REQ-213`, `REQ-101`).
   - aceito → intenção aceita (`REQ-501`);
   - recusa corrigível → FP-05 (`REQ-502`);
   - recusa definitiva → intenção recusada (`REQ-503`).

**FP-02 — Entrada por texto livre**
1. O usuário escreve uma frase (`REQ-701`).
2. O sistema classifica a operação e propõe valores (`REQ-702`).
   - classificou → segue FP-01 a partir do passo 2, com os campos propostos já validados;
   - não classificou → o usuário escolhe a operação no catálogo.

**FP-03 — Resolução de contraparte** — **retirado em 2026-11-04**, substituído por FP-10.

**FP-04 — Enriquecimento na prévia** — **depreciado** (`DEC-002`).

**FP-05 — Recusa corrigível**
1. O Ledger recusa por motivo corrigível (`REQ-502`).
2. O sistema volta a perguntar o campo afetado (`REQ-502`).
3. O usuário corrige, vê a nova prévia e reenvia (`REQ-510`, `REQ-212`).

**FP-06 — Retificação**
1. O usuário aponta o lançamento que nunca aconteceu (`REQ-520`, `REQ-522`).
2. O sistema registra a retirada (`REQ-521`, `REQ-524`).
   - sem valor correto → fim;
   - com valor correto → 3.
3. O sistema registra a reemissão, alterando só valor, data e descrição (`REQ-521`, `REQ-523`).
   - falhou → a posição fica subestimada e a retificação fica retomável (`REQ-521`).

**FP-07 — Ação a partir de uma posição**
1. O usuário abre uma posição (`REQ-601`).
2. O sistema lista as ações possíveis (`REQ-603`).
3. O usuário escolhe uma ação; o sistema pré-preenche o que a posição sabe e segue FP-01 a partir
   do passo 2 (`REQ-603`, `REQ-604`, `REQ-210`).

**FP-08 — Consultas**
1. O usuário abre uma consulta (`REQ-401`).
2. O sistema mostra o que o Ledger publicou (`REQ-601`).
   - Ledger fora do ar → "indisponível" (`REQ-602`).

**FP-09 — Importação de contrapartes** — **retirado em 2026-11-04** (a carga é feita pelo
Treasury a partir das três fontes, §5).

**FP-10 — Fato com parte não cadastrada**
1. O operador procura a parte no cadastro (`REQ-311`).
   - encontrou → segue FP-01;
   - não encontrou → 2.
2. O fato é registrado com identidade provisória (`REQ-320`).
3. A notificação insistente aparece (`REQ-321`).
4. Quem tem curadoria liga a provisória a uma parte cadastrada (`REQ-322`); o mapeamento ganha
   uma entrada (`REQ-330`, `REQ-331`).
5. A notificação some, e a visão da parte passa a mostrar o fato (`REQ-332`, `REQ-612`).

**FP-12 — Evento do sistema externo**
1. O evento chega do sistema externo (`REQ-323`).
   - parte com dúvida → identidade provisória (`REQ-324`, `REQ-320`).
2. Um usuário confere e confirma no Treasury (`REQ-323`).
3. O fato vai para o Ledger, com o sistema externo identificado na auditoria (`REQ-802`).

**FP-11 — Repasse de comissão**
1. Comissão prevista e recebida chegam do sistema externo ou de um usuário e são anotadas (`REQ-240`).
2. O Treasury ajuda a organizar o repasse (`REQ-241`) e sugere a forma do último evento (`REQ-614`).
3. O usuário define a forma do repasse (`REQ-242`), anotada no Ledger (`REQ-243`, `REQ-613`).
4. Gera-se o extrato de recebível de cada pessoa (`REQ-244`).
5. Depois do pagamento bancário, unitário ou em lote (`REQ-246`), anota-se o pagamento, anexa-se o
   extrato bancário se houver (`REQ-247`) e emitem-se os recibos (`REQ-245`).

---

## 14. Fluxos alternativos, exceções, aceitação e rejeição

### 14.1 Fluxos alternativos

| ID | Fluxo | Regras |
| --- | --- | --- |
| `FA-201` | Comissão recebida sem origem: registrada como origem desconhecida, pendente de complemento | `REQ-203` |
| `FA-202` | Reconhecimento de obrigação depois do pagamento: aponta a posição já paga e declara que o conhecimento chegou tarde | `REQ-203` |
| `FA-521` | Retificação só com retirada, sem reemissão | `REQ-521` |

### 14.2 Exceções

| ID | Exceção | Regras |
| --- | --- | --- |
| `EX-521` | A reemissão falha depois da retirada: a posição fica subestimada e a retificação fica retomável | `REQ-521` |
| `EX-602` | Ledger fora do ar numa consulta | `REQ-602` |
| `EX-701` | O texto livre não identifica a operação: volta ao catálogo | `REQ-701` |

### 14.3 Critérios de aceitação

| ID | Critério | Verifica |
| --- | --- | --- |
| `CA-210` | Multa sem nenhuma resposta → a primeira pergunta é "quem recebe" | `REQ-210` |
| `CA-212` | Folha de 1.500,00 BRL em 09/07/2026 → a prévia mostra 1.500,00 BRL em 09/07/2026, e o enviado é idêntico | `REQ-212` |
| `CA-220` | Dígitos "15005" → R$ 150,05 | `REQ-220`, `REQ-224` |
| `CA-221` | Texto livre com valor "10,125" → recusado com a sugestão 10,12; o usuário aceita → registrado 10,12 | `REQ-221` |
| `CA-221b` | Sugestões da NBR 5891: 10,124→10,12 · 10,126→10,13 · 10,135→10,14 · 10,1251→10,13 | `REQ-221` |
| `CA-221c` | Texto livre com valor "10,125" → recusado com a sugestão 10,12; o usuário **não** aceita → nada é registrado e o campo é perguntado de novo | `REQ-221` |
| `CA-222` | Operação nova sem moeda escolhida → moeda BRL | `REQ-222` |
| `CA-223` | Valor 0,01 → aceito · valor 1.000.000.000,00 → aceito (sem teto) | `REQ-223` |
| `CA-224` | Dígitos "2000" → R$ 20,00 · "200000" → R$ 2.000,00 | `REQ-224` |
| `CA-226` | Hoje 03/11/2026: ocorrência 03/11/2026 → aceita · 10/11/2026 → recusada | `REQ-226` |
| `CA-227` | Reconhecimento de obrigação em 03/11/2026 com vencimento em 10/12/2026 → aceito | `REQ-227` |
| `CA-229` | Comissão prevista surgida em 06/11/2026, esperada para 15/12/2026 → aceita · surgida em 15/12/2026, com hoje em 06/11/2026 → recusada | `REQ-229` |
| `CA-214` | Prévia de folha de 1.500,00; o usuário corrige para 1.550,00 → nova prévia e envio de 1.550,00 | `REQ-214` |
| `CA-804` | O usuário responde três campos e desiste antes de enviar → nada é auditado | `REQ-804` |
| `CA-225` | Data de pagamento digitada 10/07/2026 → registrada como 10/07/2026 no horário de São Paulo | `REQ-225` |
| `CA-301` | Comissão recebida de 800,00 com pagador não identificável → aceita e marcada pendente de validação | `REQ-301`, `REQ-302` |
| `CA-401` | Visualizador abre o painel → permitido | `REQ-401` |
| `CA-502` | Quitação de empréstimo recusada por origem inválida → o sistema volta a perguntar a origem; intenção aguardando correção | `REQ-502` |
| `CA-503` | Candidato recusado como duplicado → intenção recusada | `REQ-503` |
| `CA-521` | Adiantamento de 400,00 retificado para 450,00 → posição final 450,00; o 400,00 continua no histórico | `REQ-521`, `REQ-524` |
| `CA-521b` | O mesmo caso interrompido após a retirada → posição 0,00 | `REQ-521` |
| `CA-602` | Painel com o Ledger fora do ar → "indisponível" | `REQ-602` |
| `CA-604` | Recuperação aberta a partir de um adiantamento feito a João → recuperação já traz João como pagador | `REQ-604` |
| `CA-604b` | Recebimento de comissão aberto a partir de uma comissão a receber → o sistema pergunta quem pagou | `REQ-604` |
| `CA-701` | "conceder um adiantamento de 2000,00 em 2026-07-10" → operação adiantamento, valor 2.000,00, data 10/07/2026; o sistema pergunta quem recebe | `REQ-701`, `REQ-702` |
| `CA-703` | Proposta com confiança 0,49 → não aplicada · com 0,50 → validada e registrada | `REQ-703` |
| `CA-311` | Usuário sem curadoria tenta cadastrar a parte "Maria Souza" → negado | `REQ-311`, `REQ-402` |
| `CA-320` | Folha de 1.500,00 paga a "Maria Souza", não cadastrada → fato registrado com identidade provisória; a notificação aparece | `REQ-320`, `REQ-321` |
| `CA-314` | Cadastrar a Argo, que recebe por conta bancária, sem CNPJ → negado · cadastrar uma parte sem conta bancária, sem documento → aceito | `REQ-314` |
| `CA-322` | Provisória-123 ligada à parte "Maria Souza" → a notificação some; a visão da Maria mostra a folha | `REQ-322`, `REQ-321` |
| `CA-323` | Comissão recebida chega do sistema externo → fica esperando confirmação; só vai ao Ledger depois de um usuário confirmar | `REQ-323` |
| `CA-324` | Evento externo com corretor "J. Silva" sem correspondente no cadastro → o corretor recebe identidade provisória | `REQ-324` |
| `CA-615` | Filtro "João" com três eventos em papéis diferentes → os três aparecem | `REQ-615` |
| `CA-332` | Três pagamentos com "Fornecedor Alfa", "ALFA LTDA" e provisória-123, mapeados para a Alfa → a visão da Alfa mostra os três; o Ledger não muda | `REQ-332` |
| `CA-613` | Repasse de 300,00 ao João pela Argo → o evento cita Argo (recebedora) e João (destinatário final); o filtro "João" e o filtro "Argo" mostram o evento | `REQ-613`, `REQ-612` |
| `CA-614` | O último repasse do João foi pela Argo → o novo repasse sugere Argo; o usuário troca para conta própria → registrado conta própria | `REQ-614` |
| `CA-801` | O gestor "cfo" envia uma folha → a auditoria registra "cfo" como autor | `REQ-801`, `REQ-802` |
| `CA-802` | Um evento chega de um sistema externo → a auditoria registra a identificação desse sistema como autor | `REQ-802` |
| `CA-250` | Adiantamento 300,00 e obrigação 600,00; compensação de 300,00 → um evento; adiantamento aberto 0,00, obrigação aberta 300,00, caixa igual | `REQ-250` |
| `CA-250b` | Adiantamento 300,00 e obrigação 200,00; compensação de 300,00 → recusada; adiantamento aberto 300,00 e obrigação aberta 200,00 | `REQ-250` |
| `CA-250c` | Adiantamento 300,00 e obrigação 600,00; compensação de 100,00 → adiantamento aberto 200,00, obrigação aberta 500,00, caixa igual | `REQ-250` |
| `CA-252` | Compensação no Treasury → só oferece posições da mesma pessoa | `REQ-252` |
| `CA-253` | Obrigação de comissão de 600,00 com o João, sem caixa → aceita, aberta 600,00, caixa igual | `REQ-253` |
| `CA-254` | Obrigação de comissão aberta de 600,00 → soma 600,00 no que a Usina tem a pagar e nada no que devem à Usina | `REQ-254` |
| `CA-255` | Plano de dois fatos, interrompido depois do primeiro → o primeiro continua no caderno e o usuário vê que o segundo não foi enviado | `REQ-255` |
| `CA-256` | Obrigação aberta de 600,00 e pedido de 300,00 → o usuário escolhe adiantamento mais compensação ou pagamento parcial; a escolha decide os eventos enviados | `REQ-256` |
| `CA-258` | Recebidos 30,00; obrigações de 9,00 ao corretor e 3,00 ao supervisor → duas posições, cada uma com a sua parte; pagas, as duas fecham | `REQ-258` |
| `CA-258b` | Recebidos 30,00; obrigação de 40,00 → aceita; o saldo do contexto, com os 40,00 pagos, é -10,00 | `REQ-258`, `REQ-621` |
| `CA-525` | Compensação retirada citando as duas posições → adiantamento aberto 300,00 e obrigação aberta 600,00 | `REQ-525` |
| `CA-620` | Eventos dos corretores A, B e C de `REQ-620` → saldos +600,00, +1.400,00 e -150,00 | `REQ-620` |
| `CA-620b` | Um evento do corretor foi retirado → deixa de contar no total dele | `REQ-620` |
| `CA-620c` | Filtro por período → só contam os eventos ocorridos no período | `REQ-620` |
| `CA-621` | Produto com 1.000,00 recebidos e 650,00 pagos → +350,00; 600,00 e 600,00 → 0,00; 600,00 e 650,00 → -50,00 | `REQ-621` |
| `CA-621b` | Adiantamento de 300,00 sem produto; depois compensado; produto recebe 1.000,00 e paga 300,00 → saldo do corretor +400,00 e do produto +700,00, com aviso de que o produto só mostra o caixa que o cita | `REQ-620`, `REQ-621` |
| `CA-622` | Produto com saldo +700,00 e obrigação aberta de 200,00 → a leitura mostra os dois | `REQ-622` |
| `CA-623` | Saldos +600,00, +1.400,00 e -150,00 mais tributo de 999,00 sem corretor → não atribuído -999,00; total 851,00, igual ao caixa do caderno | `REQ-623` |
| `CA-624` | Sequência de `REQ-624` → as duas posições aparecem como fechadas por compensação nos dois casos; saldos +700,00 e -300,00 | `REQ-624` |
| `CA-626` | Corretor com saldo negativo → o Treasury mostra quanto trouxe e quanto custou, sem rótulo de qualidade | `REQ-626` |
| `CA-244` | Extrato de recebível do João com 600,00 em aberto → mostra 600,00; o caixa e a posição não mudam, e nenhum evento é enviado | `REQ-244` |
| `CA-245` | Extrato gerado e pagamento anotado de 600,00 → obrigação aberta 0,00 e caixa -600,00 | `REQ-245` |
| `CA-246` | Lote de 500,00: João 300,00 e Maria 200,00 → dois eventos com o mesmo contexto de lote, soma 500,00, as duas obrigações fechadas | `REQ-246` |
| `CA-246b` | Lote de 1.200,00 ao Halisson com 10 obrigações de 120,00 → 10 repasses com o mesmo lote, soma 1.200,00, as 10 obrigações fechadas | `REQ-246` |
| `CA-246c` | Lote com 100,00 numa obrigação de 120,00 → a obrigação fica com 20,00 em aberto | `REQ-246` |
| `CA-249` | Lote de 10 repasses com o nº 3 recusado → os outros nove são registrados; o nº 3 aparece como recusado e a diferença de 120,00 aparece no lote | `REQ-249` |
| `CA-247` | Extrato bancário anexado a dois eventos do lote, depois do pagamento → os dois mostram o arquivo, o hash fica guardado e os eventos no Ledger não mudam | `REQ-247` |
| `CA-247b` | Arquivo anexado → a auditoria registra quem anexou, quando e a qual fato | `REQ-247`, `REQ-804` |
| `CA-248` | Operador sem acesso especial registra o pagamento → aceito, e a auditoria mostra quem foi | `REQ-248` |
| `CA-805` | Mesmo fato anotado por um usuário e por um sistema integrado → mesmo evento, autores diferentes | `REQ-805` |
| `CA-805b` | Sinal externo confirmado por um usuário → o autor do evento é o sistema; a auditoria mostra o usuário que confirmou | `REQ-805` |
| `CA-806` | Usuário soube por conversa → confiança média · viu o banco → confiança alta · sinal externo confirmado → confiança média | `REQ-806` |
| `CA-260` | Sinal de elegibilidade da apólice 5177…285 registrado → cópia e hash guardados no Treasury; nenhum evento enviado ao Ledger | `REQ-260` |
| `CA-261` | Sinal de apólice → comissão prevista proposta; sinal de elegibilidade → obrigação proposta. O usuário confirma só a obrigação → só ela vai ao Ledger, e a prevista continua proposta | `REQ-261` |
| `CA-261b` | Sinal preenchido pelo usuário a partir da tela → o autor do evento é o usuário e a confiança é média | `REQ-261`, `REQ-805`, `REQ-806` |
| `CA-262` | Elegibilidade de 77,26 ao Halisson confirmada → obrigação de comissão aberta de 77,26 citando `seguro:apolice:<id>`; caixa igual | `REQ-262`, `REQ-267` |
| `CA-263` | Elegibilidade confirmada, sem recebimento registrado → o Treasury mostra "a Allianz diz que pagou 128,77; o recebimento ainda não foi visto no banco"; o caixa não muda | `REQ-263` |
| `CA-264` | Prevista 128,77 e obrigação 77,26 → o Treasury mostra 51,51 retidos como diferença, sem nenhum evento de 51,51 | `REQ-264` |
| `CA-265` | Mesmo sinal de elegibilidade confirmado duas vezes → o Treasury avisa; se enviado, o Ledger recusa como duplicado e há uma só obrigação | `REQ-265` |
| `CA-266` | Nova leitura com CR 65% depois de confirmada a de 60% → o Treasury mostra 77,26 registrados e 83,70 na nova leitura; nada é enviado sem o usuário | `REQ-266` |
| `CA-267` | Corretor com id externo cadastrado → ligado pela apólice · sem id ou com dúvida → identidade provisória | `REQ-267`, `REQ-324` |
| `CA-268` | Repasse de 77,26 sem recebimento registrado na apólice → aviso antes do envio; aceito pelo Ledger se o usuário enviar | `REQ-268` |
| `CA-268b` | Recebimento registrado para a Allianz → o Treasury sugere ligá-lo à comissão prevista da apólice | `REQ-268` |
| `CA-269` | Crédito de 3.400,00 da Allianz cobrindo várias apólices → um contexto de lote, uma comissão recebida por apólice citando o lote; o não atribuído fica visível | `REQ-269` |
| `CA-269b` | Prevista 128,77 e recebidos 120,00 → 8,77 continuam a receber | `REQ-269` |
| `CA-270` | Elegibilidade de 77,26 com adiantamento aberto de 50,00 → obrigação de 77,26, com o adiantamento mostrado na prévia | `REQ-270` |
| `CA-271` | Comissão prevista sem data esperada → aceita, com alerta de pendência, e nunca listada como atrasada | `REQ-271` |
| `CA-272` | Elegibilidade da apólice 5177…285 → obrigação de 77,26 e comissão prevista de 128,77; com a data da apólice 15/09/2026, a prevista surge nessa data | `REQ-272` |
| `CA-272b` | Apólice registrada antes, depois a elegibilidade → a comissão prevista aponta para a proposta que já existe | `REQ-272`, `REQ-265` |
| `CA-273` | Seguradora com o id cadastrado → comissão prevista com a Usina como beneficiária e a seguradora como `payer`; desconhecida → identidade provisória "Allianz" | `REQ-273` |
| `CA-274` | Registrar o recebimento a partir da comissão prevista → quem pagou já vem preenchido com a seguradora | `REQ-274` |
| `CA-275` | Recebimento lançado a partir de `…:prevista` → cita a posição (`settles`) e a apólice (`references`); a reemissão de uma retificação cita a apólice de novo | `REQ-275` |
| `CA-275b` | Abertura que citava apólice, proposta e outra posição → a operação herda a apólice e a proposta, não a outra posição | `REQ-275` |
| `CA-277` | Crédito da Allianz de 3.400,00: 128,77, 1.000,00 e 2.171,23 distribuídos → três recebimentos citando a sua apólice e o mesmo lote, mais 100,00 sem origem citando o lote; caixa +3.400,00; 1.000,00 ainda a receber na 8812 | `REQ-277` |
| `CA-277b` | O segundo de três recebimentos é recusado → o primeiro continua registrado, os seguintes não são enviados e aparecem como "não enviado" | `REQ-277`, `REQ-255` |
| `CA-630` | Clicar em "Halisson" em qualquer lista → abre a página dele com Operação, Histórico e Resultados, nessa ordem · página da "Maria Souza (provisória)" mostra o rótulo | `REQ-630`, `REQ-631` |
| `CA-632` | Halisson com obrigação de 77,26 na apólice 5177…, adiantamento de 50,00 e a Allianz devendo 128,77 na mesma apólice → os dois lados separados, sem líquido, e a comissão da Allianz em "depende de" | `REQ-632` |
| `CA-633` | Repasse de 300,00 à Argo com destino ao João → a página do João mostra "recebe também por: Argo" e a da Argo mostra o repasse; nenhuma soma as duas | `REQ-633` |
| `CA-634` | Repasse de 30,00 sem obrigação e obrigação aberta de 20,00 com o Halisson → os dois aparecem lado a lado, sem a palavra "a mais" | `REQ-634` |
| `CA-635` | Pagar 30,00 ao Halisson com 20,00 abertos → a prévia oferece 20,00 da obrigação + 10,00 de adiantamento; escolhida, a obrigação fecha e o adiantamento abre com 10,00 | `REQ-635` |
| `CA-636` | Fato de 09/11 registrado em 10/11 → a frase mostra as duas datas · fato retirado → riscado, com a frase da retirada · sinal → marcado como sinal | `REQ-636` |
| `CA-239` | Lote preparado descartado → as obrigações voltam a poder entrar em outro lote, e a auditoria registra quem descartou | `REQ-239`, `REQ-804` |
| `CA-276` | Comissão prevista, obrigação, recebimento, repasse e um repasse retirado, mais o sinal → seis linhas em ordem de data, com quem pagou a quem; a retirada marcada como retirada | `REQ-276` |

### 14.4 Casos que devem ser rejeitados

| ID | Caso | Regra |
| --- | --- | --- |
| `REJ-202` | Oferecer uma operação sem correspondente na álgebra do Ledger | `REQ-202` |
| `REJ-211` | Registrar resposta com forma inválida (ex.: valor "abc") | `REQ-211` |
| `REJ-212` | Enviar algo diferente do que a prévia mostrou | `REQ-212` |
| `REJ-213` | Enviar sem prévia ou sem o clique em "enviar" | `REQ-213` |
| `REJ-220` | Registrar valor com 3 casas decimais (ex.: 10,125) | `REQ-220`, `REQ-221` |
| `REJ-221` | Arredondar em silêncio, sem o usuário aceitar a sugestão | `REQ-221` |
| `REJ-223` | Valor 0,00 ou negativo (ex.: -50,00) | `REQ-223` |
| `REJ-224` | Máscara mostrar "2000" como R$ 2.000,00 | `REQ-224` |
| `REJ-226` | Folha paga em data posterior a hoje | `REQ-226` |
| `REJ-214` | Enviar a prévia antiga depois de uma correção | `REQ-214`, `REQ-212` |
| `REJ-228` | Enviar ao Ledger um valor com vírgula ou "R$" (ex.: "1.500,00") | `REQ-228` |
| `REJ-225` | Gravar 10/07/2026 como 09/07/2026 por causa de fuso | `REQ-225` |
| `REJ-604` | Pré-preencher a contraparte numa operação fora das três de `REQ-604` | `REQ-604` |
| `REJ-703` | Aplicar proposta com confiança abaixo de 0,5 | `REQ-703` |
| `REJ-242` | O Treasury definir sozinho a forma do repasse | `REQ-242` |
| `REJ-244` | Pagamento bancário de um **lote** sem extrato de recebível antes | `REQ-244` |
| `REJ-311` | O operador criar uma parte durante a operação | `REQ-311` |
| `REJ-313` | Cadastrar o cliente final como parte | `REQ-313` |
| `REJ-320` | Deixar de registrar um fato porque a parte não está cadastrada | `REQ-320` |
| `REJ-321` | Identidade provisória sem resolução e sem notificação | `REQ-321` |
| `REJ-314` | Cadastrar parte que recebe ou paga por conta bancária sem CPF/CNPJ | `REQ-314` |
| `REJ-322` | Operador sem curadoria resolver uma identidade provisória | `REQ-322`, `REQ-402` |
| `REJ-323` | Evento do sistema externo ir ao Ledger sem confirmação de um usuário | `REQ-323` |
| `REJ-615` | Filtro "João" omitir um evento em que ele é destinatário final | `REQ-615` |
| `REJ-330` | Gravar o mapeamento de identidade no Ledger | `REQ-330` |
| `REJ-331` | Apagar ou reescrever uma ligação do mapeamento | `REQ-331` |
| `REJ-332` | Reescrever um fato do Ledger para corrigir a identidade | `REQ-332` |
| `REJ-611` | Exigir vínculo cadastral pessoa–grupo para registrar um evento | `REQ-611` |
| `REJ-614` | Aplicar a sugestão do último evento sem o usuário confirmar | `REQ-614` |
| `REJ-801` | Apagar um registro de auditoria | `REQ-801` |
| `REJ-802` | Registro de auditoria sem autor identificado | `REQ-802` |
| `REJ-301` | Contraparte não identificável num pagamento de folha | `REQ-301` |
| `REJ-302` | Movimentação com contraparte não identificável sem marca de pendente | `REQ-302` |
| `REJ-401` | Visualizador iniciar ou enviar uma operação | `REQ-401` |
| `REJ-521` | Reemitir antes de retirar | `REQ-521` |
| `REJ-522` | Retificar uma multa | `REQ-522` |
| `REJ-523` | Reemissão que troca a contraparte | `REQ-523` |
| `REJ-524` | Retificação que apaga o lançamento original | `REQ-524` |
| `REJ-601` | Mostrar um total recalculado pelo Treasury | `REQ-601` |
| `REJ-602` | Mostrar 0,00 com o Ledger fora do ar | `REQ-602` |
| `REJ-702` | Texto livre registrando valor sem a validação da coleta guiada | `REQ-702` |
| `REJ-102` | Ocultar um déficit que o Ledger expõe | `REQ-102` |
| `REJ-250` | Compensação que quita um lado e fica recusada no outro | `REQ-250` |
| `REJ-251` | Compensação de duas dívidas, de dois créditos ou de uma posição só | `REQ-251` |
| `REJ-255` | Desfazer ou impedir um fato já enviado porque um fato seguinte do plano foi recusado | `REQ-255` |
| `REJ-525` | Retirada que cita só uma das posições do lançamento | `REQ-525` |
| `REJ-623` | Ratear automaticamente um fato não atribuído | `REQ-623` |
| `REJ-624` | Mostrar "perda total" ou "ganho" numa posição só por ter sido fechada por compensação | `REQ-624` |
| `REJ-627` | O Treasury somar por conta própria o resultado de uma parte | `REQ-627` |
| `REJ-244b` | Gerar o extrato de recebível baixar a obrigação ou enviar um evento ao Ledger (renumerado em 2026-11-12: o ID `REJ-244` estava repetido) | `REQ-244` |
| `REJ-239` | A mesma obrigação em dois lotes preparados ao mesmo tempo | `REQ-239` |
| `REJ-632` | Mostrar um saldo líquido entre o que a Usina deve e o que a parte deve | `REQ-632` |
| `REJ-634` | O Treasury afirmar sozinho que houve pagamento a mais | `REQ-634` |
| `REJ-636` | Contar um sinal como fato no histórico da parte | `REQ-636` |
| `REJ-246` | Registrar o lote como um único evento com posições de valores diferentes | `REQ-246` |
| `REJ-249` | Deixar de enviar os demais eventos do lote porque um deles foi recusado | `REQ-249` |
| `REJ-247` | Anexar um arquivo sem registrar quem anexou | `REQ-247`, `REQ-804` |
| `REJ-323b` | Comissão recebida com confiança baixa → o Ledger recusa, e o caixa não muda | `REQ-323`, `REQ-806` |
| `REJ-260` | Enviar ao Ledger um sinal externo, ou um fato proposto, sem a confirmação de um usuário | `REQ-260`, `REQ-261`, `REQ-323` |
| `REJ-262` | Gerar comissão recebida ou pagamento a partir do sinal do sistema de seguro | `REQ-262`, `REQ-263` |
| `REJ-264` | Registrar o valor retido como evento | `REQ-264` |
| `REJ-266` | Alterar um fato ou um sinal já confirmado porque a origem mudou | `REQ-266` |
| `REJ-267` | Ligar o corretor pelo nome do demonstrativo, ou cadastrar o cliente como parte | `REQ-267` |
| `REJ-270` | Abrir a obrigação pelo valor líquido do adiantamento | `REQ-270` |
| `REJ-272` | Usar a data da elegibilidade como a data em que a comissão prevista surgiu | `REQ-272` |
| `REJ-273` | Achar a seguradora pelo id de um corretor (ou o contrário) só porque os números são iguais | `REQ-267`, `REQ-273` |
| `REJ-277` | Distribuir mais do que o crédito, ou mais do que o aberto numa comissão prevista; nada é enviado | `REQ-277` |
| `REJ-276` | Contar um sinal do sistema de seguro como fato na história da apólice | `REQ-276` |

---

## 15. Decisões pendentes e perguntas abertas

### 15.1 Decisões pendentes

| ID | Pendência | Impacto (comportamento enquanto não decide) |
| --- | --- | --- |
| `DEC-001` | **Visão por pessoa e por grupo de pessoas, com encadeamento** — **regras definidas em 2026-11-04** (§8.2); o encadeamento depende do repasse (`DEC-017`) | Vale §8.2 |
| `DEC-002` | **Cadastro de partes substitui Contrapartes** — **regras definidas em 2026-11-04** (§5) | Vale §5 |
| `DEC-003` | Forma da cobrança de "pendente de validação" — **respondida em 2026-11-04**: notificação insistente vista por todos (`REQ-321`); o que falta passou para `DEC-016` | Vale `REQ-321` |
| `DEC-004` | Papel que prepara sem enviar, com aprovação de outra pessoa | Só os papéis de `REQ-401` |
| `DEC-005` | Revisão da classificação do texto livre (IA ou recomendação) com a pergunta "Você deseja fazer um **adiantamento** com os dados a seguir?" e troca de operação reaproveitando os dados | Vale `REQ-701`/`REQ-702`; trocar de operação não está definido |
| `DEC-006` | Tratamento cuidadoso de eventos sem contraparte identificada ("podemos falar quando chegar a hora") | Vale `REQ-301`/`REQ-302` |
| `DEC-007` | Estados da aplicação depois do MDM | Valem os estados de §11.1 |
| `DEC-008` | Entidades a remover ou reescrever | O glossário (§2) reflete o atual |
| `DEC-009` | Quais consultas são requisito: painel, exposição, posições, movimentos, contas a pagar, ciclo de vida, saúde de classificação (veio de `Q-018`) | Valem `REQ-601`–`REQ-604`; as telas existentes não são requisito nem descartadas |
| `DEC-010` | Quem aparece como parte em cada registro: Usina na renúncia e no pagamento direto; operadora no pagamento direto e na comissão prevista (veio de `Q-012`). Decidir na rodada do MDM. **Em parte decidida em 2026-11-09:** na comissão prevista, quem vai pagar entra como `payer` quando conhecido (`REQ-273`, `REQ-274`) | O resto segue como está em §4.1 |
| `DEC-011` | Outras moedas além do BRL (veio de `Q-023`) | Só BRL (`REQ-222`) |
| `DEC-012` | Logs de comportamento: observar cada passo da conversa, mesmo antes de o usuário confirmar uma ação (veio de `Q-024`) | Só a operação é auditada (`REQ-804`) |
| `DEC-013` | **Provisão de pagamento futuro / lançamento futuro**: "pode e até deve existir", mas fatos não podem ser previstos (veio de `Q-025`) | Data de ocorrência futura é recusada (`REQ-226`); não há como registrar uma provisão |
| `DEC-014` | Abrir o caderno (Ledger) para visualização por usuários com formação contábil (veio de `Q-029`) | O caderno é acessível só pela referência guardada na intenção (`REQ-501`) |
| `DEC-015` | Como desfazer uma **ligação errada** de identidade provisória (veio de `Q-038`) | Uma ligação feita não é apagada (`REQ-331`); ainda não há como desfazê-la |
| `DEC-016` | Se a notificação **fica mais insistente com o tempo** e se **bloqueia** algo (veio de `Q-039`) | Notificação constante, sem escalada; não bloqueia o registro de fatos (`REQ-320`) |
| `DEC-017` | ~~Repasse de comissão~~ — **decidida em 2026-11-06**: ciclo e valor em §4.5; extrato, lote e anexo em §4.4 (veio de `Q-043`) | Vale §4.4 e §4.5 |
| `DEC-018` | **Conciliação bancária**: ligar cada linha do extrato a um evento (veio de `Q-045`) | Não há conciliação; o extrato é só anexo opcional (`REQ-247`) |
| `DEC-019` | **Fechar uma obrigação sem pagar**: desconto depois de reconhecida, desistência de um repasse, negociação. Hoje `commission_waiver` recusa `commission_payable` | A obrigação fica aberta e visível; não há como fechá-la sem pagamento ou compensação |
| `DEC-020` | **Base do cálculo**: registrar sobre o que o percentual incidiu (parcela, valor recebido pela Usina ou parte do corretor) e onde isso fica. O Ledger guarda só o valor | O valor é registrado sem a base; a descrição é livre |
| `DEC-021` | **Várias partes na mesma venda**: como dividir o valor no resultado por parte. O evento já guarda valor por parte, mas exige que a soma feche o total, o que impede registrar só a parte conhecida | O evento conta inteiro para cada parte citada, e a soma das partes não fecha nesses casos (`REQ-623`) |
| `DEC-022` | **Compensação entre partes diferentes**. Casos levantados em 2026-11-11: (1) **pessoa e a empresa dela**: adiantamento ao João (CPF) abatido na obrigação com a Argo (CNPJ), pela qual ele recebe (`REQ-613`); no Ledger são duas partes, na vida real o mesmo bolso. É o candidato mais provável. (2) **acordo entre três**: o adiantamento da Maria abatido na comissão do João, porque o João devia à Maria por fora. Raro. Por enquanto João e Argo são partes diferentes, porque a relação entre elas nasce no evento (`REQ-611`) | O Treasury não oferece (`REQ-252`); o Ledger não bloqueia |
| `DEC-023` | **Categorias de resultado** além do produto, a partir do contexto do Ledger, com ou sem um padrão | Vale o contexto citado no evento (`REQ-621`) |
| `DEC-024` | **Retomar uma operação composta interrompida**: estratégia para evitar ou concluir | O histórico fica incompleto e visível (`REQ-255`) |
| `DEC-025` | ~~Tipos iniciais da compensação~~ — **decidida em 2026-11-11**: adiantamento (`ADVANCE`) e empréstimo (`LOAN`) contra obrigação de comissão (`COMMISSION_PAYABLE`). Ficam de fora até aparecer um caso real: as demais contas a pagar (conta genérica, folha, serviço, infraestrutura, imposto), o a receber genérico (nenhum evento o abre), a comissão a receber (devida pela seguradora, `DEC-022`) e a multa (contingência da Usina) | Só os tipos listados entram; cada novo tipo precisa de um caso de teste |
| `DEC-026` | ~~Lote~~ — **decidida em 2026-11-06**: um evento por pessoa, ligados pelo contexto do lote (`REQ-246`) | Vale `REQ-246` |
| `DEC-027` | **Outros resultados por posição**: dívida paga aparece como `gain`, e `ledger_correction` com `ADJUSTS` aceita valor acima do saldo sem conferência | Continuam como estão; só a compensação muda (`REQ-624`) |
| `DEC-028` | ~~Primeira conexão com o sistema de seguro, sem API~~ — **decidida em 2026-11-09**: sinal externo e fatos propostos (§4.6). A leitura automática pela API fica para a etapa de integração | Vale §4.6 (não implementado) |
| `DEC-029` | ~~Posição contextual para apólice e elegibilidade~~ — **decidida em 2026-11-09**: a apólice é contexto `contract`; a elegibilidade é o motivo da obrigação (`REQ-267`) | Vale `REQ-267` (não implementado) |
| `DEC-030` | ~~Página da pessoa e histórico~~ — **decidida em 2026-11-12** (rodada 18): §8.4, `REQ-630`–`REQ-638` | Vale §8.4 (não implementado) |
| `DEC-031` | ~~Ordem dos próximos passos~~ — **decidida em 2026-11-09**: §4.6 vem antes dos passos 4 a 8 de §16.2, na ordem de §16.1 | Vale §16.1 |
| `DEC-032` | **Pagamento sem vínculo com a obrigação**: como conduzir e avisar o usuário. O Ledger continua aceitando, porque um pagamento sem obrigação conhecida é um fato válido. **Em parte respondida em 2026-11-09:** o Treasury recomenda as ligações e avisa o repasse sem entrada (`REQ-268`) | O vínculo é opcional. **Decidida em 2026-11-12:** o alerta "pago sem obrigação" no repasse de comissão e a prevenção pela divisão (`REQ-634`, `REQ-635`) |
| `DEC-033` | **Alcance da retificação e convivência com o ajuste**: `REQ-522` cita três posições e o Anexo A inclui `COMMISSION_PAYABLE`; a retificação pode alcançar outros eventos ou até deixar de existir, ficando só o ajuste. Não atrapalha §4.6. **Acrescentados em 2026-11-12:** mapear o **estorno** (como a Usina opera e como deveria operar com a álgebra) e o **remédio do pagamento a mais** já registrado sem vínculo (`REQ-635`) | Vale `REQ-522`; um pagamento a mais solto não tem correção |
| `DEC-034` | **Outros beneficiários vindos do sistema de seguro** (supervisor e outros, `REQ-258`). Hoje o sistema de seguro não os conhece; pode vir a conhecer | O sinal só traz o corretor; os demais são abertos pelo usuário (`REQ-253`) |
| `DEC-035` | ~~Contextos na lista de posições~~ — **decidida em 2026-11-09**: opção 2, escondidos da lista só no Treasury (`REQ-605`) | Vale `REQ-605` |
| `DEC-037` | **Recusa no meio do lote**: no pagamento em lote, um recusado não impede os demais (`REQ-249`); no recebimento em lote da seguradora, os seguintes não são enviados (`REQ-277`). Rever `REQ-277` à luz do mesmo princípio | Cada lote segue a sua regra |
| `DEC-038` | **Exposição: saída de caixa coberta só por expectativa** (o "coringa"). Adiantamento de 500,00 ao João, compensado com a obrigação de 500,00 da apólice X; a Allianz ainda deve 800,00 e nada entrou. As duas posições do João zeraram, mas o caixa continua em −500,00, e só uma expectativa pode trazê-lo de volta. Decidir quando e como alertar, e como mostrar a trilha do furo (caixa → adiantamento → compensação → obrigação → apólice → comissão prevista aberta), como **leitura** da cadeia de fatos, sem rateio (`REQ-623`). Para a trilha existir, a compensação herda o contexto da obrigação (`REQ-275`). A leitura por contexto sozinha não mostra o furo, porque o adiantamento não cita a apólice (`CA-621b`). Decidir junto com o passo 6 e `DEC-030`; não bloqueia a compensação. **Em parte coberta em 2026-11-12:** o bloco "depende de" da página da parte mostra a expectativa aberta ao lado do repasse (`REQ-632`); faltam o alerta e a trilha | O −500,00 aparece no resultado do João (`REQ-620`, `REQ-622`) e o "depende de" na página (`REQ-632`); não há alerta nem trilha |
| `DEC-039` | **Visão comparativa de várias partes**: a direção olha todo dia N partes selecionadas para tirar conclusões (incentivo, investimento, negociação). Fica fora da página da parte; nasce quando um usuário sentir a dor de abrir muitas páginas, e o uso da página ensina quais sinais comparar. Relaciona-se com `DEC-009` e `REQ-620` | A direção usa a página de cada parte |
| `DEC-040` | **Recomendação em chips com "outra"**: um padrão de UX para oferecer opções recomendadas em chips clicáveis, com "outra" abrindo o texto livre (ex.: a forma do repasse: "pela Argo", "recebe diretamente", "outra"; a divisão do pagamento a mais). Deve servir a vários lugares; o alcance ainda não está definido | Cada tela escolhe como apresentar as opções |
| `DEC-041` | ~~Autenticação e autorização do Treasury~~ — **decidida em 2026-11-13**: §6 adota o molde, com três papéis, o molde inteiro sem o envio de e-mail, base limpa no piloto e o comando de criação de usuário só em desenvolvimento. Todo autenticado consulta tudo (`REQ-638`) | Vale §6. O envio de e-mail e a recuperação de senha ficam no `TODO-17` |
| `DEC-042` | **Filtros de leitura no Ledger**: (1) posições só vencidas / a vencer / sem vencimento, e por contexto (apólice); (2) eventos de uma parte paginados e filtrados (data de registro, tipo, autor, situação), hoje lidos inteiros (§17, P1). Hoje o Ledger ordena por vencimento, mas não filtra por ele nem por contexto. Não muda a álgebra nem cria fato; muda a leitura do Ledger. **Item 1 em parte decidido em 2026-11-13:** o Ledger publica a agenda a pagar por janela de vencimento, com os totais (`REQ-642`); o contexto (apólice) e o item 2 continuam abertos | A página da parte ordena por vencimento; o filtro por contexto e o item 2 ficam de fora |
| `DEC-043` | **Rotina financeira e lacunas para um sistema financeiro funcional** (§1.1): mapear com o dono do produto, em modo interativo (uma pergunta por vez, desafiando as respostas), a rotina diária, semanal e mensal do financeiro da Usina — quem faz, o que entra, o que sai. Cada linha aponta para um `REQ` ou vira lacuna; cada ⬜ e "a decidir" de §1.1 é decidido: entra no Treasury, no Ledger (só se for fato) ou fica fora. Primeira pergunta: como começa o dia de quem cuida do financeiro, e o que confere primeiro | Vale §1.1 como régua; nada decidido |
| `DEC-036` | **Enriquecer a origem depois**: ligar um recebimento sem origem (ou outro fato isolado) à comissão prevista quando se descobre de onde veio, **sem reescrever o fato** ("a linhagem é progressiva", `CLAUDE.md`). Não existe hoje no Ledger nem no Treasury. Ideia do dono do produto: usar isso para olhar o passado a partir do saldo no banco (Bradesco, Itaú, corretora de investimentos), perguntando "de onde veio cada valor?", e construir a verdade financeira enquanto se concilia, independente do banco. Relaciona-se com `DEC-018` | O recebimento sem origem fica pendente e visível; não há como ligá-lo depois |
| `DEC-044` | ~~**Instituição no fato de caixa**~~ **Decidida em 2026-11-13:** o fato de caixa cita a instituição como contexto (`cash_account`), no máximo uma, nunca num evento sem dinheiro; sem ela, "instituição desconhecida"; os eventos anteriores ficam desconhecidos, nunca distribuídos. Alternativas descartadas: um campo novo no evento (muda o molde, o hash e o banco para o mesmo resultado), guardar só no Treasury (a instituição não seria fato do Ledger) e adiar (os pagamentos do piloto ficariam sem instituição para sempre). A transferência entre instituições fica para o E6. Ver `REQ-650` | O Ledger aceita a instituição no fato de caixa; o saldo por instituição (`TODO-06`) ainda não existe |
| `DEC-045` | **Provisões do CFO** (aberta em 2026-11-13). O CFO aloca dinheiro na corretora de investimentos para usar depois em eventos, e controla isso hoje em planilha. **Confirmado:** ele precisa de uma ferramenta para isso. **Hipótese, não confirmada:** são investimentos pós-fixados que rendem enquanto o dinheiro não é necessário. Entender com o CFO antes de modelar. **Não confundir** com a provisão de pagamento futuro da `DEC-013` | Continua na planilha do CFO (`TODO-15`) |

### 15.2 Perguntas abertas

Abertas na rodada 13 (2026-11-07), e `Q-052` na rodada 14 (2026-11-09). A recomendação é só uma proposta; nenhuma foi aceita.

| ID | Pergunta | Recomendação | Enquanto não for respondida |
| --- | --- | --- | --- |
| `Q-048` | ~~Como registrar um pagamento a mais de verdade?~~ — **respondida em 2026-11-12**: prevenção pela divisão na prévia (`REQ-635`); a correção do que já foi registrado sem vínculo foi para `DEC-033` | — | Vale `REQ-635` |
| `Q-050` | No sistema de seguro, uma mesma apólice e proposta aparecem com dois ids, uma elegível e outra sem CR. É erro de cadastro ou é esperado? | Conferir no sistema de origem; de todo modo, ligar sempre pelo id da apólice | Nada depende disso ainda |
| `Q-051` | Como tratar identificadores lá escritos de formas diferentes (produto `Auto` e `auto`) e a seguradora sem nome? | Normalizar só para comparar e guardar como veio no sinal (`REQ-260`); seguradora sem nome vira identidade provisória (`REQ-267`) | Nada depende disso ainda |
| `Q-052` | Na comissão parcelada, a elegibilidade chega **por parcela** ou uma vez por apólice? | Se for por parcela, a referência da origem inclui a parcela (`REQ-265`) e cada elegibilidade abre a sua obrigação | Uma elegibilidade por apólice |
| `Q-053` | **Solicitações de adiantamento e acordos ainda não pagos**, que os verificadores acompanham: o que são, quem aprova e em que momento viram compromisso da Usina? (aberta em 2026-11-13) | Até virar compromisso, mostrar como pendência do Treasury, que não é fato nem vai ao Ledger. Depois, como obrigação reconhecida | `TODO-19` não começa |
| `Q-054` | **Sistema de saúde:** como os dados ficam acessíveis (API, arquivo, tela) e se ele registra os mesmos acontecimentos do seguro (pagamento declarado pela operadora, parcela ou total, parte da Usina e parte do corretor)? (aberta em 2026-11-13) | Usar o mesmo conceito de sinal externo (§4.6), com um contrato próprio para a saúde | `TODO-11` não começa; a saúde é registrada à mão |
| `Q-055` | **Conferência com o banco:** em cada instituição, com que frequência o CFO confere e de onde vem o saldo (extrato, aplicativo, relatório da corretora)? E até quantos dias à frente ele precisa ver o que vence? (aberta em 2026-11-13) | Começar pelo saldo informado à mão, uma vez por dia, e uma janela de 7 dias, a ajustar no piloto | `TODO-05` e `TODO-07` seguem com esses valores provisórios |
| `Q-056` | **Piloto:** por quantas semanas a equipe usa a primeira versão em paralelo à planilha, e quem decide que ela foi aprovada? (aberta em 2026-11-13) | O CFO decide; aprovada quando ele decide o que pagar no dia pelo Treasury, sem a planilha | `TODO-13` sem data |

Os `⚠ CONFIRMAR` de §2 (termos **recebedor** e **destinatário final**) e de `REQ-612` (a visão **não soma**
valores por grupo), adiados em 2026-11-04, foram **confirmados em 2026-11-12** (rodada 18). Ficou aberto,
na mesma rodada, o `⚠ CONFIRMAR` de `REQ-632` (uma linha por posição).

**Anotado em 2026-11-12, sem decisão:** "rateio" pode vir a ser um evento de primeira ordem no futuro.
Hoje, o que a Usina sabe sobre a divisão de um pagamento entre partes é registrado como um repasse por
direito (`REQ-633`). Não há caso real que peça outra coisa.

Abertos na rodada 14 (2026-11-09), no bloco B: os dois `⚠ CONFIRMAR` de `REQ-267` (mais de uma
parte com o mesmo id do corretor; sinal sem o id do corretor). Os dois perguntam o corretor na conversa.

### 15.3 Respondidas em 2026-11-03

**Rodada 1:** `Q-001` (Anexo A) · `Q-002` (`REQ-201`, `REQ-202`) · `Q-003` (`REQ-104`) · `Q-004`
(`REQ-401`, `DEC-004`) · `Q-005` (`DEC-001`) · `Q-006` (§11.1) · `Q-007` (`REQ-220`–`REQ-222`) ·
`Q-008` (`REQ-301`, `REQ-302`, `DEC-003`) · `Q-009` (`REQ-522`, `REQ-523`) · `Q-010` (`REQ-701`,
`REQ-702`, `DEC-005`)

**Rodada 2:** `Q-011` (`REQ-101`–`REQ-105`, `REQ-210`, `REQ-212`, `REQ-502`, `REQ-503`,
`REQ-520`, `REQ-521`, `REQ-601`–`REQ-603`, `REQ-701`) · `Q-013` (`REQ-221`) · `Q-014`
(`REQ-222`, `REQ-224`) · `Q-015` (`REQ-223`) · `Q-016` (`REQ-703`) · `Q-017` (`REQ-203`) ·
`Q-018` (→ `DEC-009`) · `Q-019` (`REQ-801`, `REQ-802`) · `Q-020` (`REQ-225`) · `Q-022`
(`REQ-604`)

**Rodada 3:** `Q-012` (→ `DEC-010`) · `Q-021` (`REQ-214`; estado renomeado para "pronta para
envio") · `Q-023` (`REQ-222`, → `DEC-011`) · `Q-024` (`REQ-804`, → `DEC-012`) · `Q-025`
(`REQ-226`, `REQ-227`, → `DEC-013`) · `⚠` do valor sem vírgula (`REQ-224` alterado, `REQ-228`)

**Rodada 4:** `Q-027` (`REQ-211`) · `Q-028` (`REQ-213`) · `Q-029` (`REQ-501`, → `DEC-014`) ·
`Q-030` (`REQ-510`, §11.1) · `Q-031` (`REQ-524`) · `Q-032` (`REQ-703`) · `Q-033` (`REQ-803`) ·
`Q-034` (§2, estorno) · `Q-035` (§4.1, `FA-201`, `FA-202`; premissa nova em §1)

**Rodada 5:** `Q-026` (`REQ-221` alterado)

### 15.4 Respostas da conversa de pesquisa de 2026-11-04

Não tinham ID de pergunta; ficam registradas aqui com o destino:
fontes e número de partes (§5, contexto) · curadoria por um usuário (`REQ-311`, `REQ-402`) ·
pessoa não cadastrada → opção (b), provisória com incômodo (`REQ-320`, `REQ-321`) · "o Treasury
auxilia, o Ledger canoniza" (`REQ-332`, `REQ-333`) · mapeamento no Treasury (`REQ-330`,
`REQ-331`) · grupo: empresa a priori, vários por pessoa, relação no evento (`REQ-610`, `REQ-611`,
`Q-040`) · filtrar e enxergar (`REQ-612`) · sugestão pelo último evento (`REQ-614`) · cliente
final é contexto (`REQ-313`) · Unimed, João e Argo cadastrados (`REQ-312`, `REQ-613`) · fluxo do
repasse (§4.4)

### 15.6 Respondidas em 2026-11-09 (rodada 14)

`Q-047` (a obrigação nasce na elegibilidade, `REQ-262`) · `Q-049` (valem os dois casos, inteira e
parcelada, `REQ-269`; a parcela na elegibilidade virou `Q-052`) · `DEC-028` (§4.6) · `DEC-029`
(`REQ-267`) · data da comissão prevista: opcional com alerta (`REQ-271`) · o sistema de seguro só mostra
o demonstrativo na tela, sem exportação, mas já tem API (`REQ-261`)

### 15.5 Respondidas em 2026-11-04 (rodada 7)

`Q-036` (`REQ-301`, `REQ-302`, §2) · `Q-037` (`REQ-402`) · `Q-038` (`REQ-322`, → `DEC-015`) ·
`Q-039` (`REQ-321`, → `DEC-016`) · `Q-040` (§2, §8.2) · `Q-041` (`REQ-615`) · `Q-042`
(`REQ-314`) · `Q-043` (§4.4 adiado, → `DEC-017`) · `Q-044` (`REQ-323`, `REQ-324`) · `Q-045`
(→ `DEC-018`) · `Q-046` (cabeçalho, §5)

---

## 16. Critério de parada — situação

### 16.1 Onde paramos e o que decidir

> **⚠ Antes de qualquer deploy de produção, resolver §17** (lentidão, consistência de API e
> resiliência). Pedido do dono do produto em 2026-11-12.

> **A partir de 2026-11-13, a ordem do trabalho é a de §18 (primeira versão funcional).** O que está
> abaixo continua valendo como registro do estado e das regras. Os itens A1–A7 e os passos 4 a 8 entram no
> trabalho só pelo `TODO` de §18 que os cita; os demais ficam em PRI-2.

> Atualizado em 2026-11-12, depois da rodada 18 (página da parte). Quando o dono do produto perguntar "onde paramos e o que precisamos
> decidir para continuar?", a resposta parte daqui. Confira no código antes de afirmar que algo existe.

#### Para a retomada (escrito ao fechar 2026-11-12)

**Onde paramos.** A página da parte está no commit `6b9ad7c` ("two tabs almost done and the third one
still open"): lista de partes → página própria com as abas **Operação** (alertas, uma seção por lado,
filtros e paginação do Ledger) e **Histórico** (auditoria: data de registro, quem registrou, quem
retirou, filtros, paginação, sinais pendentes no topo); **Resultados** só avisa que depende do passo 6.
No Ledger, `/api/events/by-party` publica quem retirou cada evento (§17, C1). A tela **nunca foi vista
no navegador**: só tem testes.

**Primeiro passo de amanhã: verificar a página no navegador**, com Ledger e Treasury de verdade e o
livro de exemplo, percorrendo Partes → página → as três abas, no claro e no escuro, no computador e
no celular. As capturas são temporárias e nunca ficam no projeto (`client/CLAUDE.md`). O que aparecer
vira refinamento antes de qualquer item abaixo.

**Depois, o que falta na página e não depende de outro passo** (o dono do produto escolhe a ordem):

| # | Falta | Onde está decidido | Observação |
| --- | --- | --- | --- |
| A1 | **Ações em cada linha da Operação**: pagar ligado à obrigação, receber ligado à comissão prevista, recuperar o adiantamento, retificar; o visualizador vê sem ações | `REQ-637`, `REQ-603`, `REQ-638` | As ações já existem a partir da posição (`ListPositionActions`); falta oferecê-las na linha |
| A2 | **A prévia não mostra a divisão** do pagamento a mais: o aviso `exceeds_open` existe no servidor, mas a tela da prévia (`PreviewNoticeList`) não o exibe; falta também enviar os dois fatos em ordem (repasse + adiantamento) | `REQ-635`, `CA-635` | Precisa decidir: com várias obrigações abertas, o que oferecer (`REQ-635`, "a definir") e os chips com "outra" (`DEC-040`) |
| A3 | **Clicar no nome da parte em qualquer lista abre a página dela**; e a página ganhar endereço próprio (o "voltar" do navegador hoje não volta à lista) | `CA-630` | O app troca de seção por estado interno, sem rotas |
| A4 | **Alertas que faltam**: comissão prevista sem data esperada e repasse sem recebimento na apólice; e clicar no alerta levar à linha | `REQ-634`, `REQ-271`, `REQ-268` | — |
| A5 | **Do Histórico**: cada fato levar à história da apólice citada, e abrir o recibo | `REQ-636`, `REQ-276`, `REQ-245` | Conferir se o recibo de `REQ-245` existe antes de prometer o link |
| A6 | **Limpeza**: `it.todo` de `acceptance-party-page.test.ts` que a tela já cobre (lista de partes, "(provisória)", ordem das abas, ordem das posições, duas datas) viram testes ou referências aos testes da tela | — | Sem mudança de comportamento |
| A7 | `⚠ CONFIRMAR` de `REQ-632` (uma linha por posição): confirmar com o uso | `REQ-632` | Depende da verificação no navegador |

**Quando A1–A7 estiverem resolvidos (ou adiados por decisão), o dono do produto verifica a página e
decide se fecha a `DEC-030`.**

**O que a página espera de outros passos** — e é aqui que entra a revisão do passo 6 em diante e da
ordem das `DEC` em aberto, condicionada à entrega da página:

| Falta na página | Passo | Pendências ligadas |
| --- | --- | --- |
| Aba **Resultados** (totais por período publicados pelo Ledger) | 6 (`REQ-620`–`REQ-624`) | `DEC-021`, `DEC-023`, `DEC-027`, `DEC-038` |
| **Lote preparado** na Operação, extrato de recebível e pagamento do lote | 4 (`REQ-239`, `REQ-244`, `REQ-246`) | §17 R1 (gravar o lote), `DEC-037` |
| **Compensação** nascendo na página | 7 (`REQ-252`) | `DEC-022`, `DEC-025` decidida |

**Os passos de implementação** (decididos em 2026-11-06; a descrição completa de cada um está no fim
de §16, em "Rodada das operações compostas: próximo passo"). Situação em 2026-11-12:

| Passo | O que é | Situação |
| --- | --- | --- |
| 1 | Testes de aceitação das operações compostas | ✅ commit `25fa19c` |
| 2 | Retirada completa (`REQ-525`) | ✅ commit `25fa19c` |
| 3 | Obrigação de comissão e a tela de abrir e pagar | ✅ commit `25fa19c` |
| 4 | Extrato de recebível, pagamento em lote, anexo e confiança | ⬜ só o lote preparado, em memória (`REQ-239`) |
| 5 | Compensação | ✅ no Ledger, commit `8797c7d`; a oferta no Treasury fica para o passo 7 |
| 6 | Leituras e resultados por parte e por contexto | ⬜ é o que a aba Resultados precisa |
| 7 | Operação composta e tradução no Treasury | ⬜ |
| 8 | Entrada do sistema externo | ⬜ por último |

**Em paralelo, quando o dono do produto quiser:** a sessão interativa da rotina financeira
(`DEC-043`, §1.1).

**Decisões que provavelmente aparecem amanhã:** a ordem de A1–A7; `DEC-040` (chips) e o caso de várias
obrigações abertas de `REQ-635` (para A2); a ordem dos passos 4, 6 e 7 para terminar a página.

**Como trabalhamos, nesta ordem.** Só avance com o aval do dono do produto.

1. **Conversa sobre o domínio:** entender o caso real e propor, com uma recomendação. Nada de código.
2. **Anotação:** registrar neste documento o que foi decidido. O que abre escopo ou ficou sem resposta
   vai para `DEC-` ou `Q-` (§15).
3. **Testes:** escrever os critérios de aceitação antes do código, para prevenir regressão. Regra
   ainda não implementada fica como `pending` (`it.fails`) ou `it.todo`.
4. **Implementação:** a menor mudança, fácil de remover enquanto não houver fato real gravado. Valide
   nas suítes e, quando houver Ledger envolvido, com os dois serviços de verdade.

**O commit é sempre do dono do produto.** Não crie commit nem branch sem ele pedir.

**Onde paramos.**

| Item | Situação |
| --- | --- |
| Passos 1 a 3 de §16.2 | ✅ Implementados, com commit (`25fa19c`, 2026-11-07) |
| Data esperada da comissão prevista (`REQ-229`) e lista de seleção com busca | ✅ Implementados, com commit. A lista não foi vista no navegador; só tem teste de componente |
| Suítes em 2026-11-07 | Ledger: 841 passam e 19 pendentes (compensação e leituras de resultado). Treasury: 717 no backend, com 13 `it.todo`, e 148 no cliente |
| Teste do dono do produto | Fez os passos, mas só porque conhece o sistema. Um leigo ainda teria dificuldade |
| Página da parte (`DEC-030`, rodada 18) | 🔶 Decidida em 2026-11-12 (§8.4) e **implementada no mesmo dia, commit `6b9ad7c`**: `GetPartyPageUseCase` (rota `GET /api/parties/:partyId/page`), o aviso `exceeds_open` da prévia (`REQ-635`), o serviço `PreparedBatches` (`REQ-239`, só em memória e sem tela: a tela e a gravação vêm com o passo 4) e a tela, que substitui a "Visão por parte" (lista ordenada de partes → página própria da parte, com as abas Operação, Histórico e Resultados, a Operação aberta, e o caminho de volta para a lista; cada lado da Operação é uma seção com filtros e paginação do Ledger, pela rota `GET /api/parties/:partyId/positions/:side`; o Histórico tem viés de auditoria, com filtros e paginação pela rota `GET /api/parties/:partyId/history` e os sinais pendentes num bloco no topo). Resultados mostra só o aviso de que depende do passo 6. Testes: `acceptance-party-page.test.ts` (29 passam, 23 `it.todo`), `unit/application/party-page.test.ts` e os da tela. **O lado de cada posição** é lido pelo tipo, no Treasury: a Usina deve = os tipos de `USINA_PAYABLE_OBJECT_TYPES` do Ledger; a parte deve = `USINA_RECEIVABLE_OBJECT_TYPES` mais a comissão prevista. Tipo fora dos dois aparece à parte, "sem lado definido", nunca some. **Aguarda a verificação do dono do produto** para fechar a `DEC-030` |
| Suítes em 2026-11-12 | Treasury: 829 passam no backend, com 27 pendentes e 37 `it.todo`, e 156 no cliente |
| Suítes em 2026-11-12, depois da página da parte | Treasury: 873 passam no backend, com 37 `it.todo` e nenhum pendente, e 165 no cliente (168 depois do refinamento das abas). O Ledger não foi tocado |
| Suítes em 2026-11-12, depois do Histórico de auditoria | Treasury: 887 no backend, com 37 `it.todo`, e 180 no cliente. Ledger: 870 passam e 12 pendentes (passo 6), com o `retractedBy` na leitura por parte |
| Passos 4 a 8 de §16.2 | 🔶 Passo 5 (compensação) feito no Ledger em 2026-11-11, commit `8797c7d`; os demais não iniciados (situação de cada passo em "Para a retomada") |
| Sinal externo do sistema de seguro (§4.6, rodada 14) | ✅ Blocos A a D com commit (`0fd5a62`); E adiado. Testes em `treasury/src/tests/integration/acceptance-external-signal.test.ts` (só o bloco E está como `it.todo`) e, no Ledger, `insurance-signal-candidates.test.ts` |
| Integração com o sistema de seguro (rodada 15) | ✅ Com commit (`874a260`). A validação com um RabbitMQ de verdade não foi registrada como feita |
| Lista de sinais paginada (`REQ-280`) | ✅ Com commit (`308e90e`). Testes em `signal-pagination.test.ts` |
| Suítes em 2026-11-11 | Treasury: 828 no backend, com 14 `it.todo`, e 156 no cliente. Ledger: não rodado desde 2026-11-09 (852 e 19 falhas esperadas) |
| Suítes em 2026-11-11, depois da compensação | Ledger: 868 passam e 12 pendentes (passo 6). Treasury: 828 no backend, com 14 `it.todo`, e 156 no cliente. A cobertura do Ledger está em 84,36% de linhas e 84,78% de funções, abaixo do mínimo de 85%; **já estava abaixo antes** (84,11% e 84,71% no commit `308e90e`) |
| Fora dos commits | `ledger/algebra.json` reexportado (`obligation_recognized` aceita `commission_payable`, `REQ-253`; e a compensação), variáveis do Treasury no `deploy/docker-compose.yml` e os READMEs |

**O que o teste na tela mostrou.**

- **Eventos desconexos das partes.** Obrigação de 20,00 e pagamento de 30,00 ao mesmo corretor ficaram
  em posições diferentes. O Ledger não comparou os valores e aceitou, corretamente; o problema é o
  Treasury não avisar (`DEC-032`).
- **Causas:** a operação começa pelo tipo de evento, e não pela pessoa ou apólice; o vínculo com a
  obrigação é opcional; a comissão prevista só cita a Usina, então não mostra o corretor nem a origem.
- **O histórico é fraco**, e o pagamento a mais não aparece como problema (`DEC-030`).

**O que decidir para continuar, nesta ordem.**

**Integração com o sistema de seguro (rodada 15, 2026-11-09): implementada, com commit** (`REQ-278`,
`REQ-279`). Produtor validado contra a API real (duas apólices elegíveis viraram duas mensagens válidas).
**Falta validar com um RabbitMQ de verdade**: o Docker não estava rodando. Para isso:
`docker run -d --name rabbit -p 5672:5672 -p 15672:15672 rabbitmq:3-management`, preencher
`INSURANCE_API_EMAIL`/`INSURANCE_API_PASSWORD` no `.env` e rodar `npm run consume:signals` e
`npm run worker:insurance -- --once`.

`DEC-028` e `DEC-029` foram decididas em 2026-11-09 (§4.6), e os blocos A a D estão implementados.

**Ordem decidida em 2026-11-09 (`DEC-031`):** §4.6 vem antes dos passos 4 a 8 de §16.2, nesta ordem:

| Bloco | Regras | Situação |
| --- | --- | --- |
| A. Sinal externo e fatos propostos | `REQ-260`, `REQ-261`, `REQ-265` | ✅ 2026-11-09, com commit. A tela não foi vista no navegador |
| B. Partes e apólice como contexto | `REQ-267` | ✅ 2026-11-09, com commit. Dois `⚠ CONFIRMAR` em `REQ-267` |
| C. Avisos e ligações recomendadas | `REQ-263`, `REQ-264`, `REQ-268`, `REQ-270`, `REQ-271` | ✅ 2026-11-09, com commit. Validado com o Ledger real por HTTP |
| D. Recebimento por lote | `REQ-269`, `REQ-277` | ✅ 2026-11-09, com commit. Validado com o Ledger real por HTTP |
| E. Diferença quando a origem muda | `REQ-266` | ⏸ Adiado em 2026-11-09: não é um caso real ainda |

**Ainda a decidir, em paralelo:**

1. ~~`DEC-030` e `Q-048`~~: decididas em 2026-11-12 (§8.4), e a página implementada (commit `6b9ad7c`). O que falta e por onde seguir está em "Para a retomada", no início de §16.1.
2. O passo 6, que a seção Resultados da página precisa (`REQ-631`), e `DEC-021`, de que dependem os
   totais por parte (`REQ-623`). **Por decisão do dono do produto em 2026-11-12, a revisão do passo 6 em
   diante (o que ele é e até onde vai) e da ordem das `DEC` em aberto fica condicionada à entrega final da
   página da parte.** Depois da implementação, o dono do produto confere se a `DEC-030` pode ser dada como
   fechada.
3. `Q-052`, `Q-050` e `Q-051`: elegibilidade por parcela e qualidade dos dados de origem.
4. Em aberto sem pressa: `DEC-033` (retificação × ajuste, agora com o estorno e o remédio do pagamento a
   mais) e `DEC-034` (outros beneficiários).

**Como ficou o bloco A (2026-11-09).**

- O sinal é a entidade `ExternalSignal`, guardada só por acréscimo na base de operações. Os campos aceitos
  e a interpretação de cada tipo estão em `InsuranceSignal.ts`; um campo fora da lista, como o nome do
  cliente, recusa o sinal inteiro.
- Cada fato proposto é uma intenção comum com `origin` (sinal, referência da origem, confiança `medium`).
  O `CandidateMapper` usa essa referência e essa confiança no lugar de `intent:<id>` e `high`.
- Um sinal repetido aponta para a proposta que já existe, a menos que o Ledger a tenha recusado.
- Rotas: `GET /api/signals` (consulta) e `POST /api/signals` (quem inicia operações). A tela leva cada
  proposta para a conversa, onde ela é conferida e enviada.
- Bloco B: a origem da intenção também leva o contexto da apólice, e o `CandidateMapper` o envia como
  `contract` com `references`. É o primeiro contexto que o Treasury cita no Ledger. O corretor é
  resolvido como descrito em `REQ-267`.

- Bloco C: a "situação da apólice" lê do Ledger as posições `…:prevista` e `…:elegibilidade` e mostra
  previsto, recebido, devido, pago, o retido como diferença e os alertas de `REQ-263`, `REQ-268` e
  `REQ-271`. Dela partem "Registrar recebimento" e "Pagar repasse", já ligados à posição certa. A prévia
  ganhou avisos: repasse sem recebimento na apólice e posições abertas com a pessoa (`REQ-270`). Se o
  Ledger não responde, a prévia diz que os avisos são desconhecidos, e o envio não é bloqueado.
- O alerta de `REQ-271` aparece na situação da apólice; a tela de Posições continua como estava.

**Ideia do dono do produto para a etapa de integração (2026-11-09), ainda não decidida:** um alerta
junto de "Sistema de seguro" no menu lateral, avisando que chegou um sinal ou que há proposta ainda
não registrada no Ledger.

**Pontos para os próximos blocos, verificados no código em 2026-11-09.**

- A lista de posições do Ledger inclui os objetos contextuais, com status "aberta" e saldo 0,00. O
  Treasury os deixa de fora da lista de posições, do painel e dos avisos da prévia (`REQ-605`); o
  Ledger não mudou.

- O cadastro de partes ainda não tem tela para acrescentar o id externo a uma parte já cadastrada; por
  enquanto, o caminho é ligar a provisória criada pelo sinal (`REQ-322`).
- Falta confirmar no Ledger que o `allocationGap` do lote vale para recebimentos (`REQ-269`).
- A quitação de empréstimo "via comissão" (`LOAN_REPAYMENT` com `LOAN_REPAYMENT_VIA_COMMISSION`, sem caixa)
  baixa só o empréstimo, e a obrigação de comissão continua aberta. Com a compensação existindo, decidir
  se o Treasury deixa de oferecer esse motivo (levantado em 2026-11-11).
- Uma proposta aceita e depois retificada deixa a referência da origem usada no Ledger: um novo sinal
  da mesma apólice seria recusado como duplicado. Tratar junto com o bloco E e `DEC-033`.

**Limitações conhecidas.**

- Uma retificação não carrega a data de vencimento nem a data esperada do lançamento corrigido.
- Reemitir um pagamento direto continua adiado, assim como a queda entre o aceite do Ledger e a
  gravação no Treasury e a entrada de eventos externos.
- Quitar uma dívida aparece como "Recuperado" (`DEC-027`).
- O filtro "perda total" do SQL também trazia posição a pagar quitada em dinheiro, que a memória lê como
  ganho. Corrigido junto com a compensação em 2026-11-11, com teste de equivalência.
- O Treasury ainda não traduz o resultado `compensated` (rótulos em `vocabulary.ts` e `i18n.tsx`). Só aparece
  quando houver compensação gravada, o que o Treasury ainda não oferece; entra com o passo 7.
- A recusa de pagamento acima do saldo traz, na API, o identificador interno da posição. Não foi
  verificado se a tela traduz esse texto.

**Ao subir o ambiente.** O Ledger de `npm run dev` guarda tudo em memória e começa **vazio**; com
`npm run dev -- --filled-example`, começa com os eventos de exemplo. Reiniciar apaga os eventos.
O Treasury só lê `ledger/algebra.json` ao iniciar, então, depois de mudar um contrato do Ledger, rode
`npm run export:algebra` no Ledger e reinicie os dois.

### 16.2 Situação por critério

| Critério | Situação |
| --- | --- |
| Fronteira Treasury × Ledger | ✅ §3 |
| Catálogo de operações | ✅ §4.1 (partes por registro na rodada do MDM, `DEC-010`) |
| Coleta guiada e prévia | ✅ §4.2 |
| Valores, moeda, datas e limites | ✅ §4.3 |
| Cadastro de partes | ✅ §5 (pendências: `DEC-015`, `DEC-016`) |
| Acesso | ✅ §6 |
| Envio, recusa e correção | ✅ §7.1–7.2 |
| Retificação | ✅ §7.3 |
| Consultas | 🔶 §8 — `DEC-009` |
| Texto livre | ✅ §9 (melhoria futura em `DEC-005`) |
| Auditoria | ✅ §10 |
| Estados | ✅ §11 |
| Nenhum `⚠ CONFIRMAR` em aberto | 🔶 três: os dois de `REQ-267` e o de `REQ-632` (§15.2) |
| Visão por pessoa/grupo | ✅ §8.2; página da parte decidida em §8.4, não implementada |
| Repasse de comissão | 🔶 §4.4 definido; extrato, lote e anexo não implementados |
| Conciliação bancária | ⬜ `DEC-018` |
| Compensação e operação composta | 🔶 §4.5 definido; obrigação de comissão e compensação (no Ledger) implementadas; a oferta da compensação no Treasury e a operação composta não (`DEC-019`–`DEC-022`, `DEC-024`) |
| Resultado por parte e contexto | 🔶 §8.3 definido, não implementado (`DEC-021`, `DEC-023`, `DEC-027`) |
| Sinal externo do sistema de seguro | 🔶 §4.6 definido; blocos A a D, integração e lista de sinais implementados, E adiado (`DEC-033`, `DEC-034`, `Q-050`–`Q-052`) |

**Critério de parada desta parte (documentação do que existe): atingido**, declarado pelo dono do
produto em 2026-11-03. Ficam abertas, por decisão dele, as `DEC-001` a `DEC-014`.

**Rodada do cadastro de partes: ciclo fechado** pelo dono do produto em 2026-11-04.

**Comparação com o código:** `comparacao_requisitos_codigo.md` (2026-11-04).
**Execução:** o plano, com o estado de cada bloco, está em `plano_testes_e_remocao.md`.
§4.4 (repasse) ficou fora desse plano; a ordem dele está na rodada abaixo.

**Rodada das operações compostas: próximo passo** (2026-11-06). Os critérios `CA-250`–`CA-806` e
`REJ-250`–`REJ-627` são os testes de aceitação, escritos antes do código. Os cenários foram
experimentados em scripts fora do projeto, com contratos só em memória e sem as consultas SQL; ainda
não são testes do projeto. A ordem é:

1. Testes de aceitação. **Feito em 2026-11-06:** ficam em
   `ledger/src/tests/integration/business-flows/composite-operations-acceptance.test.ts` e
   `treasury/src/tests/integration/acceptance-composite-operations.test.ts`. O que depende de regra
   ainda não implementada está marcado como `pending` ou `it.todo`.
2. Retirada completa (`REQ-525`), que corrige um risco já existente. **Feito em 2026-11-06.**
3. Obrigação de comissão, junto com a classificação (`REQ-253`, `REQ-254`), e a tela para abrir e
   pagar. **Feito em 2026-11-06.** A obrigação ainda não cita o produto: o contexto é citado a partir
   do passo 7; até lá, o produto fica na descrição.
4. Extrato de recebível, pagamento em lote, anexo e confiança (`REQ-241`, `REQ-244`–`REQ-249`,
   `REQ-806`). Vem antes da compensação porque é o fluxo principal do dia a dia.
5. Compensação (`REQ-250`, `REQ-251`, `REQ-624`). **Feito no Ledger em 2026-11-11, commit `8797c7d`.** Tipo e
   motivo `compensation`, contrato com os tipos de `DEC-025`, a regra dos dois lados (`REQ-251`) e a leitura
   da posição com o compensado à parte (`compensatedClosed`) e o resultado `compensated`, na memória e no
   SQL. Validado por HTTP com o Ledger de `npm run dev`: compensação parcial aceita, acima do saldo recusada,
   um lado só recusado, adiantamento fechado como `compensated`. Os totais por parte de `CA-624` ficam para
   o passo 6; a oferta no Treasury, para o passo 7.
6. Leituras por parte e por contexto, e o fechamento neutro (`REQ-620`–`REQ-624`), inclusive em SQL.
7. Operação composta e tradução no Treasury (`REQ-252`, `REQ-255`–`REQ-258`, `REQ-625`–`REQ-627`).
8. Entrada do sistema externo (`REQ-323`, `REQ-805`). Fica por último porque o evento é o mesmo, então
   a usabilidade pode ser testada com tudo registrado pelo usuário.

Por `DEC-031` (2026-11-09), §4.6 vem antes dos passos 4 a 8; a ordem dela está em §16.1.

---

## 17. ⚠ Antes de produção: ver e decidir

> **URGENTE para o deploy de produção** (pedido do dono do produto em 2026-11-12). Nada aqui impede o
> desenvolvimento nem o MVP de teste; tudo aqui precisa estar resolvido ou decidido **antes** de pôr o
> sistema em produção, para não haver lentidão nem falha com volume real (dezenas de posições por dia
> e centenas por semana em cada parte). Lista viva: entra um item sempre que uma escolha de agora
> depender de volume, e sai só quando resolvido, com a data. "Não verificado" quer dizer que ninguém
> conferiu; não quer dizer que está errado.

**Lentidão e escala**

| # | Ponto | Risco | O que fazer | Situação |
| --- | --- | --- | --- | --- |
| P1 | A leitura de eventos por parte no Ledger (`/api/events/by-party`) não é paginada, e para cada evento faz mais duas buscas de retificação | Parte com milhares de eventos deixa o Histórico lento | Leitura paginada e filtrada no Ledger (`DEC-042`) | Medido em 2026-11-13 (`TODO-03`), um mês à volumetria real: histórico do corretor mais movimentado (~800 eventos no mês) em 69 ms (pior 84 ms). Dentro do orçamento; cresce com a parte. Reavaliar a cada mês do piloto |
| P2 | Até P1, o Treasury lê o histórico inteiro da parte e pagina só na tela | O mesmo de P1, do lado do Treasury | Trocar pela leitura de P1 | Medido em 2026-11-13 (`TODO-03`), um mês à volumetria real: ver P1. Aberto até o Ledger paginar |
| P3 | O "depende de" da página da parte faz várias leituras ao Ledger por linha da página | Página lenta quando uma apólice tem muitos eventos | Uma leitura no Ledger que traga as expectativas de um contexto de uma vez | Medido em 2026-11-13 (`TODO-03`), um mês à volumetria real: cabeçalho e alertas da página da parte em 342 ms (pior 418 ms), a tela mais lenta. Dentro do orçamento; é a primeira a vigiar |
| P4 | Os alertas da página da parte leem até 200 posições por busca (e avisam quando passam disso) | Parte grande com alerta que não aparece | Filtros no Ledger para "sem origem" e "vencida" (`DEC-042`) | Medido em 2026-11-13 (`TODO-03`), um mês à volumetria real: incluído no cabeçalho da página da parte (P3) |
| P5 | Os sinais do histórico leem todos os sinais guardados, e a intenção de cada proposta, a cada abertura da página | Fica lento à medida que os sinais se acumulam | Guardar no Treasury quais partes cada sinal cita, com índice | Medido em 2026-11-13 (`TODO-03`), um mês à volumetria real: com 5.550 sinais, a contagem do menu leva 148 ms e a lista do que espera conferência 157 ms, porque leem todos os sinais. Cresce com os sinais; reavaliar a cada mês do piloto |
| P6 | Índices dos bancos para busca por parte, por evento relacionado, por objeto e por data de entrada e de vencimento | Consultas lentas com volume real | Levantar os índices que existem e criar os que faltarem | Verificado em 2026-11-13: o Ledger tem índices por parte, por objeto e por data de ocorrência e de registro. Com um mês, nenhuma leitura pediu outro índice |

**Correção e consistência de API**

| # | Ponto | O que fazer | Situação |
| --- | --- | --- | --- |
| C1 | O Ledger não publicava quem retirou cada evento; sem isso, o "retirado por…" da página da parte não aparecia com dados reais (a retificação cita só a Usina) | Publicar na leitura por parte (aprovado em 2026-11-12) | ✅ Resolvido em 2026-11-12, commit `6b9ad7c`: `/api/events/by-party` publica `retractedBy` (com o autor da retificação); o Treasury lê também o autor de cada fato |
| C2 | A lista de contas a pagar do Treasury (`ListPayablePositions`) não inclui `commission_payable`; a do Ledger (`USINA_PAYABLE_OBJECT_TYPES`) inclui | Alinhar as duas | ✅ Resolvido em 2026-11-13 (`TODO-05`): a lista inclui a obrigação de comissão, como o Ledger conta (`CA-640`) |
| C3 | Tempo limite e nova tentativa nas chamadas do Treasury ao Ledger | Verificar e definir | ✅ Verificado em 2026-11-13: leitura com limite de 4 s e envio com 5 s. O envio que falha não é repetido sozinho: a intenção fica para ser enviada de novo, e a chave de idempotência do Ledger torna isso seguro |

**Resiliência e operação**

| # | Ponto | O que fazer | Situação |
| --- | --- | --- | --- |
| R1 | O lote preparado (`REQ-239`) vive só em memória e se perde ao reiniciar | Gravar em SQLite (passo 4) | Resolvido em 2026-11-13 (`TODO-08`, `REQ-652`) |
| R2 | Cobertura de testes do Ledger em 84,36% de linhas e 84,78% de funções, abaixo do mínimo de 85% (já estava abaixo antes, 84,11% e 84,71% no commit `308e90e`) | Subir ao mínimo; a regra do repositório não deixa passar | ✅ Resolvido em 2026-11-13 (`TODO-04`): 85,48% de linhas, 85,52% de funções e 85,86% de ramos, com testes de verdade e sem excluir arquivo da medição |
| R3 | Autenticação e autorização do Treasury (`DEC-041`) | Decidir antes de abrir para usuários reais | 🔶 Decidida em 2026-11-13 (§6); implementação no `TODO-01`. Falta o envio de e-mail (`TODO-17`) |

---

## 18. Primeira versão funcional — plano (TODO)

> Decidido na rodada 19 (2026-11-13), numa descoberta de produto com o dono do produto. **Esta seção
> define a ordem do trabalho** até a primeira versão que a equipe financeira possa avaliar. Ela não revoga
> nenhuma regra: os `REQ` continuam valendo, e muda só o que vem primeiro. O que não é PRI-0 aqui não entra
> nessa versão.

### 18.1 O que se sabe da equipe

**Confirmado pelo dono do produto em 2026-11-13**

- **Cinco pessoas.** **Três verificadores** acompanham, entre os sistemas, o que foi baixado e produzido, as
  solicitações de adiantamento e o que pode virar entrada ou saída. O **CFO** confirma entradas e saídas,
  prepara ou faz os lançamentos e é o **único que paga e confere recebimentos nos bancos**; organiza o que
  está pendente, decide o que pagar hoje, avalia se o caixa suporta as saídas e faz a conciliação. Hoje
  ele consolida um "caixa fictício" com heurísticas por banco, planilhas e anotações em que não confia.
  **Uma pessoa de Business** negocia com empresas e parceiros, define os riscos e precisa dos resultados
  por corretor e por produto (o produto é de terceiros e é analisado pelas empresas que pagam comissão à
  Usina).
- **Volume:** a moda semanal no 1º trimestre de 2026 foi de **≈1.140 operações entre repasses e
  pagamentos**. Não há separação confiável entre os dois.
- **Três instituições:** Bradesco, Itaú e uma corretora de investimentos. Cada uma tem a sua heurística.
- **Dores nas palavras do CFO:** contas que aparecem do nada (um cartão de crédito da Usina pago com juros,
  sem saber o que foi comprado nem por quê) e pagamentos "escondidos" em conversas de WhatsApp e
  planilhas.
- **Provisões:** o CFO aloca dinheiro na corretora para usar depois em eventos e precisa controlar isso
  (`DEC-045`).
- **A receber:** não há controle detalhado, nem responsável, nem visão confiável do que deveria ter
  entrado, do que entrou e do que está pendente.
- **Saídas:** não há entregas periódicas estabelecidas. Cada pedido de informação é uma consolidação
  manual de baixa confiança.
- **Aprovação:** a final é do CFO, que vê os lotes de saída e de entrada no banco.
- **Seguro e saúde:** os dois sistemas registram que a operadora **sinalizou** ter pago X à Usina, por
  parcela ou no total, com Y da Usina e Z do corretor. **Sinal não é dinheiro na conta.** O financeiro
  confronta isso com o banco e com o que foi negociado à parte (ajustes, renegociações, condições
  especiais). A integração da saúde é pedida "o quanto antes".
- **Escopo e prazo:** o **financeiro inteiro**, não só comissões. Uma primeira versão avaliável pela equipe
  **ainda em 2026**, para começar 2027 com outra estrutura.
- **Virada:** o passado pode ficar nas planilhas. O sistema deve permitir **reconstruir o histórico aos
  poucos**, fora das temporadas de pico. No pico importa a visão confiável do **presente e do futuro
  próximo**: o que há, o que está pendente e o que se espera receber e pagar.

**Hipóteses, não confirmadas:** as provisões são investimentos pós-fixados (`DEC-045`); quem mais tem
acesso aos bancos é uma equipe terceirizada que faz lançamentos automáticos.

**Em aberto:** `DEC-045`, `Q-053`–`Q-056` (§15). A `DEC-044` foi decidida em 2026-11-13 (§8.6).

### 18.2 As dores, classificadas

| # | Dor | Quem sente | Impacto | Frequência | Risco | O que já existe | Prioridade |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Não saber o que precisa ser pago hoje: contas aparecem do nada | CFO | Alto | Diária | Juros, multa, pagamento indevido | A obrigação com vencimento (§4.1, nº 16) e as obrigações vindas dos sinais. Falta vê-las juntas, por data | PRI-0 |
| 2 | Não saber quanto há em cada instituição nem se o livro bate com o banco | CFO | Alto | Diária | Decidir sobre um número errado | Só o caixa consolidado (`DEC-044`) | PRI-0 |
| 3 | Registrar ≈1.140 pagamentos por semana | CFO e verificadores | Alto | Diária | O sistema não ser usado | Lote decidido (`REQ-239`, `REQ-246`, `REQ-249`), só em memória e sem tela | PRI-0 |
| 4 | Não saber o que deveria ter entrado, o que entrou e o que está atrasado | CFO e verificadores | Alto | Contínua | Comissão não recebida e nunca cobrada | Sinais do seguro e situação por apólice (§4.6). Falta a visão de tudo e a saúde | PRI-0 |
| 5 | Resultado por corretor e por produto | Business | Médio na primeira versão: os números só cobrem o período desde a virada | Periódica | Decisões comerciais sem base | Decidido (§8.3), não implementado | PRI-1 |
| 6 | Controlar as provisões na corretora | CFO | A confirmar | A confirmar | A confirmar | Nada; o mecanismo é desconhecido | PRI-1, descoberta antes |
| 7 | Relatórios e fechamento do mês | Direção | Não há processo nem formato a seguir | — | — | Nada | PRI-2 |
| 8 | Histórico anterior à virada | Todos | Baixo no pico | Por temporada | — | O Ledger aceita datas passadas | PRI-2, por decisão do dono do produto |

### 18.3 O que é a primeira versão utilizável

**Toda manhã, o CFO responde no Treasury, sem a planilha:**

1. Quanto há em cada instituição, e se isso bate com o banco.
2. O que está vencido, o que vence hoje e nos próximos dias, e o que não tem vencimento conhecido.
3. Se o caixa conhecido cobre o que vence.
4. O que se espera receber, o que está atrasado e o que a operadora declarou ter pago sem que o dinheiro
   tenha sido visto no banco.

**E ao longo do dia:** o CFO registra de uma vez os pagamentos que fez; os verificadores transformam os
sinais do seguro e da saúde em fatos propostos; e qualquer um dos cinco registra uma obrigação assim que
fica sabendo dela, para que nada apareça do nada.

**Aprovação:** a equipe usa a versão em paralelo à planilha (`TODO-13`). Ela está aprovada quando o CFO
decide o que pagar no dia pelo Treasury, sem a planilha (`Q-056`).

**Fica fora da primeira versão:** tudo o que está em PRI-1 e PRI-2 abaixo, em especial a conciliação linha
a linha, a importação de extrato, os relatórios e o fechamento, a compensação e a operação composta no
Treasury, a reconstrução do histórico e a aprovação em duas etapas.

**Se o prazo apertar,** cede primeiro o `TODO-11` (a saúde é registrada à mão durante a avaliação) e depois
o `TODO-12` (só os números lado a lado, sem o painel). A fase A não cede.

### 18.4 TODO

**Regras do plano.** Cada item segue o método de §16.1 (conversa, anotação, testes, implementação). Uma
tela só está pronta depois de vista no navegador com o Ledger de verdade e um volume realista. Um item
entra, sai ou muda de prioridade só com o aval do dono do produto, e o piloto (`TODO-13`) é a fonte
principal dessas mudanças.

#### Entregáveis da primeira versão

> Decidido em 2026-11-13. **A âncora do trabalho são os entregáveis**, não as decisões: um entregável
> começa assim que tem contexto suficiente, e uma `DEC` é resolvida quando passa a bloquear uma entrega.
> Os `TODO` abaixo são o trabalho de cada entregável.

| # | Entregável | Para quem e que problema resolve | TODOs | O que bloqueia | Pode começar? |
| --- | --- | --- | --- | --- | --- |
| **E1** ✅ | **Ambiente confiável:** login por pessoa, cópia diária do livro, telas que aguentam o volume real | Os cinco. Sem isso não há uso real: a auditoria não sabe quem fez o quê, um reinício pode perder a avaliação e as telas travam com ≈1.140 operações por semana | 01–04 | Nada. A `DEC-041` foi decidida em 2026-11-13 (§6) | Sim |
| **E2** | **Agenda a pagar** | CFO. Acaba com a conta que aparece do nada (dor 1) | 05 | Nada; a janela começa em 7 dias (`Q-055`) | ✅ Feito em 2026-11-13 |
| **E3** | **Pagamentos do dia em lote** | CFO. Permite registrar o volume real (dor 3) | 08 | Nada: a `DEC-044` foi decidida em 2026-11-13 (§8.6) | ✅ Feito em 2026-11-13 |
| **E4** | **Agenda a receber**, com o declarado pela operadora e ainda não visto no banco | CFO e verificadores. Saber o que cobrar (dor 4) | 09 | Nada; `DEC-036` melhora a precisão e pode esperar o piloto | Sim |
| **E5** | **Sinais entrando sozinhos:** seguro em operação real e saúde | Verificadores. Obrigações e expectativas sem digitação | 10, 11 | Seguro: nada. Saúde: `Q-054`, que é falta de informação, não decisão | Seguro sim; saúde não |
| **E6** | **Saldo por instituição e conferência com o banco** | CFO. O livro passa a bater com o banco (dor 2) | 06, 07 | `Q-055`, e como entra a transferência entre instituições (`REQ-650`). A `DEC-044` foi decidida | Sim, o saldo por instituição; a conferência espera `Q-055` |
| **E7** | **Painel da manhã: o caixa cobre o que vence?** | CFO. A pergunta diária "posso pagar hoje?" | 12 | Uma versão inicial usa o caixa consolidado, que já existe; a versão por instituição espera o E6 | Sim, a inicial |
| **E8** | **Piloto com a equipe** | Os cinco. Confirma se a versão serve e reordena o resto | 13 | `Q-056`, só quando o piloto começar | Depois de E1–E4 |

**Até quando cada decisão pode esperar**

| Decisão | Pode ficar aberta até |
| --- | --- |
| `DEC-044` | ~~Decidida em 2026-11-13~~: §8.6, `REQ-650`. Antes: **o primeiro pagamento real registrado no piloto.** Um fato é imutável: o que for registrado sem instituição fica "instituição desconhecida" para sempre, a menos que se crie um meio de completar isso depois. Não bloqueia construir o E3; bloqueia usá-lo de verdade. Discutir em paralelo ao E2 |
| `Q-054` | O E5 da saúde. Enquanto isso, a saúde é registrada à mão |
| `Q-055` | O E6. Para o E2, o valor provisório basta |
| `Q-056` | O início do piloto |
| `DEC-041` | ~~Decidida em 2026-11-13~~: §6 |
| `DEC-045`, `Q-053`, `DEC-036` | PRI-1; o piloto diz se alguma sobe |
| `DEC-004`, `DEC-018`, `DEC-021`, `DEC-023`, `DEC-033`, `DEC-037`, `Q-050`–`Q-052` e as demais | Não tocam nenhum entregável da primeira versão |

**Ordem de execução:** (1) E1 e E2, com a conversa da `DEC-044` e os pedidos de `Q-054` e `Q-055` em
paralelo; (2) E3, E4 e o seguro do E5; (3) E6 e o E7 completo, a saúde quando houver acesso aos dados, e
então o E8.

**Sequência dos TODO:** A → B → C → D. Dentro de cada fase, a ordem é a dos números.

```
A  TODO-01 acessos · 02 cópia · 03 volume · 04 cobertura do Ledger
B  TODO-05 agenda a pagar ─┬─ 08 pagamentos do dia
   TODO-06 saldo por instituição (DEC-044, depende de 04) ─┬─ 07 conferência com o banco
                                                           └─ 08
C  TODO-09 agenda a receber · 10 seguro em operação real · 11 saúde (Q-054)
D  TODO-12 o caixa cobre o que vence? (05, 06, 09) → 13 piloto com a equipe
```

#### PRI-0 — indispensável para a primeira versão

**Fase A — base para gente de verdade usar**

`TODO-01` **Cada uma das cinco pessoas entra com o seu login e o seu papel**, pelas regras de §6. Sugestão
a confirmar com o CFO: ele como Administrador com curadoria, os três verificadores como gestores
financeiros e Business como visualizador.
*Por quê:* a auditoria (quem fez o quê, §10) só vale com logins individuais, e hoje os usuários vêm de
variáveis de ambiente, sem tela para criá-los.
*Situação:* ✅ implementado em 2026-11-13, sem commit. A verificação das telas no navegador **não é
condição** para fechar este item (decidido em 2026-11-13): acontece no uso real, no piloto (`TODO-13`). §6 inteira menos
o envio de e-mail (§6.4): três papéis; e-mail como login; comando do primeiro administrador e comando de
criação de usuário só em desenvolvimento; convite com link na tela; desativação, troca de papel e
curadoria pelo Administrador, com registro só de acréscimo; sessão de 12 h guardada só pelo hash e que
sobrevive a reinício; suspensão após 5 falhas; recusa uniforme; recusa de outro site; toda a API
protegida por padrão; telas de login, aceite do convite e **Usuários**. Testes:
`acceptance-access.test.ts` (os `CA`, `EX` e `REJ` de §6), `access-sqlite.test.ts` (nada em claro no
disco, sessão após reinício, usuário nunca apagado), `access-commands.test.ts` e
`features/users/usersEngine.test.ts`. Suítes: Treasury 948 no backend, com 37 `it.todo`, e 185 no
cliente. Validado também com o servidor real (`src/index.ts`) por HTTP, inclusive a sessão depois de um
reinício. Deploy: as senhas fixas saíram; entram `PUBLIC_BASE_URL` e o passo do primeiro administrador
(`deploy/README.md`). Para o piloto, a base começa limpa (§6).

`TODO-02` **O livro não se perde:** cópia diária dos dados do Ledger e do Treasury, com uma restauração
testada.
*Por quê:* perder o livro durante a avaliação destrói a confiança, que é a razão do produto (§1.1,
"Backup e restauração").
*Situação:* ✅ 2026-11-13, sem commit. Destino decidido pelo dono do produto: o **Cloudflare R2** que a
Usina já usa, sob um prefixo próprio, sem tocar nos demais arquivos do bucket; ficam as 30 cópias mais
recentes. Serviço `backup` no `deploy/docker-compose.yml` (`deploy/backup/`): cópia online às 03:00,
conferida antes de sair, com `SHA256SUMS`; logs de auditoria do Ledger espelhados; `unhealthy` com mais
de 26 horas sem cópia boa; comandos `list`, `run`, `verify` e `restore`, que guarda os arquivos anteriores.
Teste: `deploy/backup/test.sh`, 9 verificações contra uma pasta local no lugar do R2. Falta o primeiro envio
ao R2 de verdade, que acontece no deploy com as credenciais do `.env` (`deploy/README.md`, "Backup").

`TODO-03` **As telas do dia respondem com o volume real.** Simular um mês de uso (≈1.140 pagamentos por
semana, mais obrigações e sinais) e resolver o que travar nas telas da primeira versão: §17 P1, P2, P4,
P6 e C3.
*Por quê:* o volume deixou de ser hipótese, e §17 ficaria tarde demais se esperasse a produção.
*Serve a:* `TODO-05` a `TODO-12`.
*Situação:* ✅ 2026-11-13, sem commit. Um mês simulado pelos próprios casos de uso do Treasury, com o Ledger
de verdade em SQLite: 21 dias úteis, 3.150 apólices (comissão prevista), 2.400 obrigações com corretores,
1.950 recebimentos em lote por seguradora, 2.100 repasses e 2.730 outros pagamentos, ou seja, ≈1.150
pagamentos e repasses por semana; 12.330 fatos, todos aceitos, e 5.550 sinais, assinados por quatro
usuários. **Todas as 17 leituras das telas do dia ficaram abaixo de 1 s**; a mais lenta é o cabeçalho da
página da parte, com 342 ms de mediana e 418 ms no pior caso. Nada precisou ser mudado; o que cresce com o
livro está em §17, com os números. Ferramentas para repetir a medição: `npm run load:month` e
`npm run load:measure` (`treasury/src/infra/load/`), só contra um livro de teste.
**Observado e não resolvido, por não travar hoje:** a lista de intenções devolve tudo de uma vez (1,5 MB
para o CFO no mês; a tela mostra 10 por página); a gravação fica mais lenta à medida que o livro cresce
(de ~5 ms para ~13 ms por fato ao longo do mês). Medir de novo ao fim de cada mês do piloto.

`TODO-04` **Cobertura de testes do Ledger de volta ao mínimo** (§17 R2).
*Por quê:* é regra do repositório (`CLAUDE.md`), e o `TODO-06` mexe no Ledger.
*Situação:* ✅ 2026-11-13, sem commit. Testes novos: as recusas de registro externo malformado no
`StagingRecordValidator` (vocabulário desconhecido, objeto e motivo incompletos) e o log de auditoria em
arquivo (`file-audit-logger.test.ts`: um arquivo por dia, uma linha por entrada, e falha de escrita que
nunca bloqueia quem chamou). Ledger: 886 passam e 12 pendentes (passo 6).

**Fase B — o que pagar hoje e com que dinheiro**

`TODO-05` **Agenda a pagar.** Uma tela com tudo o que a Usina deve, de todos os tipos, inclusive a
obrigação de comissão (§17 C2). Fica separada em vencido, hoje, próximos dias e depois, e **sem vencimento
conhecido** à parte, nunca tratado como "hoje" (§4.1). Cada linha leva ao pagamento já ligado à obrigação
(`REQ-603`). A janela "próximos dias" começa em 7 e é ajustada no piloto (`Q-055`).
*Por quê:* dor 1, a mais citada pelo CFO. As obrigações já podem ser registradas; falta o lugar onde
elas aparecem juntas, por data. É também o que faz valer a pena registrar uma conta assim que se fica
sabendo dela.
*Depende de:* `TODO-03`.
*Situação:* ✅ 2026-11-13, sem commit; as regras estão em §8.5 (`REQ-640`–`REQ-645`). Decidido pelo dono
do produto: não há prazo combinado para o repasse ao corretor, então ele fica em "sem vencimento"; os
totais de cada janela vêm do Ledger (`DEC-042`, item 1). **Ledger:** nova leitura
`GET /api/positions/agenda/payables` (`PayablesAgendaService`), que não muda fato nem regra; o dia é o
de São Paulo. **Treasury:** `GET /api/dashboard/agenda`, a tela **Agenda a pagar** no menu (cinco janelas
com o total do Ledger, credor, valor em aberto e original, vencimento ou "aberta há N dias"; a linha abre
a posição, de onde sai o pagamento ligado a ela; o visualizador vê sem o botão). §17 C2 resolvido junto.
Com o Ledger simulado (`LEDGER_MODE=simulate`), a agenda diz "indisponível": ela precisa do Ledger de
verdade. Testes: `payables-agenda-endpoint.test.ts` (Ledger, 15), `payables-agenda.test.ts` e o caso novo
de `payable-positions.test.ts` (Treasury) e `agendaEngine.test.ts` (tela). Medido com um mês à volumetria
real mais 20 contas de fornecedor por dia com vencimento: cada janela em ~90 ms, e o total de cada uma
confere com a soma das suas linhas. Suítes: Ledger 901 e 12 pendentes (85,76% de linhas); Treasury 956
no backend, com 37 `it.todo`, e 188 no cliente. Como no `TODO-01`, a tela será vista no navegador no
piloto.

`TODO-06` **Saldo por instituição.** Cada entrada e saída diz em qual instituição aconteceu. O saldo
conhecido aparece por instituição e somado. A transferência entre instituições, inclusive para a corretora,
é movimento interno: não é entrada nem saída. Um movimento sem instituição aparece como **"instituição
desconhecida"**, nunca distribuído por suposição.
*Por quê:* dor 2. Sem isso não há conferência com o banco, e o caixa continua "fictício".
*Depende de:* `DEC-044` (muda a álgebra do Ledger e precisa de conversa de arquitetura antes) e `TODO-04`.

`TODO-07` **Conferência com o banco.** Para cada instituição, o CFO informa o saldo do extrato numa data,
e o Treasury mostra a diferença para o saldo do livro na mesma data. A diferença fica à vista até ser
explicada por fatos registrados. O saldo informado é um controle do Treasury, auditado, e **nunca um fato
do Ledger**.
*Por quê:* o CFO é o responsável pela conciliação e hoje usa heurísticas. Uma diferença à vista é o mínimo
que torna o livro confiável. A conciliação linha a linha e a importação de extrato ficam em PRI-2
(`TODO-21`).
*Depende de:* `TODO-06`; a forma e a frequência de cada instituição, de `Q-055`.

`TODO-08` **Pagamentos do dia de uma vez.** O CFO escolhe, na agenda a pagar, as obrigações que vai pagar,
de várias partes; paga no banco e anota que pagou, com data e instituição. Vira um evento por obrigação
(`REQ-246`), e um recusado não trava os demais (`REQ-249`). O lote preparado passa a ser gravado (§17 R1) e
também pode ser montado a partir da agenda, não só na página da parte (amplia `REQ-239`). Um pagamento sem
obrigação registrada continua sendo registrado, como fato válido, e fica visível como "pago sem obrigação"
(`REQ-634`).
*Por quê:* dor 3. Com ≈1.140 por semana, registrar um a um pela conversa é inviável, e sem isso o sistema
não é usado. A regra já está decidida; falta a tela e a gravação.
*Depende de:* `TODO-05` e `TODO-06`.
*Situação:* ✅ 2026-11-13, sem commit; as regras estão em §8.6 (`REQ-650`–`REQ-654`). Do `TODO-06` só era
preciso a `DEC-044`, decidida no mesmo dia: o fato de caixa cita a instituição como contexto. **Ledger:** o
tipo de contexto `cash_account`, no máximo um por fato de entrada ou saída, recusado em fato sem dinheiro e,
até o E6, na transferência interna; `algebra.json` reexportado. O molde do evento e os fatos gravados não
mudam. **Treasury:** na agenda, quem paga marca as linhas (de qualquer janela e de vários credores) e
prepara o lote, com o valor de cada linha (menor que o aberto é pagamento em parte; maior, recusado). Os
lotes preparados ficam acima das janelas, gravados em SQLite (§17 R1), com "Anotar pagamento" (data,
instituição ou "não informada", débito no banco) e "Descartar". O pagamento só sai se o débito bater com o
lote; vira um lançamento por linha pelo mesmo caminho da conversa (`StartPositionAction`), pago ao credor,
citando o lote e a instituição; o resultado de cada linha fica no lote, em "Pagos recentemente". As
instituições vêm de `CASH_INSTITUTIONS` (hoje Bradesco, Itaú e a corretora); a chave fica gravada nos fatos
e não pode mudar depois de usada. **Não feito:** o extrato de recebível (`REQ-244`) e os recibos
(`REQ-245`); o lote montado na página da parte continua sem tela; o "pago sem obrigação" segue pela
conversa. Testes: `cash-account.test.ts` (Ledger, 7), `payables-batch.test.ts` (Treasury, 20, inclusive
reinício e dois pagamentos simultâneos), as rotas novas em `access-by-route.test.ts` e
`batchSelection.test.ts` (tela). Sabotagens conferidas: sem a conferência do débito, ou sem a regra no
Ledger, os testes falham. Verificado de ponta a ponta com o Ledger de verdade: lote de 4 contas (uma paga em
parte) anotado no Itaú, os 4 eventos citando o lote e a instituição, a agenda atualizada, o lote
sobrevivendo ao reinício, e a segunda anotação recusada. Suítes: Ledger 908 e 12 pendentes; Treasury 981,
com 37 `it.todo`, e 194 no cliente. A tela será vista no navegador no piloto.

**Fase C — o que esperamos receber**

`TODO-09` **Agenda a receber.** Tudo o que se espera receber, por pagador (operadora), com a data esperada:
atrasado, a vencer e **sem data** (`REQ-271`). Em separado, o que **a operadora declarou ter pago e ainda
não foi visto no banco** (`REQ-263`). Também aparecem os recebimentos sem origem, para serem ligados.
*Por quê:* dor 4. Hoje ninguém sabe o que deveria ter entrado. É a primeira vez que a Usina terá base para
cobrar uma operadora.
*Depende de:* `TODO-03`. A parte da saúde vem do `TODO-11`.

`TODO-10` **Seguro em operação real.** Os sinais do sistema de seguro chegam pelo broker de mensagens de
verdade, com o produtor e o consumidor rodando no ambiente da avaliação.
*Por quê:* a integração foi implementada mas nunca rodou de ponta a ponta (§16.1), e é dela que nascem as
obrigações com os corretores do seguro.

`TODO-11` **A saúde entra como o seguro.** Os sinais do sistema de saúde (a operadora disse que pagou X, por
parcela ou no total, com Y da Usina e Z do corretor) viram fatos propostos pelo mesmo conceito de sinal
externo (§4.6). Geram só expectativas e obrigações, nunca recebimento (`REQ-262`, `REQ-263`).
*Por quê:* pedido do dono do produto. Sem isso, as agendas mostram só a metade do negócio, ou a saúde é
digitada uma operação por vez.
*Depende de:* `Q-054`.

**Fase D — juntar e avaliar**

`TODO-12` **O caixa cobre o que vence?** Na agenda a pagar, o total vencido e o de cada dia ficam ao lado
do saldo conhecido de cada instituição, e, à parte, o que se espera receber no mesmo período. É uma leitura
dos fatos, não uma previsão: o esperado **nunca é somado ao caixa**, e o que não tem data não entra em dia
nenhum (`CLAUDE.md`, "Derivations must not assume completeness").
*Por quê:* "avaliar se o caixa suporta as saídas previstas" é tarefa diária do CFO.
*Depende de:* `TODO-05`, `TODO-06` e `TODO-09`.

`TODO-13` **Piloto com a equipe.** Os cinco usam a primeira versão em paralelo à planilha, numa rotina
combinada: o CFO com as agendas, a conferência e os pagamentos do dia; os verificadores com os sinais e as
obrigações; Business consultando. Cada dificuldade vira um item desta seção, com prioridade. O piloto
também completa a `DEC-043` (as rotinas dos verificadores e de Business).
*Por quê:* até hoje nenhum usuário real usou o sistema (§16.1), e só o uso diz se a versão serve.
*Depende de:* `TODO-01` a `TODO-12`; a duração e quem aprova vêm de `Q-056`.

#### PRI-1 — importante, logo depois da primeira versão

`TODO-14` **Resultado por corretor e por produto** para Business: o passo 6 (`REQ-620`–`REQ-624`), com o
produto lido pela operadora e pelo contexto (`DEC-021`, `DEC-023`).
*Por quê:* necessidade confirmada, mas na primeira versão os números cobrem só o período desde a virada.
O valor cresce com semanas de uso ou com a reconstrução do histórico (`TODO-22`).

`TODO-15` **Provisões do CFO:** entender com ele e então modelar (`DEC-045`). Hipótese: a ida à corretora é
movimento interno (`TODO-06`) e o rendimento é uma entrada.
*Por quê:* a necessidade está confirmada, mas o mecanismo não, e nada pode ser construído antes de
entendê-lo.

`TODO-16` **Ligar depois um recebimento sem origem** à sua expectativa, sem reescrever o fato (`DEC-036`).
*Por quê:* o dinheiro e o sinal chegam em ordens diferentes. Sem isso, a agenda a receber mostra como
atrasado o que já entrou. Sobe para PRI-0 se o piloto mostrar recebimentos soltos com frequência.

`TODO-17` **O que falta do acesso:** o envio de e-mail, com a recuperação de senha (§6.4, `REQ-435`), e a
permissão de anotar pagamento, que `REQ-248` já previa "se o uso mostrar necessidade". (Antes de
2026-11-13, este item também tinha a autenticação e as sessões, que foram para o `TODO-01` com a `DEC-041`.)
*Por quê:* o CFO é o único que paga no banco, mas com cinco pessoas a auditoria já mostra quem anotou.
Sem e-mail, quem esquece a senha é reconvidado (`FA-404`).

`TODO-18` **Documentos:** a fatura, a nota ou o extrato junto da obrigação e do pagamento (amplia
`REQ-247`); o extrato de recebível e o recibo ao corretor (`REQ-244`, `REQ-245`).
*Por quê:* "não sei o que foi comprado nem por quê". A descrição e o autor já cobrem o mínimo.

`TODO-19` **Pendências que ainda não são fatos:** solicitações de adiantamento e acordos que vão gerar
saída, visíveis para o CFO como pendências do Treasury, sem ir ao Ledger (`Q-053`).
*Por quê:* fazem parte do "o que vou ter de pagar", mas não são fatos. É preciso entender antes.

`TODO-20` **Carga das partes a partir das planilhas** (§5, adiada em 2026-11-06).
*Por quê:* com volume real, cadastrar parte por parte ou conviver com identidades provisórias pesa na
curadoria.

#### PRI-2 — depois

`TODO-21` **Conciliação linha a linha e importação de extrato** (OFX ou CNAB, `DEC-018`).
*Por quê:* `TODO-07` cobre o mínimo, e a forma de cada instituição ainda é desconhecida.

`TODO-22` **Reconstrução progressiva do histórico,** fora das temporadas de pico.
*Por quê:* decisão do dono do produto. O Ledger já aceita fatos com data passada.

`TODO-23` **Fechamento do mês, relatórios e exportação ao contador.**
*Por quê:* não há processo nem destinatário definido para imitar. Entra quando houver quem consuma.

`TODO-24` **O restante já decidido ou levantado:** a compensação no Treasury e a operação composta (passo 7),
os itens A1–A7 da página da parte, o bloco E (`REQ-266`), a aprovação em duas etapas (`DEC-004`), o texto
livre (`DEC-005`), a visão comparativa (`DEC-039`), os chips (`DEC-040`), as retenções e a nota fiscal
(§1.1).
*Por quê:* nenhuma dessas coisas responde a uma dor que a equipe tenha relatado.

---

## Anexo A — Operação → termo do Ledger

Referência para a comparação futura. **Não é regra de negócio**; a regra é a ficha de §4.1.

| Operação | Tipo de evento | Efeito econômico | Objeto | Relação | Motivo |
| --- | --- | --- | --- | --- | --- |
| Pagamento geral | `OUTBOUND_PAYMENT` | `CASH_OUT` | `PAYABLE` | `SETTLES` | `ORDINARY_SETTLEMENT` |
| Folha | `PAYROLL_PAYMENT` | `CASH_OUT` | `PAYROLL` | `SETTLES` | `PAYROLL_PAYMENT` |
| Infraestrutura | `INFRASTRUCTURE_EXPENSE` | `CASH_OUT` | `INFRASTRUCTURE_COST` | `SETTLES` | `INFRASTRUCTURE_EXPENSE` |
| Taxa de serviço | `SERVICE_FEE_PAYMENT` | `CASH_OUT` | `SERVICE_FEE` | `SETTLES` | `SERVICE_FEE_PAYMENT` |
| Imposto | `TAX_PAYMENT` | `CASH_OUT` | `TAX` | `SETTLES` | `TAX_PAYMENT` |
| Multa | `PENALTY_PAYMENT` | `CASH_OUT` | `PENALTY` | `SETTLES` | `PENALTY_PAYMENT` |
| Incentivo / bônus | `INCENTIVE_PAYMENT` | `CASH_OUT` | `INCENTIVE` \| `BONUS` | `SETTLES` | `INCENTIVE_PAYMENT` |
| Adiantamento | `ADVANCE_PAYMENT` | `CASH_OUT` | `ADVANCE` | `ORIGINATES` | `ADVANCE_PAYMENT` |
| Recuperação de adiantamento | `ADVANCE_SETTLEMENT` | `CASH_IN` | `ADVANCE` | `SETTLES` | `ADVANCE_PAYMENT` |
| Empréstimo | `LOAN_ORIGINATION` | `CASH_OUT` | `LOAN` | `ORIGINATES` | `LOAN_ORIGINATION` |
| Quitação de empréstimo | `LOAN_REPAYMENT` | `CASH_IN` | `LOAN` | `SETTLES` | `LOAN_REPAYMENT` |
| Comissão prevista | `COMMISSION_EXPECTED` | `NON_CASH` | `COMMISSION_RECEIVABLE` | `ORIGINATES` | `COMMISSION_ACCRUAL` |
| Comissão recebida | `COMMISSION_RECEIVED` | `CASH_IN` | `COMMISSION_RECEIVABLE` | `SETTLES` | `COMMISSION_PAYMENT` (sem origem: `UNKNOWN_ORIGIN`) |
| Repasse de comissão | `COMMISSION_SPLIT` | `CASH_OUT` | `COMMISSION_PAYABLE` | `SETTLES` | `COMMISSION_SPLIT` |
| Pagamento direto ao corretor | `DIRECT_PAYMENT_ACKNOWLEDGED` | `NON_CASH` | `COMMISSION_RECEIVABLE` + `COMMISSION_ENTITLEMENT` | `SETTLES` | `DIRECT_COMMISSION_PAYMENT_AUTHORIZED` |
| Renúncia de comissão | `COMMISSION_WAIVER` | `NON_CASH` | `COMMISSION_ENTITLEMENT` | `SETTLES` \| `REVERSES` | `COMMISSION_WAIVER` |
| Reconhecimento de obrigação | `OBLIGATION_RECOGNIZED` | `NON_CASH` | `COMMISSION_PAYABLE` \| `PAYROLL` \| `SERVICE_FEE` \| `INFRASTRUCTURE_COST` \| `TAX` \| `PAYABLE` | `ORIGINATES` | `OBLIGATION_RECOGNITION` (tardio: `LATE_AWARENESS`) |
| Compensação (no Ledger; o Treasury ainda não oferece) | `COMPENSATION` | `NON_CASH` | pelo menos uma a receber (`ADVANCE` \| `LOAN`) e uma a pagar (`COMMISSION_PAYABLE`) (`DEC-025`) | `SETTLES` (contextos: `REFERENCES`) | `COMPENSATION` |
| Retificação | `LEDGER_CORRECTION` | `NON_CASH` | `ADVANCE` \| `LOAN` \| `COMMISSION_RECEIVABLE` \| `COMMISSION_PAYABLE`, mais as demais posições do lançamento (`REQ-525`) | `RETRACTS` | `DATA_RECONCILIATION` |

---

## Anexo B — Levantamento do sistema de seguro

Levantado em 2026-11-07, por leitura de um sistema local do dono do produto e de sua descrição.
**Não é regra de negócio nem decisão**; é o material para `DEC-028` a `DEC-030`. Nenhum dado foi
gravado lá, e nenhuma credencial ou dado de cliente fica neste documento.

### B.1 O que existe lá

Na máquina do dono do produto, roda na porta 3100; o login deve ser pedido a ele. A API autentica por
cookie de sessão (`POST /auth/login`). Rotas de leitura:

| Rota | Traz |
| --- | --- |
| `GET /policies`, `GET /policies/:id` | Apólice: id, número, proposta, cliente, corretor (`brokerId`, só no detalhe), seguradora e produto (ids), prêmio, vigência, renovação, situação e parcelas |
| `GET /proposals/:id/policy` | A apólice de uma proposta |
| `GET /policies/:id/payout` | Situação da elegibilidade: `WITHOUT_CR` → `CALCULATED` → `ELIGIBLE` |
| `GET /payouts/eligible` | Demonstrativo de cada apólice elegível, com o **nome** do corretor |
| `GET /payouts/policies-without-rate` | Apólices sem CR, com o **id** do corretor e `usinaValue` |

O sistema só registra a elegibilidade; **não movimenta dinheiro**. O demonstrativo é assinado (`signedBy`,
`eligibleAt`).

```
Conferido em duas apólices reais:
  valor da Usina = prêmio líquido × comissão trabalhada × CTU (quando houver)
  repasse        = valor da Usina × taxa de repasse (CR)
  retido         = valor da Usina − repasse

Prêmio 4.088,73 × 30% × CTU 80% = valor da Usina 981,30
981,30 × 70% = repasse 686,91 · retido 294,39
```

### B.2 Como isso poderia virar fatos

> **Decidido em 2026-11-09** com ajustes: a regra está em §4.6. A comissão recebida e o repasse não
> vêm do sistema de seguro (`REQ-262`, `REQ-263`).

| No sistema de seguro | No Ledger | Valor |
| --- | --- | --- |
| Apólice registrada | Comissão prevista, citando corretor e apólice | `usinaValue` |
| Declarada elegível | Obrigação com o corretor, citando a apólice (`Q-047`) | `payout` |
| Comissão chega | Comissão recebida, na mesma posição | O valor recebido (`Q-049`) |
| Banco paga | Repasse, na mesma obrigação | O valor pago |

`retained` não vira evento: é a diferença entre os dois valores. Nas palavras do dono do produto, a
apólice é a forma de dizer que se esperam duas coisas: uma comissão prevista e um possível repasse.

**Partes a levantar em `DEC-028`:** seguradora, corretor, cliente e demais envolvidas. O id de lá
entraria como mais um identificador da parte (`REQ-330`). Falta decidir como essas partes e apólices
chegam sem API e quem confirma (`REQ-323`).

### B.3 Posição contextual no Ledger: o que existe hoje

> **Respondido em 2026-11-09** (`DEC-029`): a apólice é `contract`; a elegibilidade é motivo, não
> contexto (`REQ-267`); o lote vale para o crédito único (`REQ-269`); a parcela depende de `Q-052`.

Verificado no código em 2026-11-07:

- São contextuais `contract`, `proposal`, `installment`, `settlement_batch` e `campaign`. **Não há tipo
  próprio para apólice nem para elegibilidade.**
- Um objeto contextual só admite a relação `references`, não move saldo e não precisa constar do
  contrato do evento.
- Consultar um objeto contextual pelo id devolve os eventos que o citam. Em `settlement_batch`, o
  campo `allocationGap` mostra o caixa recebido e ainda não distribuído.
- A retirada não precisa citar contextos (`REQ-525`).
- **O Treasury não cita nenhum contexto hoje.** O resultado por contexto (`REQ-621`) depende disso.

**Perguntas para `DEC-029`:**

- A apólice é `contract` ou merece tipo próprio? E a proposta continua sendo citada junto?
- A elegibilidade é um contexto próprio ou só o motivo da obrigação, citando a apólice?
- `allocationGap` serve para a apólice, mostrando o recebido e ainda não repassado? Hoje ele foi pensado
  para o lote e nada mais.
- A parcela (`installment`) precisa ser citada, conforme a resposta de `Q-049`?

### B.4 Página da pessoa (proposta para `DEC-030`)

> **Superado em 2026-11-12** por §8.4, decidida na rodada 18. Mantido como registro.

- **Resumo:** quanto a Usina deve à pessoa, quanto já pagou e quanto a pessoa deve à Usina.
- **Apólices:** o que está em aberto em cada uma; pagar a partir daí já vincula a obrigação certa.
- **Alerta:** "Pago sem obrigação: R$ 30,00" em destaque.
- **Histórico em frases:** "06/11: a Usina pagou R$ 30,00 ao Halisson, sem obrigação vinculada".
