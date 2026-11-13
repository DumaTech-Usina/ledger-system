#!/bin/sh
# Acceptance test of TODO-02 (treasury/docs/requisitos_refinados.md §18): the real backup image, run against
# a local folder standing in for R2. Needs Docker and sqlite3 on the host.
#
#   sh deploy/backup/test.sh
set -eu

HERE=$(cd "$(dirname "$0")" && pwd)
IMAGE=treasury-backup-test
ROOT=$(mktemp -d "${TMPDIR:-/tmp}/backup-test.XXXXXX")
trap 'rm -rf "$ROOT"' EXIT
mkdir -p "$ROOT/ledger" "$ROOT/treasury" "$ROOT/logs/audit" "$ROOT/bucket/other-system" "$ROOT/state"

pass() { echo "  ok - $*"; }
die() { echo "  FALHOU - $*"; exit 1; }
count() { sqlite3 "$1" "SELECT count(*) FROM $2;"; }

# A book being written to: WAL mode, as the services run it.
sqlite3 "$ROOT/ledger/ledger.db" "PRAGMA journal_mode=WAL; CREATE TABLE ledger_events (id TEXT); INSERT INTO ledger_events VALUES ('e1'),('e2'),('e3');" >/dev/null
sqlite3 "$ROOT/treasury/treasury.db" "PRAGMA journal_mode=WAL; CREATE TABLE users (id TEXT); INSERT INTO users VALUES ('u1');" >/dev/null
echo '{"action":"LEDGER_EVENT_CREATED"}' > "$ROOT/logs/audit/2026-11-13.log"
echo "PDF de outro sistema" > "$ROOT/bucket/other-system/contrato.pdf"

docker build -q -t "$IMAGE" "$HERE" >/dev/null

backup() {
  docker run --rm \
    -e RCLONE_CONFIG_BUCKET_TYPE=local -e BACKUP_REMOTE=bucket:/bucket/treasury-backups -e BACKUP_KEEP=2 \
    -v "$ROOT/ledger:/data/ledger" -v "$ROOT/treasury:/data/treasury" -v "$ROOT/logs:/data/ledger-logs:ro" \
    -v "$ROOT/bucket:/bucket" -v "$ROOT/state:/state" \
    "$IMAGE" "$@"
}

echo "TODO-02 — cópia diária fora da máquina e restauração"

backup run >/dev/null; sleep 1.1
backup run >/dev/null; sleep 1.1
backup run >/dev/null
copies=$(backup list)
[ "$(printf '%s\n' "$copies" | grep -c .)" = 2 ] || die "deveriam restar as 2 cópias mais recentes; restaram: $copies"
pass "guarda só as N cópias mais recentes (BACKUP_KEEP)"

[ -f "$ROOT/bucket/other-system/contrato.pdf" ] || die "um arquivo de outro sistema no bucket foi apagado"
pass "não toca no que está no bucket fora do prefixo"

[ -f "$ROOT/bucket/treasury-backups/ledger-logs/audit/2026-11-13.log" ] || die "os logs de auditoria do Ledger não foram copiados"
pass "copia os logs de auditoria do Ledger"

[ -s "$ROOT/state/last-success" ] || die "a última cópia boa não foi registrada"
pass "registra a última cópia boa (base do healthcheck)"

latest=$(printf '%s\n' "$copies" | tail -n 1)
backup verify "$latest" | grep -q "3 eventos no Ledger" || die "a verificação não leu os 3 eventos da cópia"
pass "verifica uma cópia sem tocar no que está em uso"

# The book moves on after the copy; restoring brings back the copy and keeps the newer file aside.
sqlite3 "$ROOT/ledger/ledger.db" "INSERT INTO ledger_events VALUES ('e4');"
if backup restore "$latest" >/dev/null 2>&1; then die "restaurou sem a confirmação de serviços parados"; fi
[ "$(count "$ROOT/ledger/ledger.db" ledger_events)" = 4 ] || die "a recusa alterou o arquivo em uso"
pass "recusa restaurar sem --services-stopped"

backup restore "$latest" --services-stopped >/dev/null
[ "$(count "$ROOT/ledger/ledger.db" ledger_events)" = 3 ] || die "o Ledger restaurado não tem os 3 eventos da cópia"
[ "$(count "$ROOT/treasury/treasury.db" users)" = 1 ] || die "o Treasury restaurado não confere"
previous=$(ls "$ROOT/ledger" | grep '^ledger.db.before-restore-' | head -n 1)
[ -n "$previous" ] && [ "$(count "$ROOT/ledger/$previous" ledger_events)" = 4 ] || die "o arquivo anterior à restauração não foi guardado"
pass "restaura a cópia e guarda o arquivo anterior, sem apagar nada"

# A copy damaged in the bucket is refused before it reaches anything live.
printf 'lixo' > "$ROOT/bucket/treasury-backups/daily/$latest/ledger.db.gz"
if backup verify "$latest" >/dev/null 2>&1; then die "aceitou uma cópia corrompida"; fi
pass "recusa uma cópia que não confere com o SHA256SUMS"

# A damaged live file is not shipped as if it were a copy.
cp "$ROOT/ledger/ledger.db" "$ROOT/ledger.ok"
rm -f "$ROOT/ledger/ledger.db-wal" "$ROOT/ledger/ledger.db-shm"
printf 'isto não é um banco SQLite' > "$ROOT/ledger/ledger.db"
before=$(backup list | grep -c .)
if backup run >/dev/null 2>&1; then die "enviou a cópia de um banco ilegível"; fi
[ "$(backup list | grep -c .)" = "$before" ] || die "uma cópia ruim foi enviada"
pass "não envia a cópia de um banco ilegível"

echo "todos os testes passaram"
