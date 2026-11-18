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
> | 2026-11-13 | 19 (cont.) — agenda a receber | Sem decisão nova do dono do produto. **Novo:** §8.7 (`REQ-660`–`REQ-665`, `CA-660`–`CA-665`, `REJ-661`–`REJ-663`): o Ledger publica a agenda a receber pela data esperada, por pagador e com os recebimentos sem origem, como leitura; o Treasury marca o declarado pela operadora e ainda não visto no banco, sem somá-lo. **⚠ CONFIRMAR NO PILOTO:** empréstimo e adiantamento entram na agenda (`REQ-660`). **`TODO-09` feito; E4 fechado.** Nada foi revogado. |
> | 2026-11-16 | 20 — caixa por instituição | Conversa de arquitetura (muda a álgebra do Ledger). **Decidido:** o saldo de abertura é um fato por instituição (o saldo final do dia no extrato), fora dos totais de entradas e saídas; o que tem data até o dia da abertura já está nele; a transferência é um fato só, com origem e destino; a instituição é perguntada em todo lançamento de caixa, com "não informada" explícita; uma conta por instituição, a lista é configuração; a `Q-055` segue com o valor provisório. **Novo:** §8.8 (`REQ-670`–`REQ-676`, `CA-670`–`CA-675`, `REJ-670`–`REJ-675`). **Ampliados:** `REQ-650` (a transferência) e `REQ-277`/`REQ-653` (a instituição perguntada). **`TODO-06` e `TODO-07` feitos; E6 fechado.** Nada foi revogado. |
> | 2026-11-16 | 20 (cont.) — conciliação, o conceito | O dono do produto corrigiu a sua leitura de "bate com o banco": queria conciliação, não conferência por saldo. **Registrado:** o conceito de conciliação e a divisão de papéis entre Ledger e Treasury (§8.9); caixa completo é obrigatório, origem conhecida pode ficar pendente (`DEC-036`). **A rever:** `REQ-247`, `REQ-269` e a lista de fora da primeira versão (§18.3). **Atualizados:** `DEC-018` (as perguntas a responder), `Q-055` (o formato do extrato), `TODO-07` e `REQ-675` (é o alarme, não a conciliação), `TODO-21` (prioridade em revisão). A implementação do E6 continua válida; nada foi revertido nem revogado. A decisão sobre a conciliação ficou para depois do estudo do dono do produto. |
> | 2026-11-17 | 20 (cont.) — painel da manhã | **Decidido pelo dono do produto:** o quadro fica no topo do Painel. **Novo:** §8.10 (`REQ-680`–`REQ-685`, `CA-680`–`CA-685`, `REJ-683`, `REJ-684`): o caixa conhecido, o que vence dia a dia e, à parte, o que se espera receber, lado a lado, sem sobra nem falta calculadas; as agendas do Ledger passam a publicar o total de cada dia. **⚠ CONFIRMAR NO PILOTO:** se o CFO precisar de um veredito (`REQ-684`). **`TODO-12` feito; E7 fechado.** Nada foi revogado. |
> | 2026-11-17 | 20 (cont.) — telas no navegador | As telas do E2 ao E7 foram vistas no navegador com o Ledger de verdade, num livro de teste de 16 dias, em computador e celular, nos temas claro e escuro (regra de §18.4): agenda a pagar com o lote, agenda a receber, caixa por instituição com os três formulários, painel da manhã, crédito da seguradora e a pergunta da instituição na conversa. **Corrigido:** a tabela do painel cortava colunas; os modais do lote e do caixa não tinham margem interna; o resumo antes de confirmar não mostrava a instituição; no celular, a agenda a pagar, a agenda a receber e Posições ficavam mais largas que a tela (texto oculto para leitor de tela escapando da tabela; corrigido no componente de tabela). **Achado, não corrigido:** na conversa, o texto livre lê um número do nome como valor ("Fornecedor 13" → R$ 13,00); a prévia mostra o valor antes do envio. Nada foi revogado. |
> | 2026-11-17 | 21 — sistema de saúde | Investigação de domínio, sem implementação. **Decidido:** a saúde entra pelo sinal externo, por parcela, com três fatos propostos (§4.7, `REQ-281`–`REQ-289`); a expectativa é aberta pelo baixado declarado até a saúde informar o devido (`REQ-285`); a obrigação com corretor e supervisor nasce na comunicação, mas só se o usuário confirmar, e "sem obrigação" é auditado (`REQ-286`); a tabela de comissão do corretor é só referência da saúde (`REQ-287`); o `ingest:receipt` do Ledger é aposentado (`REQ-289`); o tributo da nota é fato à parte, registrado só quando estabelecido, e a taxa é base do sinal (`REQ-290`, `DEC-046`). **Em parte respondida:** `Q-054` (falta o acesso para a leitura automática). **Abertos:** `Q-057` (parcela zero), o `⚠ CONFIRMAR` de `REQ-286`; `REQ-266` continua adiado. Nada foi revogado. **Depois, no mesmo dia:** decidida e implementada a tela própria (`REQ-291`); §4.7 implementada, com o estado "Sem obrigação" (§11.1); o `ingest:receipt` foi tirado do `dev:full` e passou a recusar o início. Visto no navegador com o Ledger de verdade, em computador e celular, nos temas claro e escuro. **Por último:** decidido e implementado o crédito da operadora, o mesmo lote do seguro etiquetado por parcela de proposta (`REQ-292`); visto no navegador e enviado ao Ledger de ensaio (três parcelas de duas propostas e a sobra sem origem). |
> | 2026-11-17 | 21 (cont.) — Partes | **Decidido e implementado:** Partes vira uma tela só, com as identidades sem resolução no topo, para todos; o cadastro num modal; "Cadastrar e ligar" numa identidade pendente; a lista com tipo, CPF/CNPJ e conta bancária para quem consulta (`REQ-315`, `CA-315`). **Alterado:** o "Resolver" da notificação passa a levar a Partes, e a tela "Cadastro de partes" deixa de existir. Visto no navegador, em computador e celular. Nada foi revogado. |
> | 2026-11-18 | 22 — ações onde a pergunta acontece | Conversa de produto e UX, sem implementação. **Confirmado pelo dono do produto, com o CFO:** o adiantamento a corretor é muito frequente; o corretor pede o adiantamento dizendo ter vendido propostas e apólices que ainda não entraram no financeiro (não elegíveis no seguro, sem parcela baixada na saúde), e a Usina libera o valor, que fica aberto para ser abatido em repasses futuros, no todo ou em parte, às vezes ao longo de vários. **Decidido:** a volta da conversa à tela de origem; ações na linha da Operação e alertas que levam à linha; a seleção na Operação com uma barra que oferece só o que a combinação permite; a compensação no Treasury, **um par por evento** (o Ledger aceita mais, e fica como está); o crédito por pagador na agenda a receber; a ponte do adiantamento para a página da parte; a descrição orientada do adiantamento com o que o corretor declarou, sem citar as apólices como contexto (§8.11, `REQ-690`–`REQ-697`, `REQ-293`). **Prioridade:** a compensação no Treasury e o A1 saem do `TODO-24` (PRI-2) para o `TODO-25` (PRI-1). **Abertos:** `Q-058` (o desconto no pagamento, a confirmar com o CFO) e `DEC-047` (o declarado em forma estruturada). Nada foi revogado. **Depois, no mesmo dia:** os passos (1) a (4) do `TODO-25` implementados (a volta da conversa, a ação na linha e os alertas que abrem a posição, a seleção com a barra e a compensação de um par, o crédito por pagador e a ponte do adiantamento); o alerta abre a posição em vez de levar à linha, que pode estar em outra página (`REQ-691`).; o crédito na agenda só para pagador com comissão prevista em aberto (`REQ-695`). |
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

> **A rever (2026-11-16):** como anexo de um pagamento, o extrato pode continuar opcional; como evidência da
> conciliação, não é opcional. Ver §8.9. A regra segue valendo até a `DEC-018` ser decidida.

> **Confirmado em 2026-11-11 (rodada 17):** o extrato continua **opcional**, também no lote. O pagamento
> conta como feito quando é anotado (`REQ-245`), com ou sem extrato. Exigir o extrato desde o início
> dificultaria o uso; deixá-lo opcional permite questionar depois um pagamento que ficou sem ele.

`REQ-248` **Qualquer operador** pode registrar o pagamento, e a auditoria mostra quem foi. Se o uso
mostrar necessidade, isso vira uma permissão, como a de curadoria (`REQ-402`).

### 4.5 Compensação, obrigação de comissão e operação composta

> Decidido em 2026-11-06. **Implementados:** `REQ-253` e `REQ-254`; a compensação no Ledger (`REQ-250`, `REQ-251`,
> `REQ-624`) em 2026-11-11, e no Treasury, de um par, pela página da parte, em 2026-11-18 (`REQ-693`, `TODO-25`); o restante ainda não. O sistema é descritivo: o que não estiver
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

