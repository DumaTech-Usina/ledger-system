# Treasury — Requisitos Refinados

> **Escopo desta versão.** Documenta o **que o Treasury já faz hoje**, na linguagem do negócio:
> a fronteira com o Ledger, o catálogo de operações, a coleta guiada, o envio, a recusa, a
> correção e a retificação, as consultas, a entrada por texto livre e o acesso.
> **Fica fora desta versão:** o módulo de cadastro mestre (MDM) de contrapartes; a visão por
> pessoa e por grupo de pessoas, com encadeamento (deixada **pronta para a próxima rodada**,
> `DEC-001`); aprovação em duas etapas (`DEC-004`); os novos estados e entidades que virão com o
> MDM (`DEC-007`, `DEC-008`).
> A seção **Contrapartes (§5) já nasce depreciada**: o MDM vai substituí-la.
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
>
> | Série | Bloco |
> | --- | --- |
> | `1xx` | Fronteira Treasury × Ledger |
> | `2xx` | Operações e coleta guiada (bloco principal) |
> | `3xx` | Contrapartes (**depreciado**) |
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

> **Intenção, candidato e fato não são sinônimos.** A intenção é a conversa. O candidato é a
> proposta que sai dela. O fato é o candidato que o Ledger aceitou.
>
> **Retificação e estorno não são sinônimos.** A retificação diz que o lançamento nunca
> aconteceu. O estorno desfaz algo que aconteceu.
>
> **Origem e posição não são sinônimos.** A origem é um **fato** anterior. A posição é aquilo que
> esse fato abriu e que outros fatos movimentam.

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

---

## 5. Contrapartes — **depreciado**

> **Esta seção será substituída pelo MDM na próxima rodada** (`DEC-002`). Ela registra o que vale
> até lá e as diretrizes que já foram dadas para o que vem depois.

### 5.1 Regras que valem até o MDM

`REQ-301` Uma contraparte **não identificável** só é aceita na **comissão recebida**. Em qualquer
outra operação, ela é recusada.

> Protege contra uma saída de dinheiro sem destinatário conhecido. O dinheiro que **entra** pode
> chegar sem remetente conhecido; o que **sai** não.

`REQ-302` Uma movimentação com contraparte não identificável fica **pendente de validação**. O
sistema cobra o complemento futuro de forma insistente, quase obrigatória. A forma dessa
cobrança (alerta, notificação) está em `DEC-003`.

> Contraparte não identificada **não é o estado ideal**. O Ledger a aceita porque calcula do seu
> modo, mas o Treasury precisa mapeá-la com cuidado (`DEC-006`).

### 5.2 Registro do comportamento atual (não é requisito)

Descrito só para servir de base à comparação futura com o MDM:

- A contraparte digitada é procurada no diretório do Treasury. Se não existe, o usuário pode
  **criá-la durante a operação** ou declará-la não identificável, com justificativa.
- Uma contraparte parecida, mas não igual, pede confirmação. Várias parecidas pedem escolha.
- Na prévia, o sistema pode fazer **uma** pergunta opcional de enriquecimento (documento ou tipo).
  Uma pergunta recusada não volta a ser feita.
- Contrapartes podem ser importadas de fonte externa sem sobrescrever o que já se sabe.

### 5.3 Diretrizes já dadas para o MDM (entram na próxima rodada, `DEC-002`)

- A resolução de contraparte precisa ser **concisa e forte do início ao fim**.
- **Não se cria contraparte no momento da operação.** O caminho é buscar algo **previamente
  cadastrado**.
- **Toda e qualquer parte** de um evento deve ser identificada.
- Um evento com **dúvida sobre uma entidade** deve ficar **sinalizado**. Isso vale também para
  eventos que **vêm de fora** do Treasury.

---

## 6. Acesso

`REQ-401` Existem **dois papéis**:

| Papel | Inicia operação | Envia ao Ledger | Consulta |
| --- | --- | --- | --- |
| **Gestor financeiro** | Sim | Sim | Sim |
| **Visualizador** | **Não** | **Não** | Sim |

