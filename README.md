# ledger-system
Usina do Seguro Ledger system repository

## Deploy

Todo o sistema roda em **um único host Docker**. O Treasury (app do usuário) é o único serviço
publicado; o Ledger fica acessível apenas em `http://ledger:3000` dentro da rede interna do Docker.
Não há banco de dados como serviço — cada um guarda seus dados em um arquivo SQLite dentro de um
volume nomeado.

```
host:4000 ──▶ treasury ──(rede interna do Docker)──▶ ledger
                 │                                      │
           treasury_data                            ledger_data
        (Party Directory)               (o livro: eventos + staging + rejeições)
```

O stack de deploy vive em `deploy/` (compose, `.env.example`, Caddyfile). O
`docker-compose.yml` da raiz é **infraestrutura de desenvolvimento** (Postgres/Mongo/RabbitMQ para
os pipelines de ETL e validação) e não faz parte do deploy.

### Pré-requisitos da máquina host

| Requisito | Detalhe |
| --- | --- |
| **Docker Engine** | 20.10+ com o plugin **Compose v2** (o comando é `docker compose`, não `docker-compose`). Verifique com `docker compose version`. |
| **git** | Para clonar e para atualizar (`git pull` é o mecanismo de deploy). |
| **Memória** | ~2 GB livres durante o `--build`: o build compila TypeScript, empacota o cliente React e pode compilar `better-sqlite3` a partir do fonte. Em regime, os dois serviços rodam com bem menos. |
| **Disco** | ~3 GB para imagens e camadas de build, mais o crescimento do livro (que é pequeno: um arquivo SQLite). |
| **Internet de saída** | Necessária durante o build (imagens base do Docker e pacotes npm). Em regime o stack não precisa de rede externa. |
| **`openssl`** | Só para gerar o token de serviço. Qualquer outro gerador de aleatoriedade serve. |

Não é preciso instalar **nada** além disso — sem PostgreSQL, sem MongoDB, sem RabbitMQ, sem Node.js
no host. Tudo o que o build precisa acontece dentro das imagens.

**Portas.** Por padrão o stack **não abre nenhuma porta pública**: o Treasury é publicado apenas em
`127.0.0.1:4000` e se chega nele por túnel SSH. Se for usar o perfil `tls`, então a máquina precisa
das portas **80 e 443** abertas e de um registro `A` apontando o domínio para o IP do host.

### Primeiro deploy

```bash
# 1. Clone o repositório na máquina
git clone <url-do-repositorio> ledger-system
cd ledger-system/deploy

# 2. Crie o arquivo de segredos
cp .env.example .env

# 3. Gere o token de serviço Treasury -> Ledger e preencha o .env
openssl rand -hex 32
```

Edite `deploy/.env` e preencha os **três campos obrigatórios**:

- `LEDGER_SUBMIT_TOKEN` — o valor gerado acima. Os dois serviços leem a mesma variável. Com ele
  vazio o endpoint de submissão do Ledger **falha fechado** e nada pode ser gravado.
- `AUTH_MANAGER_PASSWORD` — senha do usuário `cfo` (gerente financeiro).
- `AUTH_VIEWER_PASSWORD` — senha do usuário `viewer` (leitura).

```bash
# 4. Suba o stack (a primeira build leva alguns minutos)
docker compose up -d --build

# 5. Verifique
docker compose ps                      # o ledger precisa aparecer como "healthy"
curl http://127.0.0.1:4000/health      # Treasury respondendo
```

**Acesso.** Como o Treasury só escuta em loopback, abra um túnel a partir da sua máquina:

```bash
ssh -L 4000:127.0.0.1:4000 usuario@host
# e acesse http://localhost:4000 — usuários: cfo e viewer
```

<details>
<summary>Opcional: publicar com TLS num domínio</summary>

Aponte o registro `A` do domínio para o IP do host, coloque o domínio em `SITE_ADDRESS` no `.env` e
suba com o perfil `tls` — o Caddy sobe nas portas 80/443 e provisiona um certificado Let's Encrypt
automaticamente:

```bash
docker compose --profile tls up -d --build
```

Mantenha `BIND_ADDRESS=127.0.0.1` nesse modo, para que o Treasury continue não publicado
diretamente e todo o tráfego passe pelo Caddy.

</details>

### Deploys subsequentes

```bash
cd ledger-system

# 1. Faça backup do livro ANTES de atualizar (veja deploy/README.md)
cd deploy
docker compose exec ledger node -e "
  const db = require('better-sqlite3')('/app/data/ledger.db');
  db.backup('/app/data/backup.db').then(() => { console.log('ok'); db.close(); });
"
docker compose cp ledger:/app/data/backup.db ./ledger-$(date +%F).db

# 2. Traga o código novo e reconstrua
cd .. && git pull && cd deploy
docker compose up -d --build

# 3. Verifique
docker compose ps
docker compose logs -f --tail=50
```

O que **não** precisa ser refeito: `deploy/.env` permanece como está, e os volumes nomeados
(`ledger_data`, `ledger_logs`, `treasury_data`) não são tocados por `up --build` — o livro
sobrevive à atualização. As migrações do Ledger rodam sozinhas no boot
(`DB_MIGRATIONS_RUN=true` no compose).

Dois detalhes que costumam morder:

- **Se estiver usando TLS, repita o flag do perfil em todo deploy:**
  `docker compose --profile tls up -d --build`. Sem ele o Caddy fica de fora do comando.
- **`ledger/algebra.json` é versionado.** O Treasury monta esse arquivo do repositório e se recusa a
  subir sem ele, então `git pull` já basta no host. Mas se você mexeu na álgebra econômica do
  Ledger, regenere e **commite** na máquina de desenvolvimento antes — há um teste de frescor que
  falha se o arquivo estiver defasado:

  ```bash
  cd ledger && npm run export:algebra && git add algebra.json
  ```

### Operação

```bash
docker compose logs -f <serviço>   # acompanhar logs (treasury | ledger | caddy)
docker compose ps                  # estado dos serviços
docker compose down                # parar (os dados ficam nos volumes)
```

Backup, restauração, fuso horário e as limitações conhecidas deste stack (backup manual, host
único, sessões voláteis) estão documentados em **[`deploy/README.md`](deploy/README.md)**.