`REQ-293` **O que o corretor declarou ao pedir o adiantamento** (decidido em 2026-11-18). O corretor costuma
pedir um adiantamento dizendo ter vendido apólices e propostas que ainda não entraram no financeiro. A conversa
do adiantamento **orienta a descrição** com essa pergunta ("O que o corretor disse ter vendido? Apólices,
propostas e parcelas"), com um exemplo do formato. A descrição continua **opcional**: o adiantamento é válido
sem ela ("a validade de um fato independe da sua linhagem", `CLAUDE.md`). O declarado **não é citado como
contexto** no Ledger: o que se sabe é que o corretor **disse**, não que a venda existe ou gera comissão. A
ligação verdadeira chega com a compensação, que cita a apólice da obrigação abatida (`REQ-275`, `REQ-694`).
A forma estruturada do declarado fica em `DEC-047`.

```
Adiantamento de 500,00 ao Halisson
  descrição: "Apólices X, Y e Z; proposta Abc12 parcelas 1 e 2; proposta Dcba parcela 3"
  contextos citados: nenhum
```

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

> **A rever (2026-11-16):** a conciliação é por conta e período, nas entradas e nas saídas, e tem como
> objetivo o caixa completo (§8.9). Continua certo que as expectativas não movem caixa e não precisam dela.

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

### 4.7 Sinal externo do sistema de saúde

> Decidido em 2026-11-17 (rodada 21), numa investigação de domínio com o dono do produto.
> **Implementados em 2026-11-17:** `REQ-281`–`REQ-292`, na tela "Sistema de saúde", com o registro à mão; a
> leitura automática espera o acesso aos dados. Testes: `acceptance-health-signal.test.ts` (20),
> `receivables-agenda.test.ts`, `access-by-route.test.ts` e `signalForm.test.ts` (tela). Responde em parte à `Q-054`: por enquanto o registro é **à mão**, e o sistema de saúde
> registra os mesmos acontecimentos do seguro, **com o supervisor**. Como os dados ficam acessíveis para a
> leitura automática continua aberto. Em aberto: `Q-057` (parcela zero) e a
> mudança na origem (`REQ-266`, adiada também aqui: o dono do produto acha difícil acontecer).

```
Sistema de saúde               Treasury                                         Ledger
Parcela N da proposta P ─────► SINAL (cópia imutável, nunca vai ao Ledger)
baixada no sistema                │ proposta, parcela, nominal, baixado declarado,
                                  │ corretor, supervisor, taxa; devido (no futuro)
                                  ▼
                               FATOS PROPOSTOS (cada um confirmado à parte)
                                  ├─ comissão prevista da operadora ─────────────► expectativa
                                  ├─ obrigação com o corretor, ou "sem obrigação"─► obrigação (ou nada)
                                  └─ obrigação com o supervisor, ou "sem obrigação"► obrigação (ou nada)
Banco / CFO ─────────────────► Comissão recebida (ligada, em lote ou sem origem) ► caixa
CFO ─────────────────────────► Repasses (unitário ou lote) ──────────────────────► caixa
```

`REQ-281` **O mesmo conceito do seguro.** A saúde entra pelo sinal externo de §4.6, com um contrato
próprio. Valem para ela `REQ-260`, `REQ-261`, `REQ-263`, `REQ-265`, `REQ-267`, `REQ-268`, `REQ-269`,
`REQ-275`, `REQ-277` e `REQ-663`; o que muda está abaixo. O registro à mão e a futura integração
seguem **a mesma regra**, mudando só quem aparece como autor (`REQ-240`, `REQ-278`, `REQ-805`).

`REQ-282` **A unidade é a parcela.** O sinal é o **recebimento comunicado** de uma parcela: o número da
proposta (único), o número da parcela (único dentro da proposta), o valor nominal da parcela, o valor
**baixado** para a Usina, o valor do corretor, o do supervisor, a taxa de tributo e a data da baixa. Tem,
desde já, um campo **opcional** para o que a operadora **deveria** pagar à Usina, que o sistema de saúde
ainda não informa: ausente, o valor é **desconhecido**, nunca zero. O nominal, a taxa e os percentuais
são a base do cálculo e ficam no sinal (`DEC-020`).

> **O baixado é declarado, não recebido.** "Baixado" quer dizer que o sistema de saúde registrou que a
> operadora pagou; o dinheiro ainda precisa ser visto no banco pelo CFO (`REQ-263`, §18.1). Recebido é só
> o que o Ledger registrou como caixa.

`REQ-283` **Os fatos propostos.** Cada sinal propõe a **comissão prevista** da operadora e uma **obrigação
de comissão** com o corretor e outra com o supervisor (`REQ-258`). Todos citam a proposta (contexto
`proposal`) e a parcela (contexto `installment`), e cada um tem a sua referência da origem, por parcela
(ex.: `saude:proposta:<n>:parcela:<k>:prevista`, `…:corretor`, `…:supervisor`). O sinal **nunca** propõe
recebimento nem pagamento (`REQ-262`).

`REQ-284` **Parcelas futuras não são previstas.** Uma parcela só existe quando é comunicada. Parcelamento
limitado, vitalício ou parcela única não muda nada nos fatos: nenhuma parcela é proposta antes de
acontecer (`DEC-013`, "facts over predictions"). A parcela única é o recebimento integral; ainda não foi
vista na saúde.

> **Hoje o Treasury só cita o contexto `contract`** (a apólice). Citar `proposal` e `installment` é mudança
> no Treasury; o Ledger já aceita os dois (Anexo B.3).

`REQ-285` **O valor da expectativa** (decidido em 2026-11-17). Enquanto o sistema de saúde não informar o
devido, a comissão prevista é aberta pelo **baixado declarado**, como no seguro (`REQ-272`), e o banco a
confirma. Quando o devido passar a vir, ele abre a expectativa das parcelas **novas**, e o baixado passa a
ser só comparação. As parcelas anteriores **não são reescritas**. Até lá, a diferença entre o devido e o
declarado fica **desconhecida**, e não é mostrada como zero.

```
Parcela de 100,00 · a Usina deveria receber 30,00 (ainda não informado) · baixado 25,00 · corretor 20,00
  hoje:   prevista 25,00 · obrigação com o corretor 20,00 · devido: desconhecido
  banco:  recebidos 25,00 → a prevista fecha
  futuro: devido 30,00 numa parcela nova → prevista 30,00; baixado 25,00 → "a operadora declarou 5,00 a menos"
```

`REQ-286` **A obrigação nasce na comunicação, se houver** (decidido em 2026-11-17). Como na elegibilidade do
seguro, a obrigação com o corretor e com o supervisor nasce quando a baixa é comunicada, antes de o dinheiro
ser visto no banco. Mas uma parcela pode **não gerar** obrigação, mesmo trazendo corretor e supervisor.
**Quem decide é sempre o usuário**, para cada parte:
- O valor zerado no sinal é **indício**, não decisão: a proposta já vem sugerindo "sem obrigação", e o
  usuário confirma.
- "Sem obrigação" **não é fato** e não vai ao Ledger. É uma decisão do Treasury, **auditada** (`REQ-804`):
  quem decidiu, quando, sobre qual parcela e qual parte. Declarar que **há** obrigação fica auditado do
  mesmo modo, além do fato no Ledger.
- ⚠ CONFIRMAR: mudar de ideia depois de "sem obrigação" é registrar a obrigação à mão (§4.1, nº 16),
  citando a proposta e a parcela; a decisão anterior continua no histórico.

`REQ-287` **A tabela de comissão do corretor** (limitada ou vitalícia, por parcela) é referência do sistema
de saúde para calcular o valor do corretor na baixa. Não entra no Treasury nem no Ledger: o Treasury usa o
valor que o sinal traz, e o usuário confirma (`REQ-257`).

`REQ-288` **Partes.** Operadora, corretor e supervisor são achados pelo id do sistema de saúde, cada um no
seu cadastro (`saude:operadora`, `saude:corretor`, `saude:supervisor`), nunca pelo nome; sem ligação,
identidade provisória (`REQ-267`, `REQ-324`). A operadora entra como quem paga a comissão prevista
(`REQ-273`). O cliente não é parte e os seus dados não são copiados (`REQ-313`). A proposta é
**referenciada, não cadastrada**.

`REQ-289` **A esteira antiga do Ledger é aposentada** (decidido em 2026-11-17). O `ingest:receipt` do Ledger
lê os recibos do sistema de saúde e grava direto no Ledger: transforma "baixado" em entrada de caixa sem
confirmação nem banco, e não gera as obrigações (`LedgerFinancialAudit.md`, CRÍTICO 5 e ALTO 11). Contradiz
`REQ-261` e `REQ-263`, e, ao lado do registro manual, contaria o mesmo dinheiro duas vezes. A saúde passa a
entrar só pelo sinal desta seção.

`REQ-291` **Uma tela por sistema** (decidido em 2026-11-17). Cada sistema externo tem a sua página e o seu
item no menu lateral, com o seu número de propostas à espera: "Sistema de saúde" fica logo abaixo de
"Sistema de seguro". A lista e o número de uma não trazem os sinais da outra. Um sistema novo entra com
outra tela, e o caminho até o Ledger é o mesmo (`REQ-281`). Em cada obrigação ainda à espera, a tela
oferece **"Não há obrigação"**, com uma confirmação antes, e mostra depois quem declarou e quando
(`REQ-286`); para isso é preciso a mesma permissão de enviar. A agenda a receber lista a parcela em
"declarado e ainda não visto no banco" como "Proposta 48213 · parcela 3" (`REQ-663`).

`REQ-292` **Crédito da operadora** (decidido em 2026-11-17). Financeiramente é o mesmo crédito da seguradora
(`REQ-277`): um crédito no banco que cobre várias parcelas, de uma ou de várias propostas, vira **um lote**
(`settlement_batch`), com um recebimento por parcela, cada um citando o lote, a proposta e a parcela
(herdados, `REQ-275`), pelo valor que o usuário distribuiu (`REQ-257`). O que sobra vira **um recebimento sem
origem** citando o lote. Valem as mesmas recusas antes de enviar e o mesmo envio em ordem, que para no
primeiro recusado (`DEC-037`). A única diferença é a etiqueta: em vez de apólices, a tela "Sistema de saúde"
lista as **parcelas em aberto da operadora**, agrupadas por proposta e em ordem de parcela, com um filtro
quando a lista é longa.
- **Todas as parcelas em aberto entram** (decidido em 2026-11-17): em duas semanas, e mais ainda no pico, uma
  operadora pode ter mais de 200 parcelas em aberto. O Treasury lê todas as páginas do Ledger (200 por
  página). A tela desenha até 100 linhas de cada vez e diz quantas existem ("Mostrando 100 de 230"); o filtro
  encontra as outras, e uma linha que já recebeu valor nunca some. Vale também para o crédito da seguradora.

```
Crédito da Unimed de 350,00 em 17/11
  proposta 48213 · parcela 3  25,00 (inteira)    proposta 48213 · parcela 4  20,00 (de 25,00)
  proposta 90001 · parcela 1  300,00             não atribuído 5,00 → recebimento sem origem, citando o lote
  caixa da Usina: +350,00 · ainda a receber na parcela 4: 5,00
```

`REQ-290` **O tributo da nota** (decidido em 2026-11-17, `DEC-046`). A taxa de tributo que o sistema de saúde
mostra na baixa (`registration_fee`) é **base do cálculo** e fica no sinal; ela não gera evento. Quem paga o
tributo e quando varia: a Usina no repasse bancário, na emissão da nota ou num dia determinado, ou o próprio
corretor, que emite a nota e paga. A nota pode sair a cada baixa, por período ou não sair. Por isso:
- A obrigação do imposto é um **fato à parte**, registrado só quando o fato que a estabelece acontece (a nota
  emitida, o imposto apurado), pelo reconhecimento de obrigação, tipo imposto (§4.1, nº 16), com o vencimento.
  Nunca nasce da baixa.
- O valor sugerido ao corretor é o do sinal, como **sinalização**. O usuário define o que a Usina deve e o que
  acontece com isso: repasse, compensação ou outra operação (`REQ-257`). A obrigação, o repasse e o tributo
  têm ciclos de vida próprios, como no seguro.
- O que fica com a Usina por causa da taxa pode ser mostrado como **diferença lida**, com a taxa e a base do
  sinal, nunca como fato (`REQ-264`).

```
Baixado 50,00 · taxa 6% · repasse de 100% menos a taxa
  sinal: corretor 47,00 · o usuário confirma a obrigação de 47,00 com o corretor
  na baixa: nenhum fato de imposto · "fica com a Usina 3,00 (6% de 50,00)" é leitura
  nota emitida no fim do mês → obrigação de imposto, com vencimento → agenda a pagar
```

| ID | Critério | Regra |
| --- | --- | --- |
| `CA-283` | Parcela 3 da proposta P comunicada com baixado 25,00, corretor 20,00 e supervisor 2,00 → três propostas, cada uma citando P e a parcela 3; nenhuma é recebimento | `REQ-283` |
| `CA-283b` | A mesma parcela comunicada de novo com os mesmos valores → as propostas existentes são reaproveitadas; o Ledger recusa a referência repetida | `REQ-283`, `REQ-265` |
| `CA-285` | Sinal sem o devido → prevista pelo baixado; o devido aparece como desconhecido | `REQ-285` |
| `CA-286` | Supervisor com 0,00 no sinal → a proposta sugere "sem obrigação"; o usuário confirma; nada vai ao Ledger e a auditoria registra quem decidiu | `REQ-286` |
| `CA-286b` | Corretor com 20,00 no sinal e o usuário declara "sem obrigação" → aceito e auditado | `REQ-286` |

| ID | Caso que deve ser rejeitado | Regra |
| --- | --- | --- |
| `REJ-282` | Registrar o baixado como recebido, ou tratar o devido ausente como zero | `REQ-282`, `REQ-285` |
| `REJ-284` | Propor a parcela seguinte antes de ela ser comunicada | `REQ-284` |
| `REJ-286` | Decidir "sem obrigação" sozinho pelo valor zerado, sem o usuário | `REQ-286` |

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

`REQ-315` **Partes é uma tela só** (decidido em 2026-11-17). O cadastro de partes e a resolução das
identidades ficam na tela **Partes**, que já é a entrada da página de cada parte (`REQ-630`); a tela
"Cadastro de partes" deixa de existir.
- **Identidades sem resolução** ficam no topo de Partes, para **todos**: ver quem está pendente ajuda a
  cobrar quem cuida da curadoria. Só quem tem curadoria liga ou cadastra (`REQ-311`, `REQ-322`, `REQ-402`);
  quem não tem vê a lista sem as ações. O "Resolver" da notificação (`REQ-321`) leva a essa seção.
- **Cadastrar parte** abre um modal, só para quem tem curadoria. Salvo o cadastro, o modal fecha e a lista
  mostra a parte nova.
- **Cadastrar e ligar**: em cada identidade pendente, o modal abre com o nome dela já preenchido e, ao
  salvar, cadastra a parte e liga a identidade a ela. O modal avisa antes que a ligação não pode ser
  desfeita (`REQ-331`, `DEC-015`). Se a ligação falhar depois do cadastro, a parte continua cadastrada e a
  tela diz o que falta.
- **A lista mostra o que o cadastro diz** de cada parte: tipo, CPF/CNPJ e conta bancária, para todos que
  consultam (`REQ-638`). Antes, o documento só aparecia na tela de cadastro, para a curadoria. O que não foi
  informado aparece como não informado, nunca como "não".

| ID | Critério | Regra |
| --- | --- | --- |
| `CA-315` | Visualizador abre Partes com a Maria pendente → vê a Maria em "Identidades sem resolução", sem "Ligar" nem "Cadastrar e ligar", e sem "Cadastrar parte" | `REQ-315` |
| `CA-315b` | Curador clica "Cadastrar e ligar" na Maria, informa os dados e salva → a parte é cadastrada, a provisória é ligada a ela, o modal fecha e a notificação some | `REQ-315`, `REQ-322` |

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

> Detalhado em 2026-11-18 em §8.11 (`REQ-691`–`REQ-694`): a ação na linha, a seleção com a barra e a
> compensação de um par.

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

### 8.7 Agenda a receber

> Decidida em 2026-11-13 (E4, `TODO-09`). Responde à dor 4 de §18.2: ninguém sabe o que deveria ter
> entrado, o que entrou e o que está atrasado. Segue o molde da agenda a pagar (§8.5). Nenhuma decisão
> nova do dono do produto foi necessária; o que foi escolhido na falta dela está marcado ⚠ CONFIRMAR NO
> PILOTO.

`REQ-660` **O que entra.** Tudo o que **alguém deve à Usina e ainda está em aberto**: comissão prevista,
recebível, empréstimo e adiantamento, com saldo em aberto maior que zero. Uma posição quitada ou retirada não
entra. ⚠ CONFIRMAR NO PILOTO: empréstimo e adiantamento entram por serem "tudo o que se espera receber"
(`TODO-09`), embora costumem voltar por compensação, e não por cobrança.
> **2026-11-18:** confirmado com o CFO que o adiantamento costuma voltar por compensação. Ele continua na
> agenda, e a linha leva à página da parte para compensar (`REQ-696`).

`REQ-661` **As janelas** são as de `REQ-641`, pela **data esperada** (`REQ-229`): vencido, hoje, próximos
dias (7, `Q-055`), depois e **sem data**. Uma posição sem data esperada **nunca é atrasada** (`REQ-271`).
Os totais de cada janela **vêm do Ledger** (`REQ-601`), que publica a agenda como uma leitura dos fatos,
sem mudar nenhum fato nem regra (`DEC-042`, item 1).

`REQ-662` **Por pagador.** O pagador de uma posição são as partes dela **além da Usina**, como o credor em
`REQ-644`. O Ledger publica, por pagador, quantas posições estão em aberto e quanto. Escolhido um pagador,
as janelas, os totais e as linhas passam a ser só dele.
- Uma posição sem nenhuma outra parte fica em **"pagador não informado"**: o pagador nunca é suposto
  (`REQ-273`, `DEC-010`).
- Uma posição com mais de uma outra parte forma um grupo próprio; o valor **não é dividido** entre elas.

`REQ-663` **Declarado pela operadora e ainda não visto no banco** (`REQ-263`). Uma comissão prevista em
aberto cuja apólice teve a elegibilidade lida, e em que o recebido é menor que o valor da Usina declarado
nesse sinal. A agenda marca a linha e mostra essas comissões numa lista à parte, com o que a operadora
declarou, o que foi recebido e o que falta. O sinal é o que o sistema de seguro disse, **nunca** um
recebimento (`REQ-262`).
- A comparação é feita pelo Treasury, porque o sinal nunca vai ao Ledger (`REQ-260`). Por isso a lista
  **não tem total**: o Treasury não soma dinheiro (`REQ-601`). Cada linha traz os seus valores.
- Elegibilidade sem comissão prevista registrada continua na tela do sistema de seguro, com a proposta
  esperando confirmação (`REQ-280`).

`REQ-664` **Recebimentos sem origem.** O dinheiro que entrou sem que se saiba de qual expectativa
(`REQ-277`, o recebimento órfão) aparece em separado, com o total recebido publicado pelo Ledger, do mais
antigo para o mais novo. Não tem saldo em aberto: não é dívida de ninguém (`DEC-032`). Ligá-lo depois à
expectativa depende de `DEC-036` (`TODO-16`); até lá, a lista mostra o que está pendente.

`REQ-665` **Cada linha** mostra o pagador, o que é, o valor em aberto (e o original, quando já foi recebido
em parte), a data esperada ou "aberta há N dias", e a marca de `REQ-663` quando houver. Dela parte o
**recebimento já ligado àquela posição** (`REQ-603`). O visualizador vê tudo, sem a ação (`REQ-401`). Com o
Ledger fora do ar, a agenda diz **"indisponível"** (`REQ-602`).

| ID | Critério | Regra |
| --- | --- | --- |
| `CA-660` | Comissão prevista, empréstimo e adiantamento em aberto aparecem; uma obrigação da Usina não aparece | `REQ-660` |
| `CA-661` | Data esperada ontem → vencido; nenhuma → sem data, nunca vencido | `REQ-661` |
| `CA-661b` | O total de cada janela é o publicado pelo Ledger e é igual à soma dos saldos em aberto das suas posições | `REQ-661` |
| `CA-662` | Allianz com duas comissões previstas e Porto com uma → dois pagadores; escolhida a Allianz, as janelas e as linhas mostram só as duas | `REQ-662` |
| `CA-662b` | Comissão prevista sem pagador → em "pagador não informado" | `REQ-662` |
| `CA-663` | Elegibilidade de 128,77 lida, nada recebido → a linha é marcada e aparece na lista "declarado e não visto" com 128,77 declarado e 0,00 recebido | `REQ-663` |
| `CA-663b` | Recebidos 128,77 → a comissão sai da agenda e da lista | `REQ-663` |
| `CA-664` | Recebimento de 100,00 sem origem → na lista de sem origem, com total 100,00; nenhuma janela muda | `REQ-664` |
| `CA-665` | Com o Ledger fora do ar, a agenda diz "indisponível" | `REQ-665` |

| ID | Caso que deve ser rejeitado | Regra |
| --- | --- | --- |
| `REJ-661` | Tratar uma comissão sem data esperada como atrasada | `REQ-661`, `REQ-271` |
| `REJ-662` | Supor o pagador de uma posição que não o nomeia | `REQ-662` |
| `REJ-663` | Tratar o declarado pela operadora como recebido, ou somá-lo no Treasury | `REQ-663` |

### 8.8 Saldo por instituição e conferência com o banco

> Decidida em 2026-11-16 (E6, `TODO-06` e `TODO-07`), numa conversa de arquitetura com o dono do produto,
> porque muda a álgebra do Ledger (`CLAUDE.md`, "Conflict Resolution"). Responde à dor 2 de §18.2: o CFO não
> sabe quanto há em cada instituição nem se o livro bate com o banco. **Decidido:** saldo de abertura como
> fato (opção A), transferência como um fato só (opção A), a instituição perguntada em todo lançamento de
> caixa, e a `Q-055` seguindo com o valor provisório. Uma conta por instituição.

`REQ-670` **Saldo de abertura.** O livro só conhece o que entrou e saiu desde a virada. Para saber quanto
há em cada instituição, o **saldo final do dia no extrato**, numa data, é registrado como **um fato por
instituição**: o que o extrato mostrava, não um dinheiro que entrou.
- Pode ser **negativo** (conta no cheque especial).
- **Não é entrada nem saída**: fica fora dos totais de entradas e saídas do caixa e do período.
- Fica **uma abertura de pé por instituição**. Um valor errado é corrigido por retificação (§7.3), nunca
  editado; o Treasury recusa uma segunda abertura enquanto a primeira estiver de pé.
- De preferência, a mesma data (a da virada) para todas as instituições.

`REQ-671` **O que a abertura já contém.** Tudo o que movimentou dinheiro numa instituição **até o dia da
sua abertura, inclusive**, já está no saldo de abertura. Um pagamento ou recebimento registrado depois
com data até esse dia entra no histórico e quita a sua posição, mas **não muda o saldo** da instituição:
contá-lo de novo tiraria ou poria o mesmo dinheiro duas vezes. Obrigações e expectativas não mexem em
dinheiro e não são afetadas.

`REQ-672` **Transferência entre instituições** (amplia `REQ-650`). **Um fato só**, com a data, o valor, a
instituição de origem e a de destino, que precisam ser diferentes. O caixa total da Usina não muda: sai
de uma e entra na outra. Transferir para a corretora é transferência; o rendimento depois é `DEC-045`.
Se o débito e o crédito caírem em dias diferentes, a conferência mostra a diferença de um dia, que se
resolve sozinha.

`REQ-673` **Saldo por instituição.** O Ledger publica, para uma data (fim do dia em São Paulo), o saldo
de cada instituição: abertura + entradas − saídas + transferências recebidas − transferências enviadas,
contando só o que veio **depois** da abertura (`REQ-671`). Também publica o que compõe cada saldo.
- Uma instituição **sem abertura** tem saldo **desconhecido**, nunca zero; os movimentos dela ficam à
  vista.
- O **total conhecido** soma só as instituições com abertura, e diz quais são.
- O dinheiro que entrou ou saiu **sem instituição** depois da primeira abertura aparece à parte, como
  "instituição desconhecida", **nunca distribuído** entre as instituições nem somado ao total conhecido
  (`REQ-650`).

`REQ-674` **A instituição em todo lançamento de caixa** (amplia `REQ-650`). Todo lançamento que move
dinheiro pergunta de que instituição o dinheiro saiu ou em qual entrou: a conversa, o pagamento a partir
da posição, o lote (`REQ-653`) e o crédito da seguradora (`REQ-277`). **"Não informada" é uma resposta
explícita**; a instituição nunca é preenchida por suposição.

`REQ-675` **Conferência com o banco** (`TODO-07`). Para cada instituição, o CFO informa **o saldo do
extrato numa data**. O Treasury mostra o saldo do livro na mesma data, publicado pelo Ledger (`REQ-673`),
e a diferença entre os dois. A diferença fica à vista até uma conferência mais nova bater.
- O saldo informado é um **controle do Treasury**, auditado e guardado com quem informou e quando,
  **nunca um fato do Ledger**.
- Sem abertura, não há saldo do livro para comparar: a conferência diz isso, sem diferença inventada.
- Por enquanto, o saldo é informado à mão, quando o CFO quiser (`Q-055`, valor provisório). A importação
  de extrato e a conciliação linha a linha seguem em PRI-2 (`TODO-21`).
- **É o alarme, não a conciliação** (§8.9): saldos iguais dizem que nada falta naquele dia; uma diferença diz
  que algo falta, mas não o quê. Explicá-la pede as linhas do extrato.

> **Como ficou no Ledger.** A abertura é um fato `opening_balance`: entrada para saldo positivo e saída para
> cheque especial (o sinal vai no efeito, como a direção da perna da Usina), citando uma instituição e
> nenhuma posição. A transferência é `institution_transfer`, movimento interno equilibrado, citando a origem
> com a relação `transfers_from` e o destino com `transfers_to`. Como os dois não movem posição, a
> retificação deles nomeia a instituição (`retracts` sobre `cash_account`); o Ledger só aceita isso quando o
> fato retirado é uma abertura ou uma transferência. O caixa consolidado que já existia deixa as aberturas de
> fora.

`REQ-676` **As instituições são configuração.** A lista fica em `CASH_INSTITUTIONS`, no formato
`chave=Nome`. Acrescentar uma instituição é acrescentar um par e reiniciar. O nome pode mudar; **a chave
não**, depois de usada, porque fica gravada nos fatos.

| ID | Critério | Regra |
| --- | --- | --- |
| `CA-670` | Abertura do Itaú de 10.000,00 em 30/11 → saldo do Itaú em 30/11 é 10.000,00; as entradas e saídas do caixa não mudam | `REQ-670`, `REQ-673` |
| `CA-670b` | Abertura do Bradesco de −1.200,00 (cheque especial) → saldo −1.200,00 | `REQ-670` |
| `CA-670c` | Segunda abertura do Itaú com a primeira de pé → recusada | `REQ-670` |
| `CA-671` | Pagamento de 500,00 no Itaú com data 28/11, registrado em 05/12 → o saldo do Itaú não muda; um de 01/12 → cai 500,00 | `REQ-671` |
| `CA-672` | Transferência de 3.000,00 do Bradesco para a corretora → Bradesco −3.000,00, corretora +3.000,00, caixa total igual | `REQ-672` |
| `CA-672b` | Transferência com origem igual ao destino, ou sem uma das duas → recusada | `REQ-672` |
| `CA-673` | Corretora sem abertura → saldo desconhecido, movimentos à vista; o total conhecido soma só Bradesco e Itaú | `REQ-673` |
| `CA-673b` | Recebimento sem instituição depois da virada → em "instituição desconhecida", fora de toda instituição e do total conhecido | `REQ-673` |
| `CA-674` | Recebimento pela conversa → a conversa pergunta a instituição; "não informada" é aceita e registrada sem instituição | `REQ-674` |
| `CA-675` | Extrato do Itaú de 9.800,00 em 05/12 e livro de 9.500,00 → diferença de 300,00 à vista | `REQ-675` |

| ID | Caso que deve ser rejeitado | Regra |
| --- | --- | --- |
| `REJ-670` | Tratar o saldo de abertura como entrada de dinheiro | `REQ-670` |
| `REJ-671` | Contar no saldo um movimento com data até o dia da abertura | `REQ-671` |
| `REJ-673` | Mostrar zero para uma instituição sem abertura, ou distribuir o desconhecido | `REQ-673` |
| `REJ-675` | Gravar no Ledger o saldo informado pelo CFO | `REQ-675` |

### 8.9 Conciliação bancária: o conceito

> Registrado em 2026-11-16, numa conversa com o dono do produto. **É o conceito, não o desenho:** como
> conciliar no Treasury ainda é `DEC-018`, e a prioridade do `TODO-21` está em revisão. Nada aqui é
> implementado nem muda regra em vigor; as regras que tratavam a conciliação como opcional estão marcadas
> "a rever" (`REQ-247`, `REQ-269`, §18.3).

**O que é.** Conciliar é comparar, **linha a linha**, dois registros independentes do mesmo dinheiro: o
extrato da instituição (o que o banco diz) e o livro (o que a Usina registrou), **por conta e por período**.
O extrato é a evidência externa de onde o dinheiro está; o livro é o conhecimento da Usina. O objetivo é que
**todo movimento do banco tenha um fato no livro** e que cada diferença tenha um motivo conhecido.

| Situação | Exemplo | O que se faz |
| --- | --- | --- |
| A linha do banco corresponde a fatos do livro | PIX de 500,00 à Acme ↔ pagamento à Acme; um débito ↔ os fatos de um lote (`REQ-653`) | Fica conciliada |
| Linha no banco, sem fato no livro | Tarifa, rendimento, juros do cheque especial, depósito não identificado | Registra-se o fato que faltava, pelo caminho de sempre (fato proposto, confirmado) |
| Fato no livro, sem linha no banco | TED enviado no fim do dia, que o banco mostra no dia seguinte | Fica em trânsito; se nunca aparecer, era erro e se retifica (§7.3) |
| Valores diferentes | Livro 1.200,00, banco 1.020,00 | Erro de digitação: retifica-se |

O resultado é um demonstrativo — saldo do banco − em trânsito ± pendências = saldo do livro — e a afirmação
"a conta X está conciliada até o dia D".

**O livro nunca copia o banco.** Ele é corrigido por **fatos novos** (a tarifa, o rendimento) ou por
retificação, nunca por um saldo trazido do extrato (`REQ-675`). A conferência por saldo (`TODO-07`) é o
alarme de que algo falta; não é a conciliação.

**Caixa completo não é o mesmo que origem conhecida.** A conciliação garante que **todo dinheiro que passou
pelo banco tem um fato** no livro. Ela não exige saber **por que** o dinheiro entrou: um depósito de origem
desconhecida é conciliado registrando "entrada na instituição, origem desconhecida", e a lacuna fica
explícita até um fato a preencher (`DEC-036`). Inventar uma origem para "explicar" violaria os princípios do
Ledger (`CLAUDE.md`, "Unknown is a valid state"). Para quem consome o Ledger, a garantia é: nenhum movimento
ausente e nenhuma lacuna escondida.

**Quem faz o quê.**
- **Ledger:** os fatos (inclusive os que a conciliação descobrir), o saldo e a **composição** por instituição
  (`REQ-673`), as lacunas marcadas. A álgebra não muda para conciliar.
- **Treasury:** as linhas do extrato como evidência externa, no mesmo conceito do sinal externo (§4.6,
  `REQ-260`); o casamento entre linhas e fatos; o estado da conciliação, que muda com o tempo e por isso não
  é fato.
- **Em aberto:** se os sistemas que consumirem o Ledger precisarem saber que um fato foi confirmado pelo
  banco, ou até quando uma conta está conciliada, isso pede uma conversa de arquitetura própria. Não está
  decidido e não deve ser suposto.

**O que já existe e serve a ela:** a instituição em cada fato de caixa (`REQ-650`, `REQ-674`), o saldo de
abertura (`REQ-670`), a transferência (`REQ-672`), o saldo por instituição e por dia (`REQ-673`), o lote
com débito conferido (`REQ-653`, `REQ-277`), o recebimento sem origem e a conferência por saldo
(`REQ-675`). **O que falta:** ver os fatos que compõem o saldo de uma instituição, as linhas do extrato e o
casamento (`DEC-018`, `TODO-21`).

---


### 8.10 Painel da manhã: o caixa cobre o que vence?

> Decidido em 2026-11-17 (E7, `TODO-12`). Responde à pergunta diária do CFO, "posso pagar hoje?" (§18.3,
> itens 1 a 4). O dono do produto escolheu o lugar: **o topo do Painel**, que é o que o CFO abre de manhã.

`REQ-680` **Onde e quando.** Um quadro no topo do Painel, **sempre lido para hoje** (fim do dia em São
Paulo, `REQ-225`), independente do período escolhido para as entradas e saídas abaixo dele. Cada parte
leva à tela de detalhe: Caixa por instituição, Agenda a pagar, Agenda a receber.

`REQ-681` **O caixa conhecido.** O saldo de cada instituição e o total conhecido, como o Ledger publica
(`REQ-673`).
- Uma instituição **sem abertura** aparece como **desconhecida**, e o quadro diz que o total não a inclui.
- O dinheiro **sem instituição** aparece à parte, **nunca somado** ao total (`REQ-650`).

`REQ-682` **O que vence.** O que a Usina deve, nas colunas **vencido**, **hoje** e **cada um dos próximos
dias** da janela (7 dias, `Q-055`), com o total de cada coluna **publicado pelo Ledger** (`REQ-642`). O
que não tem vencimento aparece à parte, com a quantidade e o total, e nunca cai em dia nenhum (`REQ-641`).

`REQ-683` **O que se espera receber**, nas mesmas colunas, à parte, pelas datas esperadas (`REQ-661`). É
uma leitura de expectativas: **nunca é somado ao caixa** nem descontado do que vence (`TODO-12`). O que a
operadora declarou ter pago e o banco não mostrou continua sendo expectativa (`REQ-663`).

`REQ-684` **Sem veredito.** O quadro põe os números **lado a lado**; não calcula "sobra" nem "falta".
- O Treasury não soma dinheiro (`REQ-601`).
- O total conhecido pode estar incompleto (instituição sem abertura, dinheiro sem instituição), e um
  veredito diria mais do que o livro sabe (`CLAUDE.md`, "Derivations must not assume completeness").
- ⚠ CONFIRMAR NO PILOTO: se o CFO precisar do veredito, ele vem do Ledger, como leitura, dizendo
  "incompleto" sempre que o caixa não for todo conhecido.

`REQ-685` Com o Ledger fora do ar, o quadro diz **"indisponível"**, nunca zero (`REQ-602`).

> **Como fica no Ledger.** As duas agendas passam a publicar também o total de **cada dia**, de hoje até o
> fim da janela, além das cinco janelas. É uma leitura a mais sobre os mesmos fatos; nenhum fato nem regra
> muda (`DEC-042`, item 1).

| ID | Critério | Regra |
| --- | --- | --- |
| `CA-680` | O CFO muda o período do Painel para outubro → o quadro continua mostrando hoje | `REQ-680` |
| `CA-681` | Bradesco 295.600,51, Itaú 257.705,77 e corretora sem abertura → total conhecido 553.306,28, com a corretora como desconhecida e fora do total | `REQ-681` |
| `CA-682` | Contas de 100,00 vencendo amanhã e 50,00 em três dias → colunas dos dois dias com esses totais, publicados pelo Ledger; uma conta sem vencimento só aparece à parte | `REQ-682` |
| `CA-683` | Comissão prevista para amanhã → aparece na linha "a receber" de amanhã, e o caixa conhecido não muda | `REQ-683` |
| `CA-684` | Nenhum número do quadro é sobra, falta ou soma feita pelo Treasury | `REQ-684` |
| `CA-685` | Com o Ledger fora do ar → "indisponível" | `REQ-685` |

| ID | Caso que deve ser rejeitado | Regra |
| --- | --- | --- |
| `REJ-683` | Somar ao caixa o que se espera receber | `REQ-683` |
| `REJ-684` | Mostrar "sobra" ou "falta" com o caixa incompleto | `REQ-684` |
### 8.11 Ações onde a pergunta acontece

> Decidido em 2026-11-18 (rodada 22), numa conversa de produto e UX com o dono do produto. **Nada está
> implementado.** Princípio: **experiência antes de interface**. Cada tela responde a uma pergunta (agenda a
> pagar: "o que pago hoje?"; agenda a receber: "o que deveria ter entrado?"; página da parte: "como está a
> relação com essa parte, e o que resolvo com ela?"), e a ação oferecida é a que dá sequência a essa pergunta.
> Nenhuma ação é escondida por ser improvável (`ListPositionActions`): a provável vem primeiro.
>
> **Estado em 2026-11-18 (código):** as ações a partir de uma posição existem no detalhe da linha
> (`RowDetailModal`) de Posições, Movimentos e das duas agendas, e abrem a conversa na página Operações, de onde
> **não há volta**. A Operação da página da parte não oferece ação, seleção nem lote. O Ledger aceita a
> compensação (`REQ-250`); o Treasury não tem o cenário.
>
> **O caso real** (confirmado com o CFO): o corretor pede um adiantamento dizendo ter vendido propostas e
> apólices que ainda não entraram no financeiro. A Usina libera o valor, que fica aberto e é abatido nos
> repasses seguintes, no todo ou em parte, às vezes ao longo de vários. É frequente.

`REQ-690` **A volta.** Uma conversa aberta a partir de uma tela (agenda a pagar, agenda a receber, Posições,
página da parte) oferece, ao terminar, **voltar a essa tela**, no mesmo estado (janela, filtros, página) e com
os números relidos. Terminar inclui enviar, ser recusado e desistir.

`REQ-691` **Ação na linha da Operação** (refina `REQ-637`, item A1 de §16.1). Cada linha da Operação abre o
mesmo detalhe de posição das agendas, com as ações da posição (`REQ-603`), por um botão com o nome do mais
provável: **Pagar** no que a Usina deve, **Receber** no que a parte deve e **Ver** no resto. O botão só nomeia;
o detalhe oferece todas as ações, sem esconder nenhuma. Os alertas que citam uma posição (`REQ-634`) **abrem
o detalhe dela**. O visualizador vê o detalhe, sem ações (`REQ-638`).

> **Refinado na implementação (2026-11-18):** o plano dizia que o alerta "leva à linha". A linha pode estar em
> outra página da seção (20 ou 50 por página), então o alerta abre a posição direto. O detalhe é lido do Ledger
> quando abre, e mostra o livro como está agora, não como estava quando a lista foi carregada.

`REQ-692` **A seleção diz o que é possível.** Na Operação, quem pode registrar marca posições dos dois lados. Uma
barra oferece **só o que a combinação permite** e, para o resto, diz o motivo, no molde da caixa de seleção da
agenda a pagar (`REQ-651`):

| Selecionado | Oferecido |
| --- | --- |
| Só posições que a Usina deve à parte | Pagar ou preparar o lote da parte (`REQ-239`) |
| Exatamente um adiantamento ou empréstimo **e** uma obrigação de comissão | Compensar, até o menor saldo aberto (`REQ-693`) |
| Outra combinação | Nada, com o motivo ("a compensação precisa de um item de cada lado", "só adiantamento ou empréstimo contra obrigação de comissão", "um par por compensação") |

A barra **não mostra saldo líquido** (`REQ-632`): mostra o que a ação faria, que é uma escolha do usuário.

`REQ-693` **Compensação no Treasury** (passo 7, `REQ-250`–`REQ-252`). Nasce na Operação da parte, pela seleção.
**Um par por evento:** uma posição a receber (adiantamento ou empréstimo) e uma a pagar (obrigação de comissão),
da mesma parte, inclusive identidades ligadas (`REQ-332`). O usuário define o valor (`REQ-257`), até o menor
saldo aberto do par, com esse máximo à vista; informa a data e, se quiser, uma descrição. **Não há pergunta de
instituição**: nenhum dinheiro se move (`REQ-650`). Antes de confirmar, a tela mostra a consequência em cada
posição e que o caixa não muda. Confirmado, vira **um evento** (`compensation`), que cita os contextos da
obrigação (`REQ-275`), e o usuário **continua na página**, com as duas linhas relidas.

> **Por que um par** (decidido em 2026-11-18): a regra do Ledger exige **ao menos** um item de cada lado, e cada
> posição citada desce pelo valor do evento. Dois adiantamentos e uma obrigação numa compensação de 50,00 baixariam
> 100,00 de um lado e 50,00 do outro: válido para o Ledger e não é uma compensação. O Ledger fica como está; a
> realidade ainda é pouco conhecida, e o Treasury trabalha com o que se sabe.

```
Operação do Halisson: adiantamento 500,00 e repasse da apólice A 300,00 marcados
  barra: "Compensar · até 300,00"
  adiantamento 500,00 → 200,00 · repasse A 300,00 → 0,00 · caixa: não muda
```

`REQ-694` **O rastro do adiantamento.** O adiantamento é recuperado por uma ou várias compensações, no todo ou
em parte, e também pode voltar em dinheiro (recuperação de adiantamento). O ciclo de vida do adiantamento mostra
**cada compensação**, com o valor, a obrigação abatida e a apólice ou proposta dela, ao lado do que o corretor
declarou ao pedir (`REQ-293`). O Ledger já põe a compensação no ciclo das duas posições; a tela do Treasury
ainda não tem a frase desse tipo de evento.

```
Adiantamento do Halisson · 500,00
  declarado ao pedir: apólices X, Y e Z; Abc12 parcelas 1 e 2; Dcba parcela 3
  18/11  compensado 300,00 · repasse da apólice X            aberto: 200,00
  05/12  compensado 200,00 · repasse da apólice W            aberto:   0,00 · quitado
```

`REQ-695` **Crédito por pagador na agenda a receber.** Escolhido um pagador (`REQ-662`), a agenda oferece
registrar o crédito dele ali mesmo, pelo mesmo registro do crédito da seguradora ou da operadora (`REQ-277`,
`REQ-292`), já com o pagador escolhido. O dinheiro de quem paga à Usina chega agregado; o pagador é a unidade
natural da ação.

> **Refinado na implementação (2026-11-18):** o crédito é oferecido só quando o pagador escolhido tem **comissão
> prevista em aberto**, porque o crédito se distribui entre comissões. Para uma parte que só deve um adiantamento
> (um corretor), o dinheiro que volta é o recebimento daquele adiantamento, pela linha; oferecer o crédito ali
> registraria uma "comissão recebida sem origem", que seria um fato falso. Um grupo sem pagador ou de várias
> partes também não ganha o crédito. Como o pagador pode ser seguradora ou operadora de saúde, o cartão fala o
> nome dele ("Registrar crédito de Allianz"), não o tipo.

`REQ-696` **O adiantamento na agenda a receber leva à compensação.** Na linha de um adiantamento ou empréstimo, a
ação principal é **compensar na página da parte**, que abre a Operação dela; receber em dinheiro continua
oferecido. Responde ao `⚠ CONFIRMAR` de `REQ-660`.

`REQ-697` **Descontar no pagamento** (⚠ CONFIRMAR com o CFO, `Q-058`). Ao pagar uma obrigação de comissão de uma
parte que tem adiantamento ou empréstimo em aberto, a prévia avisa ("o Halisson deve 200,00 à Usina") e oferece
descontar. Aceito, é uma operação composta (`REQ-255`), enviada em ordem: a compensação e depois o pagamento do
restante. O que fazer se a compensação for aceita e o pagamento recusado é `DEC-024`. Não começa antes da
`Q-058`.

```
Repasse B 400,00 ao Halisson, que deve 200,00
  1. compensação de 200,00 (adiantamento → 0,00; repasse B → 200,00)
  2. pagamento de 200,00 (repasse B → 0,00; caixa −200,00, no Itaú)
```

| ID | Critério | Regra |
| --- | --- | --- |
| `CA-690` | Na agenda a pagar, janela "próximos dias", o usuário paga uma linha pela conversa → ao terminar, volta à agenda na mesma janela, e a linha paga não aparece | `REQ-690` |
| `CA-691` | Na Operação do Halisson, o botão "Pagar" da linha do repasse abre o detalhe com "Pagar repasse de comissão"; o alerta "obrigação vencida" abre a posição que cita, mesmo fora da página carregada | `REQ-691` |
| `CA-692` | Marcados dois repasses → a barra oferece pagar ou preparar o lote; marcados um adiantamento e um repasse → oferece compensar; marcados dois adiantamentos e um repasse → nada, com o motivo | `REQ-692`, `REQ-693` |
| `CA-693` | Adiantamento 500,00 e repasse 300,00, compensação de 300,00 → um evento; adiantamento 200,00 em aberto, repasse 0,00, caixa igual; o usuário continua na página | `REQ-693` |
| `CA-693b` | Compensação de 350,00 no mesmo par → recusada antes do envio, com o máximo 300,00 à vista | `REQ-693` |
| `CA-694` | Duas compensações (300,00 e 200,00) com obrigações de apólices diferentes → o ciclo do adiantamento mostra as duas, cada uma com a sua apólice, e o adiantamento quitado | `REQ-694` |
| `CA-695` | Agenda a receber filtrada pela Allianz, que tem comissão prevista em aberto → "Registrar crédito de Allianz" com a Allianz já escolhida; filtrada pelo João, que só deve um adiantamento → sem o crédito | `REQ-695` |
| `CA-696` | Linha de adiantamento na agenda a receber → a ação principal leva à Operação da parte; "Receber" continua disponível | `REQ-696` |
| `CA-293` | Adiantamento registrado com a descrição do que foi declarado → o evento não cita apólice nem proposta como contexto | `REQ-293` |

| ID | Caso que deve ser rejeitado | Regra |
| --- | --- | --- |
| `REJ-692` | A barra ou a Operação mostrar o saldo líquido da parte | `REQ-692`, `REQ-632` |
| `REJ-693` | O Treasury oferecer uma compensação com mais de uma posição de um lado, entre partes diferentes ou com instituição | `REQ-693` |
| `REJ-293` | Citar as apólices e propostas declaradas pelo corretor como contexto do adiantamento | `REQ-293` |

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
| **Sem obrigação** | Só numa obrigação proposta por um sinal: o usuário declarou que ela não existe; nada foi ao Ledger (`REQ-286`) | **Nada** |

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
| Coletando, Pronta para envio ou Aguardando correção | Sem obrigação | O usuário declara "não há obrigação" numa obrigação proposta por um sinal (`REQ-286`); auditado |

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
| `DEC-018` | **Conciliação bancária**: ligar cada linha do extrato a um evento (veio de `Q-045`). Conceito em §8.9 (2026-11-16). Precisa responder: (1) de onde vêm as linhas (importação ou digitação, por instituição; depende de `Q-055`); (2) uma linha pode casar com vários fatos, e um fato com várias linhas?; (3) quem confirma um casamento, e se há casamento automático; (4) como uma linha sem fato vira fato proposto (como o sinal externo, §4.6); (5) o que fica em trânsito e por quanto tempo; (6) o que significa "conta conciliada até D" e onde isso aparece | Não há conciliação; o extrato é só anexo opcional (`REQ-247`) |
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
| `DEC-046` | ~~Tributo da nota na baixa da saúde~~ — **decidida em 2026-11-17**: `REQ-290`. Registro do que levou à decisão: (aberta em 2026-11-17). A operadora paga 50,00 à Usina; a Usina repassa o recebido, menos um tributo de X% conhecido na baixa (com 6%, 6,00 ficam e 94,00 são repassados), porque é ela quem emite a nota fiscal. A taxa é o `registration_fee` do sistema de saúde. **Achado nos dados** (dump de 2026-02-27, ≈44.600 baixas com valor do corretor): o valor do corretor é o baixado × o percentual da tabela, **sem** o desconto da taxa, e a taxa fica dentro do que sobra para a Usina. Falta saber: (1) de quem é o tributo, da Usina sobre a própria receita ou retido em nome do corretor; (2) se a nota é emitida por baixa ou por período; (3) quando o repasse é de 100%, se o valor do corretor já vem líquido da taxa. **Recomendação:** a obrigação com o corretor é o valor que o usuário confirma; o que fica para o tributo é uma **diferença lida**, como o valor retido (`REQ-264`), e não um evento; a obrigação do imposto nasce do fato que a estabelece (a nota emitida ou o imposto apurado), pelo reconhecimento de obrigação, tipo imposto (§4.1, nº 16) | Vale `REQ-290` |
| `DEC-036` | **Enriquecer a origem depois**: ligar um recebimento sem origem (ou outro fato isolado) à comissão prevista quando se descobre de onde veio, **sem reescrever o fato** ("a linhagem é progressiva", `CLAUDE.md`). Não existe hoje no Ledger nem no Treasury. Ideia do dono do produto: usar isso para olhar o passado a partir do saldo no banco (Bradesco, Itaú, corretora de investimentos), perguntando "de onde veio cada valor?", e construir a verdade financeira enquanto se concilia, independente do banco. Relaciona-se com `DEC-018` | O recebimento sem origem fica pendente e visível; não há como ligá-lo depois |
| `DEC-044` | ~~**Instituição no fato de caixa**~~ **Decidida em 2026-11-13:** o fato de caixa cita a instituição como contexto (`cash_account`), no máximo uma, nunca num evento sem dinheiro; sem ela, "instituição desconhecida"; os eventos anteriores ficam desconhecidos, nunca distribuídos. Alternativas descartadas: um campo novo no evento (muda o molde, o hash e o banco para o mesmo resultado), guardar só no Treasury (a instituição não seria fato do Ledger) e adiar (os pagamentos do piloto ficariam sem instituição para sempre). A transferência entre instituições fica para o E6. Ver `REQ-650` | O Ledger aceita a instituição no fato de caixa; o saldo por instituição (`TODO-06`) ainda não existe |
| `DEC-045` | **Provisões do CFO** (aberta em 2026-11-13). O CFO aloca dinheiro na corretora de investimentos para usar depois em eventos, e controla isso hoje em planilha. **Confirmado:** ele precisa de uma ferramenta para isso. **Hipótese, não confirmada:** são investimentos pós-fixados que rendem enquanto o dinheiro não é necessário. Entender com o CFO antes de modelar. **Não confundir** com a provisão de pagamento futuro da `DEC-013` | Continua na planilha do CFO (`TODO-15`) |
| `DEC-047` | **O declarado do adiantamento em forma estruturada** (aberta em 2026-11-18): guardar no Treasury, como os sinais, e nunca no Ledger, a lista do que o corretor declarou (tipo, número, parcela), para sugerir a compensação quando aparecer a obrigação de um item declarado ("apareceu a obrigação da apólice X; o adiantamento do Halisson citava X; compensar?"). Custa o cadastro estruturado e o casamento com os números do seguro e da saúde. Encosta na `Q-053` (o pedido de adiantamento) e no `TODO-19`. O piloto diz se o texto livre basta | Vale `REQ-293`: o declarado é texto livre na descrição |

### 15.2 Perguntas abertas

Abertas na rodada 13 (2026-11-07), e `Q-052` na rodada 14 (2026-11-09). A recomendação é só uma proposta; nenhuma foi aceita.

| ID | Pergunta | Recomendação | Enquanto não for respondida |
| --- | --- | --- | --- |
| `Q-048` | ~~Como registrar um pagamento a mais de verdade?~~ — **respondida em 2026-11-12**: prevenção pela divisão na prévia (`REQ-635`); a correção do que já foi registrado sem vínculo foi para `DEC-033` | — | Vale `REQ-635` |
| `Q-050` | No sistema de seguro, uma mesma apólice e proposta aparecem com dois ids, uma elegível e outra sem CR. É erro de cadastro ou é esperado? | Conferir no sistema de origem; de todo modo, ligar sempre pelo id da apólice | Nada depende disso ainda |
| `Q-051` | Como tratar identificadores lá escritos de formas diferentes (produto `Auto` e `auto`) e a seguradora sem nome? | Normalizar só para comparar e guardar como veio no sinal (`REQ-260`); seguradora sem nome vira identidade provisória (`REQ-267`) | Nada depende disso ainda |
| `Q-052` | Na comissão parcelada, a elegibilidade chega **por parcela** ou uma vez por apólice? | Se for por parcela, a referência da origem inclui a parcela (`REQ-265`) e cada elegibilidade abre a sua obrigação | Uma elegibilidade por apólice |
| `Q-053` | **Solicitações de adiantamento e acordos ainda não pagos**, que os verificadores acompanham: o que são, quem aprova e em que momento viram compromisso da Usina? (aberta em 2026-11-13) | Até virar compromisso, mostrar como pendência do Treasury, que não é fato nem vai ao Ledger. Depois, como obrigação reconhecida | `TODO-19` não começa |
| `Q-054` | **Sistema de saúde:** como os dados ficam acessíveis (API, arquivo, tela) e se ele registra os mesmos acontecimentos do seguro (pagamento declarado pela operadora, parcela ou total, parte da Usina e parte do corretor)? (aberta em 2026-11-13) **Em parte respondida em 2026-11-17:** registra os mesmos acontecimentos, por parcela, com o supervisor; o registro começa à mão (§4.7). Falta só o acesso para a leitura automática | Usar o mesmo conceito de sinal externo (§4.6), com um contrato próprio para a saúde | O registro manual de §4.7 pode começar; a leitura automática do `TODO-11` espera o acesso |
| `Q-057` | **Parcela zero** no sistema de saúde: existe nos dados, mas não se sabe se já aconteceu de verdade nem o que significa (aberta em 2026-11-17) | Investigar no sistema de saúde antes de modelar | Uma parcela zero não é proposta; o usuário registra à mão se precisar |
| `Q-055` | **Conferência com o banco:** em cada instituição, com que frequência o CFO confere e de onde vem o saldo (extrato, aplicativo, relatório da corretora)? E até quantos dias à frente ele precisa ver o que vence? (aberta em 2026-11-13) **Acrescentado em 2026-11-16, para a conciliação (§8.9):** em que formato cada instituição entrega o extrato (OFX, CNAB, PDF, planilha, aplicativo, API, Open Finance)? Com que frequência o CFO concilia hoje, e como? Como a corretora informa rendimento e movimentação? | Começar pelo saldo informado à mão, uma vez por dia, e uma janela de 7 dias, a ajustar no piloto | `TODO-05` e `TODO-07` seguem com esses valores provisórios |
| `Q-056` | **Piloto:** por quantas semanas a equipe usa a primeira versão em paralelo à planilha, e quem decide que ela foi aprovada? (aberta em 2026-11-13) | O CFO decide; aprovada quando ele decide o que pagar no dia pelo Treasury, sem a planilha | `TODO-13` sem data |
| `Q-058` | **Desconto do adiantamento no pagamento** (aberta em 2026-11-18): ao pagar um repasse a um corretor com adiantamento aberto, o CFO desconta o adiantamento e transfere o restante, no todo ou em parte, às vezes ao longo de vários repasses? O dono do produto disse que sim, mas quer ter certeza | Confirmar com o CFO, com um caso real | `REQ-697` não começa; a compensação avulsa (`REQ-693`) cobre o caso |

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
| A1 | **Ações em cada linha da Operação**: pagar ligado à obrigação, receber ligado à comissão prevista, recuperar o adiantamento, retificar; o visualizador vê sem ações | `REQ-637`, `REQ-603`, `REQ-638` | As ações já existem a partir da posição (`ListPositionActions`); falta oferecê-las na linha. **2026-11-18:** detalhado em `REQ-691` e movido para o `TODO-25` (PRI-1) |
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

> **A rever (2026-11-16):** a conciliação linha a linha e a importação de extrato estão nesta lista, mas o
> objetivo de caixa completo para quem consome o Ledger (§8.9) pode trazê-las para antes ou logo depois do
> piloto. Decisão do dono do produto, depois da `Q-055`.

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
| **E4** | **Agenda a receber**, com o declarado pela operadora e ainda não visto no banco | CFO e verificadores. Saber o que cobrar (dor 4) | 09 | Nada; `DEC-036` melhora a precisão e pode esperar o piloto | ✅ Feito em 2026-11-13 |
| **E5** | **Sinais entrando sozinhos:** seguro em operação real e saúde | Verificadores. Obrigações e expectativas sem digitação | 10, 11 | Seguro: nada. Saúde: `Q-054`, que é falta de informação, não decisão | Seguro sim; saúde: o registro à mão está feito (§4.7, 2026-11-17), a leitura automática não |
| **E6** | **Saldo por instituição e conferência com o banco** | CFO. O livro passa a bater com o banco (dor 2) | 06, 07 | `Q-055`, e como entra a transferência entre instituições (`REQ-650`). A `DEC-044` foi decidida | ✅ Feito em 2026-11-16 |
| **E7** | **Painel da manhã: o caixa cobre o que vence?** | CFO. A pergunta diária "posso pagar hoje?" | 12 | Nada: o saldo por instituição existe desde o E6 (2026-11-16) | ✅ Feito em 2026-11-17 |
| **E8** | **Piloto com a equipe** | Os cinco. Confirma se a versão serve e reordena o resto | 13 | `Q-056`, só quando o piloto começar | Depois de E1–E4 |

**Até quando cada decisão pode esperar**

| Decisão | Pode ficar aberta até |
| --- | --- |
| `DEC-044` | ~~Decidida em 2026-11-13~~: §8.6, `REQ-650`. Antes: **o primeiro pagamento real registrado no piloto.** Um fato é imutável: o que for registrado sem instituição fica "instituição desconhecida" para sempre, a menos que se crie um meio de completar isso depois. Não bloqueia construir o E3; bloqueia usá-lo de verdade. Discutir em paralelo ao E2 |
| `Q-054` | O E5 da saúde. Enquanto isso, a saúde é registrada à mão |
| `Q-055` | O piloto. O E6 foi feito com o valor provisório (saldo informado à mão, quando o CFO quiser); a resposta muda só lembretes e alertas |
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
*Nota (2026-11-16):* a conferência por saldo é o alarme de que algo falta; não substitui a conciliação
(§8.9).
*Depende de:* `TODO-06`; a forma e a frequência de cada instituição, de `Q-055`.
*Situação (`TODO-06` e `TODO-07`):* ✅ 2026-11-16, sem commit; as regras estão em §8.8 (`REQ-670`–`REQ-676`),
decididas numa conversa de arquitetura com o dono do produto. **No Ledger:** dois fatos novos, o saldo de
abertura (`opening_balance`, entrada para saldo positivo e saída para cheque especial, citando uma
instituição e nenhuma posição, fora de todo total de entradas e saídas) e a transferência entre
instituições (`institution_transfer`, movimento interno citando a origem com `transfers_from` e o destino
com `transfers_to`); a retificação dos dois nomeia a instituição, porque não moveram posição; e a leitura
`GET /api/cash-position/institutions?asOf=`, com o saldo de cada instituição, o total conhecido e o
desconhecido. **No Treasury:** a pergunta "de qual instituição" em todas as 13 conversas que movem
dinheiro, no lote, no crédito da seguradora e na reemissão de uma retificação; a tela "Caixa por
instituição" com o saldo, a abertura, a transferência e a conferência (o saldo do extrato, gravado no
SQLite das operações, nunca no Ledger); a lista de instituições segue `CASH_INSTITUTIONS`. **Não feito:**
a importação de extrato e a conciliação linha a linha (`TODO-21`); o rendimento da corretora (`DEC-045`);
lembretes de conferência (`Q-055`). Testes: `institution-balance.test.ts` (Ledger, 16) e a paridade SQL em
`sqlite-read-paths.test.ts`; `institution-cash.test.ts` (Treasury, 21); `cashView.test.ts` (tela). Os 106
testes que completavam conversas de caixa sem dizer a instituição passaram a responder "não informada".
Sabotagens conferidas: contar o que veio antes da abertura, ou aceitar uma segunda abertura, fazem os testes
falhar. Verificado com o Ledger de verdade num livro de teste de 10 dias: aberturas de Bradesco (500.000,00),
Itaú (400.000,00) e corretora (−1.200,00); a segunda abertura do Itaú foi recusada; um pagamento de 01/11
(antes da abertura) não mexeu no Itaú e um de hoje mexeu; a transferência de 50.000,00 do Bradesco para a
corretora; os saldos fecharam (295.600,51, 257.705,77 e 48.800,00, total 602.106,28); 10 pagamentos "não
informada" ficaram à parte; o extrato do Itaú com 200,00 a mais mostrou a diferença, e o de 02/11 bateu; a
abertura da corretora foi retificada para −1.500,00; o caixa consolidado antigo não contou aberturas nem
transferência. Leituras em ~20 ms. Suítes: Ledger 940 e 12 pendentes (cobertura de 86,5% das linhas);
Treasury 1.014, com 37 `it.todo`, e 199 no cliente. A tela será vista no navegador no piloto.

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
*Situação:* ✅ 2026-11-13, sem commit; as regras estão em §8.7 (`REQ-660`–`REQ-665`). Nenhuma decisão do
dono do produto foi necessária. O Ledger ganhou `GET /api/positions/agenda/receivables`, uma leitura gêmea da
agenda a pagar: as cinco janelas pela data esperada, o total por pagador (as partes além da Usina; sem
nenhuma, "pagador não informado") e os recebimentos sem origem com o total recebido. O Treasury mostra a
tela "Agenda a receber" (filtro por pagador, as seis listas, a ação de receber pela posição) e, à parte, a
lista "declarado pela operadora e ainda não visto no banco", comparando a última elegibilidade de cada
apólice com o recebido, sem total. **Não feito:** ligar o recebimento sem origem à expectativa (`DEC-036`,
`TODO-16`); a saúde (`TODO-11`). Testes: `receivables-agenda-endpoint.test.ts` (Ledger, 15),
`receivables-agenda.test.ts` (Treasury, 7) e `receivablesEngine.test.ts` (tela, 3). Sabotagens conferidas:
a comissão sem data tratada como atrasada, ou o declarado marcado mesmo já recebido, fazem os testes falhar.
Verificado com o Ledger de verdade num livro de teste de 20 dias: 320 comissões em aberto de 10
seguradoras, 120 declaradas e não vistas; um crédito de 2.235,89 da seguradora 1 com 2.135,89 atribuídos
tirou a apólice da lista (120 → 119), baixou o total da seguradora para 128.284,44 e pôs 100,00 em
"recebido sem origem", com a seguradora como pagadora. As quatro leituras ficaram abaixo de 20 ms
(`load:measure`). Suítes: Ledger 923 e 12 pendentes; Treasury 988, com 37 `it.todo`, e 197 no cliente. A
tela será vista no navegador no piloto.

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
**Atualizado em 2026-11-17:** o domínio está em §4.7. O registro **à mão** do sinal da saúde não depende
mais da `Q-054` e pode ser feito antes do piloto; a leitura automática continua esperando o acesso aos
dados. Inclui aposentar o `ingest:receipt` do Ledger (`REQ-289`).
**Feito em 2026-11-17 (parte manual):** §4.7 implementada e vista no navegador com o Ledger de verdade; o
`ingest:receipt` saiu do `npm run dev:full` e se recusa a iniciar. Falta a leitura automática (contrato da
mensagem e produtor), que espera a `Q-054`, e apagar o código do `ingest:receipt` depois do piloto.

**Fase D — juntar e avaliar**

`TODO-12` **O caixa cobre o que vence?** Na agenda a pagar, o total vencido e o de cada dia ficam ao lado
do saldo conhecido de cada instituição, e, à parte, o que se espera receber no mesmo período. É uma leitura
dos fatos, não uma previsão: o esperado **nunca é somado ao caixa**, e o que não tem data não entra em dia
nenhum (`CLAUDE.md`, "Derivations must not assume completeness").
*Por quê:* "avaliar se o caixa suporta as saídas previstas" é tarefa diária do CFO.
*Depende de:* `TODO-05`, `TODO-06` e `TODO-09`.
*Situação:* ✅ 2026-11-17, sem commit; as regras estão em §8.10 (`REQ-680`–`REQ-685`). O dono do produto
escolheu o topo do Painel em vez da agenda a pagar. O Ledger passou a publicar, nas duas agendas, o total
de cada dia de hoje até o fim da janela (`days`); o Treasury monta o quadro em `GET /api/dashboard/morning`
(`GetMorningPanel.ts`) com o caixa conhecido, as instituições sem abertura, o dinheiro sem instituição e as
colunas vencido, hoje, cada próximo dia, depois e sem data, para pagar e, à parte, para receber. Nada é
somado nem concluído no Treasury. **Não feito:** o veredito de sobra ou falta (`REQ-684`, a confirmar no
piloto). Testes: os totais por dia nas duas agendas do Ledger (5 novos), `morning-panel.test.ts` (Treasury,
5) e `morningView.test.ts` (tela, 3). Sabotagens conferidas: omitir os dias vazios no Ledger, ou mexer no
total conhecido no Treasury, fazem os testes falharem. Verificado com o Ledger de verdade num livro de teste
de 10 dias: os dias de 18/11 a 24/11 somaram 32.107,33 em 12 contas, igual ao total da janela publicado
pelo Ledger; a corretora sem abertura apareceu como fora do total. Leitura em 13 ms (`load:measure`).
Suítes: Ledger 943 e 12 pendentes (cobertura de 86,5% das linhas); Treasury 1.019, com 37 `it.todo`, e 202
no cliente. A tela será vista no navegador no piloto.

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

`TODO-25` **Ações onde a pergunta acontece e a compensação** (§8.11, decidido em 2026-11-18). Nesta ordem:
(1) a volta da conversa à tela de origem (`REQ-690`); (2) a ação na linha da Operação e os alertas que levam à
linha (`REQ-691`); (3) a seleção com a barra e a compensação de um par, com o rastro no ciclo do adiantamento e a
descrição orientada do adiantamento (`REQ-692`–`REQ-694`, `REQ-293`); (4) o crédito por pagador e a ponte do
adiantamento na agenda a receber (`REQ-695`, `REQ-696`); (5) o desconto no pagamento (`REQ-697`), só depois da
`Q-058` e da `DEC-024`.
*Por quê:* o adiantamento a corretor, abatido depois nos repasses, é muito frequente (confirmado com o CFO em
2026-11-18); sem a compensação no Treasury, ele fica aberto para sempre ou é registrado de forma errada. A volta
da conversa melhora todas as ações que já existem.
*Depende de:* nada para (1) a (4); (5) depende da `Q-058` e da `DEC-024`.
*Situação:* (1) ✅ 2026-11-18, sem commit, só no cliente. A conversa aberta da agenda a pagar, da agenda a
receber ou de Posições oferece "Voltar para {tela}": discreto enquanto corre, em destaque quando termina
(enviada, recusada de vez ou cancelada); some se o usuário começar outra conversa ou escolher outra tela no
menu. A tela de origem fica montada e escondida durante a conversa, por isso volta com a mesma janela,
filtros, página e linhas marcadas, e é relida ao voltar. Testes:
`returnTarget.test.ts` (a regra, 7) e `OperationsPage.return.test.tsx` (a tela, 3). Sabotagem conferida:
mostrar a volta só no fim faz o teste falhar. Suíte do cliente: 224. **Falta ver no navegador.**
(2) ✅ 2026-11-18, sem commit, só no cliente. Cada linha da Operação tem um botão (Pagar, Receber ou Ver,
`REQ-691`) que abre o detalhe das agendas, lido do Ledger na hora, com as ações; os alertas de obrigação vencida
e de pago sem obrigação têm "Abrir". A página da parte passou a ser tela de origem da volta (`REQ-690`): fica
montada durante a conversa, com a parte, a aba, os filtros e a página de cada seção, e relê as seções na volta
e ao fechar um detalhe. Testes: `partiesEngine.test.ts` (o nome do botão, a posição do alerta, a posição lida
do ciclo de vida) e `PartyViewPage.test.ts` (Pagar leva à conversa e relê; o visualizador vê sem ações; o
alerta abre a posição). Sabotagem conferida: trocar "Pagar" por "Ver" no que a Usina deve faz dois testes
falharem. Suíte do cliente: 230. **Falta ver no navegador.**
(3) ✅ 2026-11-18, sem commit. **Treasury, servidor:** o cenário `register_compensation` (fora da conversa,
`conversational: false`, e por isso também fora das ações de uma posição, para não tirar do lote o pagamento da
obrigação de comissão) e `POST /api/compensations` (`CompensationUseCase`, permissão de envio), que confere antes
de enviar os dois tipos, a moeda, a mesma parte (com as identidades ligadas), o valor até o menor saldo do par e
distingue posição quitada de saldo desconhecido; o evento sai pelo mesmo caminho das outras operações (intenção
aberta a partir da obrigação, que traz a apólice como contexto e a parte a quem é devida). **Tela:** na Operação,
quem pode registrar marca posições dos dois lados; a barra oferece "Preparar lote" (só o que a Usina deve, pelo
mesmo modal da agenda), "Compensar · até {máximo}" (um adiantamento ou empréstimo e uma obrigação de comissão) ou
nada, com o motivo; o modal de compensar mostra o que fica em aberto em cada posição e que o caixa não muda, e o
usuário continua na página, que relê as seções. A linha do tempo nomeia a "Compensação", com a obrigação e a
apólice citadas. A pergunta da descrição do adiantamento passou a ser a de `REQ-293`. Testes:
`compensation.test.ts` (servidor, 12), as rotas novas em `access-by-route.test.ts`, `partiesEngine.test.ts` (a
regra da barra e a prévia) e `PartyViewPage.test.ts` (a compensação, o par recusado com o motivo, o lote da
parte, a recusa do Ledger, o visualizador sem marcação); o `it.todo` do `CA-252` virou teste. Sabotagens
conferidas: sem a checagem da mesma parte, ou com a barra aceitando dois itens de um lado, os testes falham.
**Verificado com o Ledger de verdade** (em memória, por HTTP, pelos casos de uso do Treasury): adiantamento de
500,00 e obrigação de 300,00 com a apólice A; a compensação de 300,00 foi aceita, o adiantamento ficou com 200,00
e a compensação no seu ciclo de vida, a obrigação quitada, o evento citando a apólice; uma nova compensação na
obrigação quitada foi recusada antes do envio. Suítes: Treasury 1.058 no servidor, com 36 `it.todo`, e 242 no
cliente. **Falta ver no navegador**, e o lote preparado ainda não aparece na Operação (`REQ-637`): fica na
agenda a pagar.
(4) ✅ 2026-11-18, sem commit, só no cliente. Na agenda a receber, escolhido um pagador de uma parte só e com
comissão prevista em aberto, o cartão do crédito aparece no topo com o pagador já escolhido (o mesmo cartão das
telas do seguro e da saúde, com textos que nomeiam o pagador). A linha de adiantamento ou empréstimo de uma
parte conhecida ganha "Compensar", que abre a página da parte na Operação, e mantém "Receber". Testes:
`receivablesEngine.test.ts` (as ações da linha e o pagador do crédito) e `ReceivablesPage.test.tsx` (Compensar
leva à parte; o visualizador só vê; o crédito da Allianz aparece; o do João, não). Sabotagem conferida: oferecer
o crédito sem comissão em aberto faz o teste falhar (o teste conferia a ausência cedo demais e foi corrigido
para esperar a resposta). Suíte do cliente: 251. **Falta ver no navegador.** O passo (5) **fica para depois do piloto** (decidido
pelo dono do produto em 2026-11-18): a compensação de um par já cobre o caso real, e o CFO diz no uso se o desconto
no pagamento faz falta. Recomendação registrada para quando voltar: pagamento do líquido primeiro, compensação
depois, porque o pagamento é o fato que o banco confirma e a compensação pode entrar depois pela página da parte.

#### PRI-2 — depois

`TODO-21` **Conciliação linha a linha e importação de extrato** (OFX ou CNAB, `DEC-018`).
*Por quê:* `TODO-07` cobre o mínimo, e a forma de cada instituição ainda é desconhecida.
*Prioridade em revisão (2026-11-16):* com o objetivo de caixa completo para quem consome o Ledger (§8.9),
pode subir. O dono do produto decide depois de estudar o processo e da `Q-055`.

`TODO-22` **Reconstrução progressiva do histórico,** fora das temporadas de pico.
*Por quê:* decisão do dono do produto. O Ledger já aceita fatos com data passada.

`TODO-23` **Fechamento do mês, relatórios e exportação ao contador.**
*Por quê:* não há processo nem destinatário definido para imitar. Entra quando houver quem consuma.

`TODO-24` **O restante já decidido ou levantado:** a operação composta (passo 7), fora o desconto no pagamento
(`TODO-25`), os itens A2–A7 da página da parte (o A1 e a compensação foram para o `TODO-25` em 2026-11-18), o bloco E (`REQ-266`), a aprovação em duas etapas (`DEC-004`), o texto
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