> Papéis mais customizáveis, como "quem prepara mas não envia" com a aprovação de outra pessoa,
> ficam em aberto (`DEC-004`).

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

`REQ-523` Na reemissão, **só valor, data e descrição** podem mudar. A **contraparte nunca muda**.

> Protege contra a reemissão virar outro fato: mudar quem participou muda qual fato é.

`REQ-524` A retirada **não apaga nem reescreve** o lançamento original; ele continua no histórico, mas **deixa de contar**.

---

## 8. Consultas

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

> Quais telas de consulta são requisito (painel, exposição, posições, movimentos, contas a pagar,
> ciclo de vida, saúde de classificação) continua em aberto (`DEC-009`).

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

`REQ-804` A auditoria cobre **somente o que conta como operação**: o que é **enviado ao Ledger**.
Cada passo da conversa (respostas, recusas de campo, correções antes do envio) **não é** auditado
por esta regra.

> Observar o comportamento do usuário antes de ele confirmar uma ação é uma ideia em aberto, como
> log (`DEC-012`), e não faz parte da auditoria.

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

### 11.2 Contraparte — **depreciado**

Os estados identificada / não identificável / mesclada serão substituídos pelo MDM (`DEC-002`).

---

## 12. Alteração e correção

- **Antes do envio:** as respostas da intenção podem mudar, inclusive com a prévia na tela
  (`REQ-214`). Essas mudanças **não** são auditadas (`REQ-804`).
- **Depois do aceite:** o fato **não muda**. A única correção é a **retificação** (§7.3), que é
  auditada com autor identificado (`REQ-801`, `REQ-802`), quando foi feita e o que foi feito
  (`REQ-803`, `REQ-804`).
- **Contrapartes:** bloqueado por `DEC-002`.

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

**FP-03 — Resolução de contraparte** — **depreciado** (`DEC-002`).

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

**FP-09 — Importação de contrapartes** — **depreciado** (`DEC-002`).

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
| `CA-801` | O gestor "cfo" envia uma folha → a auditoria registra "cfo" como autor | `REQ-801`, `REQ-802` |
| `CA-802` | Um evento chega de um sistema externo → a auditoria registra a identificação desse sistema como autor | `REQ-802` |

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

---

## 15. Decisões pendentes e perguntas abertas

### 15.1 Decisões pendentes

| ID | Pendência | Impacto (comportamento enquanto não decide) |
| --- | --- | --- |
| `DEC-001` | **Visão por pessoa e por grupo de pessoas, com encadeamento** — "no gatilho" para a próxima rodada | As consultas seguem por posição e movimento (§8) |
| `DEC-002` | **MDM substitui Contrapartes** (diretrizes em §5.3) | §5.1 vale; §5.2 é só registro |
| `DEC-003` | Forma da cobrança de "pendente de validação" (alerta, notificação) | A marca existe (`REQ-302`), mas sem forma de cobrança definida |
| `DEC-004` | Papel que prepara sem enviar, com aprovação de outra pessoa | Só os dois papéis de `REQ-401` |
| `DEC-005` | Revisão da classificação do texto livre (IA ou recomendação) com a pergunta "Você deseja fazer um **adiantamento** com os dados a seguir?" e troca de operação reaproveitando os dados | Vale `REQ-701`/`REQ-702`; trocar de operação não está definido |
| `DEC-006` | Tratamento cuidadoso de eventos sem contraparte identificada ("podemos falar quando chegar a hora") | Vale `REQ-301`/`REQ-302` |
| `DEC-007` | Estados da aplicação depois do MDM | Valem os estados de §11.1 |
| `DEC-008` | Entidades a remover ou reescrever | O glossário (§2) reflete o atual |
| `DEC-009` | Quais consultas são requisito: painel, exposição, posições, movimentos, contas a pagar, ciclo de vida, saúde de classificação (veio de `Q-018`) | Valem `REQ-601`–`REQ-604`; as telas existentes não são requisito nem descartadas |
| `DEC-010` | Quem aparece como parte em cada registro: Usina na renúncia e no pagamento direto; operadora no pagamento direto e na comissão prevista (veio de `Q-012`). Decidir na rodada do MDM | O registro segue como está em §4.1 |
| `DEC-011` | Outras moedas além do BRL (veio de `Q-023`) | Só BRL (`REQ-222`) |
| `DEC-012` | Logs de comportamento: observar cada passo da conversa, mesmo antes de o usuário confirmar uma ação (veio de `Q-024`) | Só a operação é auditada (`REQ-804`) |
| `DEC-013` | **Provisão de pagamento futuro / lançamento futuro**: "pode e até deve existir", mas fatos não podem ser previstos (veio de `Q-025`) | Data de ocorrência futura é recusada (`REQ-226`); não há como registrar uma provisão |
| `DEC-014` | Abrir o caderno (Ledger) para visualização por usuários com formação contábil (veio de `Q-029`) | O caderno é acessível só pela referência guardada na intenção (`REQ-501`) |

