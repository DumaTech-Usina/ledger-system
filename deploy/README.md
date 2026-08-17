# Deploy — MVP em uma única máquina

Todo o sistema em um host Docker. A máquina precisa de **Docker e nada mais**: sem PostgreSQL, sem
MongoDB, sem broker. Cada serviço guarda seus dados em um arquivo SQLite dentro de um volume.

```
host:4000 ──▶ treasury ──(rede interna do Docker)──▶ ledger
                 │                                      │
           treasury_data                            ledger_data
        (Party Directory)               (o livro: eventos + staging + rejeições)
```

**Uma única porta publicada.** O Ledger não tem mapeamento de porta nenhum — ele é alcançável em
`http://ledger:3000` de dentro da rede do Docker e de mais lugar nenhum.

## Primeiro deploy

1. **Instale o Docker** na máquina (só isso).
2. **Clone o repositório** e entre em `deploy/`.
3. **Segredos**: `cp .env.example .env` e preencha os três campos obrigatórios.
   - `LEDGER_SUBMIT_TOKEN=$(openssl rand -hex 32)` — o mesmo valor é usado pelos dois serviços.
     Com ele vazio o endpoint de submissão do Ledger falha fechado e nada pode ser gravado.
   - `AUTH_MANAGER_PASSWORD` e `AUTH_VIEWER_PASSWORD` — as senhas de login do Treasury.
4. **Suba**: `docker compose up -d --build`
5. **Verifique**: `docker compose ps` (o ledger precisa aparecer como `healthy`), depois
   `curl http://127.0.0.1:4000/health`.

## Como acessar

Por padrão o Treasury é publicado **apenas em `127.0.0.1:4000`**, nunca na interface pública. Numa
VM remota, acesse por um túnel SSH:

```bash
ssh -L 4000:127.0.0.1:4000 usuario@host
# e abra http://localhost:4000 no navegador
```

Usuários: `cfo` (gerente financeiro) e `viewer` (leitura), com as senhas do `.env`.

### Publicar com TLS num domínio

Só se você realmente precisa expor o app na internet. Aponte o registro `A` do domínio para o IP da
máquina, ponha o domínio em `SITE_ADDRESS` no `.env` e suba com o perfil `tls`:

```bash
docker compose --profile tls up -d --build
```

O Caddy sobe nas portas 80/443 e provisiona um certificado Let's Encrypt automaticamente. Nesse
modo, mantenha `BIND_ADDRESS=127.0.0.1` para que o Treasury continue não publicado diretamente.

## Operação

- Logs: `docker compose logs -f <serviço>`
- Atualizar: `git pull && docker compose up -d --build`
- Parar: `docker compose down` (os dados ficam nos volumes nomeados)
- Estado: `docker compose ps`

### Backup

O livro inteiro é um arquivo. Use a API de backup online do SQLite — copiar o arquivo com o serviço
escrevendo pode capturar um estado inconsistente:

```bash
docker compose exec ledger node -e "
  const db = require('better-sqlite3')('/app/data/ledger.db');
  db.backup('/app/data/backup.db').then(() => { console.log('ok'); db.close(); });
"
docker compose cp ledger:/app/data/backup.db ./ledger-$(date +%F).db
```

O mesmo vale para `treasury:/app/data/treasury.db` (o Party Directory). **Guarde as cópias fora da
máquina** — um host único sem backup externo não é aceitável para um sistema de registro.

### Restaurar

Pare o stack, substitua o arquivo dentro do volume e suba de novo:

```bash
docker compose down
docker compose run --rm -v "$PWD":/backup ledger cp /backup/ledger-2026-08-14.db /app/data/ledger.db
docker compose up -d
```

## Fuso horário

O livro é mantido em `America/Sao_Paulo` por padrão — as imagens base do Docker rodam em UTC, e os
serviços definem o próprio fuso em vez de herdar o do host. Isso decide **como uma data sem offset
é lida**: `2026-09-14` significa esse dia aqui, e não meia-noite UTC (que seria 21h do dia 13).

Os instantes continuam **gravados em UTC** no arquivo — um instante é um ponto no tempo, e UTC é a
única forma de escrevê-lo sem ambiguidade. O fuso decide o que foi *dito*, não como é *guardado*.

Para outra praça, defina `TZ` no `.env` (ex.: `TZ=America/Manaus`). Os dois serviços precisam usar
o mesmo valor, e o compose já garante isso a partir da mesma variável.

## O que este stack ainda não resolve

- **Intents e sessões do Treasury são voláteis.** Só o Party Directory é durável; conversas em
  andamento e sessões de login se perdem no restart. Fatos já submetidos ao Ledger não se perdem —
  eles estão no livro.
- **Backup é manual.** Não há rotina agendada; o comando acima precisa ser automatizado antes de
  qualquer operação real.
- **Um único host.** Não há redundância. A perda do disco é a perda do livro se não houver cópia
  externa.
- **Escrita serializada.** O SQLite admite um escritor por vez. Isso é adequado ao volume de um
  livro append-only escrito por um processo, e não é adequado a vários escritores concorrentes.
