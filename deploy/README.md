# Deploy — MVP em uma única máquina

> **⚠ Produção:** antes de pôr o sistema em produção, resolva ou decida os pontos de
> `treasury/docs/requisitos_refinados.md` §17 ("Antes de produção: ver e decidir"): lentidão com volume
> real, consistência de API e resiliência. Este guia serve para o MVP de teste.

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
3. **Segredos**: `cp .env.example .env` e preencha os campos obrigatórios.
   - `LEDGER_SUBMIT_TOKEN=$(openssl rand -hex 32)` — o mesmo valor é usado pelos dois serviços.
     Com ele vazio o endpoint de submissão do Ledger falha fechado e nada pode ser gravado.
   - `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` — o destino da cópia
     diária (veja "Backup"). Sem eles o stack não sobe: um livro sem cópia fora da máquina não é aceitável.
   - `PUBLIC_BASE_URL` — o endereço pelo qual as pessoas abrem o Treasury; é a base dos links de
     convite (`http://localhost:4000` pelo túnel SSH, ou `https://<SITE_ADDRESS>` com TLS).
4. **Suba**: `docker compose up -d --build`
5. **Verifique**: `docker compose ps` (o ledger precisa aparecer como `healthy`), depois
   `curl http://127.0.0.1:4000/health`.
6. **Primeiro administrador**: não existe usuário nem senha padrão (`treasury/docs/requisitos_refinados.md`
   §6). Emita o convite do primeiro administrador e abra o link impresso para definir a senha:

   ```bash
   docker compose exec treasury node dist/infra/auth/cli/first-admin.js cfo@empresa.com.br
   ```

   Daí em diante, o administrador convida as demais pessoas pela tela **Usuários**. Enquanto o envio
   de e-mail não estiver configurado, o link do convite aparece na tela para ser repassado.

## Como acessar

Por padrão o Treasury é publicado **apenas em `127.0.0.1:4000`**, nunca na interface pública. Numa
VM remota, acesse por um túnel SSH:

```bash
ssh -L 4000:127.0.0.1:4000 usuario@host
# e abra http://localhost:4000 no navegador
```

Entre com o e-mail e a senha definidos no convite. Os papéis são Administrador, Gestor financeiro e
Visualizador (§6). Quem esquece a senha é desativado e reconvidado pelo administrador, até o envio de
e-mail existir.

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

O serviço `backup` faz, todo dia às 03:00 (`BACKUP_CRON`, no fuso `TZ`), uma cópia do Ledger
(`ledger.db`) e do Treasury (`treasury.db`) e a envia ao **Cloudflare R2**. A cópia é tirada com a API de
backup online do SQLite, com os serviços rodando, e só sai da máquina depois de passar no
`PRAGMA integrity_check`. Vai comprimida, com um `SHA256SUMS`, para
`<R2_BUCKET>/<BACKUP_PREFIX>/daily/<data-hora>/`. Os logs de auditoria do Ledger são espelhados em
`<BACKUP_PREFIX>/ledger-logs/` e nunca apagados. Ficam as **30 cópias mais recentes** (`BACKUP_KEEP`):
a contagem é por cópia, não por idade, então nada é apagado se as cópias pararem.

**Configurar.** No R2, crie um token de API com "Object Read & Write" **só para o bucket** e preencha no
`.env`: `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID` e `R2_SECRET_ACCESS_KEY`. O serviço escreve e
apaga **somente** dentro de `BACKUP_PREFIX`; os demais arquivos do bucket (PDFs e imagens de outros
sistemas) nunca são tocados. A primeira cópia sai assim que o serviço sobe, para que uma credencial errada
apareça no deploy e não na manhã seguinte.

**Acompanhar.** `docker compose ps` mostra o `backup` como `unhealthy` quando a última cópia boa tem mais de
26 horas. Os detalhes estão em `docker compose logs backup`.

```bash
docker compose run --rm backup list                 # as cópias guardadas
docker compose run --rm backup run                  # uma cópia agora
docker compose run --rm backup verify               # baixa a última cópia e prova que ela restaura
docker compose run --rm backup verify 2026-11-13T030000
```

`verify` não toca em nada que está em uso: baixa a cópia, confere o `SHA256SUMS` e a integridade, e diz
quantos eventos o Ledger tem nela. Rode-o de vez em quando; uma cópia que nunca foi restaurada é uma
esperança, não um backup.

### Restaurar

```bash
docker compose stop ledger treasury
docker compose run --rm backup restore 2026-11-13T030000 --services-stopped
docker compose start ledger treasury
```

A restauração confere a cópia antes de qualquer coisa e **não apaga nada**: os arquivos em uso, com o WAL,
ficam ao lado com o sufixo `.before-restore-<data-hora>`. Sem `--services-stopped`, ela recusa. Fatos
registrados depois da cópia restaurada não estão nela; os arquivos `.before-restore-*` os guardam.

O teste automático do backup e da restauração roda contra uma pasta local no lugar do R2:
`sh deploy/backup/test.sh` (precisa de Docker e de `sqlite3`).

## Fuso horário

O livro é mantido em `America/Sao_Paulo` por padrão — as imagens base do Docker rodam em UTC, e os
serviços definem o próprio fuso em vez de herdar o do host. Isso decide **como uma data sem offset
é lida**: `2026-09-14` significa esse dia aqui, e não meia-noite UTC (que seria 21h do dia 13).

Os instantes continuam **gravados em UTC** no arquivo — um instante é um ponto no tempo, e UTC é a
única forma de escrevê-lo sem ambiguidade. O fuso decide o que foi *dito*, não como é *guardado*.

Para outra praça, defina `TZ` no `.env` (ex.: `TZ=America/Manaus`). Os dois serviços precisam usar
o mesmo valor, e o compose já garante isso a partir da mesma variável.

## O que este stack ainda não resolve

- **Sem envio de e-mail.** Convites são repassados à mão pelo administrador, e não há "esqueci a
  senha" (§6.4). Usuários, sessões e convites ficam em `treasury.db` e sobrevivem ao restart.
- **Um único host.** Não há redundância. Perder o disco custa o que foi registrado desde a última cópia
  no R2 (no máximo um dia).
- **Escrita serializada.** O SQLite admite um escritor por vez. Isso é adequado ao volume de um
  livro append-only escrito por um processo, e não é adequado a vários escritores concorrentes.