### 15.2 Perguntas abertas

Nenhuma. A documentação do que existe está fechada (§16).

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

---

## 16. Critério de parada — situação

| Critério | Situação |
| --- | --- |
| Fronteira Treasury × Ledger | ✅ §3 |
| Catálogo de operações | ✅ §4.1 (partes por registro na rodada do MDM, `DEC-010`) |
| Coleta guiada e prévia | ✅ §4.2 |
| Valores, moeda, datas e limites | ✅ §4.3 |
| Contrapartes | ⬜ depreciado — MDM na próxima rodada (`DEC-002`) |
| Acesso | ✅ §6 |
| Envio, recusa e correção | ✅ §7.1–7.2 |
| Retificação | ✅ §7.3 |
| Consultas | 🔶 §8 — `DEC-009` |
| Texto livre | ✅ §9 (melhoria futura em `DEC-005`) |
| Auditoria | ✅ §10 |
| Estados | ✅ §11 |
| Nenhum `⚠ CONFIRMAR` em aberto | ✅ |
| Visão por pessoa/grupo | ⬜ `DEC-001` (próxima rodada) |

**Critério de parada desta parte (documentação do que existe): atingido**, declarado pelo dono do
produto em 2026-11-03. Ficam abertas, por decisão dele, as `DEC-001` a `DEC-014`.

**O que não foi feito:** nenhum código foi escrito ou alterado, e nenhuma comparação com o
código foi feita.
**Próxima etapa, nesta ordem:** (1) comparar este documento com o código em `treasury/`, que até
aqui foi só lido; (2) abrir a rodada do MDM e da visão por pessoa ou grupo (`DEC-001`, `DEC-002`,
`DEC-010`). A ordem entre as duas é decisão do dono do produto.

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
| Pagamento direto ao corretor | `DIRECT_PAYMENT_ACKNOWLEDGED` | `NON_CASH` | `COMMISSION_RECEIVABLE` + `COMMISSION_ENTITLEMENT` | `SETTLES` | `DIRECT_COMMISSION_PAYMENT_AUTHORIZED` |
| Renúncia de comissão | `COMMISSION_WAIVER` | `NON_CASH` | `COMMISSION_ENTITLEMENT` | `SETTLES` \| `REVERSES` | `COMMISSION_WAIVER` |
| Reconhecimento de obrigação | `OBLIGATION_RECOGNIZED` | `NON_CASH` | `PAYROLL` \| `SERVICE_FEE` \| `INFRASTRUCTURE_COST` \| `TAX` \| `PAYABLE` | `ORIGINATES` | `OBLIGATION_RECOGNITION` (tardio: `LATE_AWARENESS`) |
| Retificação | `LEDGER_CORRECTION` | `NON_CASH` | `ADVANCE` \| `LOAN` \| `COMMISSION_RECEIVABLE` | `RETRACTS` | `DATA_RECONCILIATION` |
