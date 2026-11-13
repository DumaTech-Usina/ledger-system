#!/bin/sh
# Daily copy of the book off the machine, and its restoration (TODO-02, treasury/docs/requisitos_refinados.md §18).
#
#   backup.sh schedule            run once now, then every day at BACKUP_CRON (the container's default)
#   backup.sh run                 take one copy now
#   backup.sh list                list the copies kept
#   backup.sh verify [<copy>]     download a copy (default: the latest) and check it, touching nothing live
#   backup.sh restore <copy> --services-stopped
#                                 put a copy in place of the live files; the current ones are kept aside
#
# What a copy is: an online SQLite snapshot of the Ledger (the book) and of the Treasury (parties, intents,
# audit, users), each checked with `PRAGMA integrity_check` before it leaves the machine, compressed, with a
# SHA256SUMS file. The Ledger's audit log files are mirrored next to the copies, never deleted.
#
# Where: BACKUP_REMOTE (an rclone path; in the stack, the R2 bucket under BACKUP_PREFIX). Only that prefix is
# ever written or pruned, so whatever else lives in the bucket is never touched.
set -eu

LEDGER_DB=${LEDGER_DB:-/data/ledger/ledger.db}
TREASURY_DB=${TREASURY_DB:-/data/treasury/treasury.db}
LEDGER_LOGS=${LEDGER_LOGS:-/data/ledger-logs}
REMOTE=${BACKUP_REMOTE:?BACKUP_REMOTE is required (e.g. r2:<bucket>/<prefix>)}
KEEP=${BACKUP_KEEP:-30}
STATE=${BACKUP_STATE_DIR:-/state}
WORK=${BACKUP_WORK_DIR:-/tmp/backup-work}

log() { echo "[backup $(date '+%Y-%m-%dT%H:%M:%S%z')] $*"; }
fail() { log "ERRO: $*"; exit 1; }

# A file is good only if SQLite itself says so.
check_db() {
  result=$(sqlite3 -readonly "$1" "PRAGMA integrity_check;" 2>&1) || fail "não foi possível abrir $1: $result"
  [ "$result" = "ok" ] || fail "verificação de integridade falhou em $1: $result"
}

# The online backup API copies a consistent state even while the services write (WAL mode).
snapshot() {
  [ -s "$1" ] || fail "arquivo não encontrado ou vazio: $1"
  sqlite3 "$1" ".timeout 15000" ".backup '$2'" || fail "a cópia de $1 falhou"
  check_db "$2"
}

cmd_run() {
  stamp=$(date '+%Y-%m-%dT%H%M%S')
  dir="$WORK/$stamp"
  rm -rf "$WORK" && mkdir -p "$dir"

  snapshot "$LEDGER_DB" "$dir/ledger.db"
  snapshot "$TREASURY_DB" "$dir/treasury.db"
  gzip -9 "$dir/ledger.db" "$dir/treasury.db"
  (cd "$dir" && sha256sum ledger.db.gz treasury.db.gz > SHA256SUMS)

  rclone copy "$dir" "$REMOTE/daily/$stamp" || fail "o envio da cópia $stamp falhou"
  # The remote must hold exactly what was checked here.
  rclone check "$dir" "$REMOTE/daily/$stamp" --one-way >/dev/null 2>&1 || fail "a cópia $stamp não confere no destino"

  if [ -d "$LEDGER_LOGS" ]; then
    rclone copy "$LEDGER_LOGS" "$REMOTE/ledger-logs" || fail "o envio dos logs de auditoria falhou"
  fi

  prune
  rm -rf "$WORK"
  mkdir -p "$STATE" && echo "$stamp" > "$STATE/last-success"
  log "cópia $stamp enviada e conferida"
}

# Keeps the KEEP most recent copies. Counted, never aged: if copies stop for a month, nothing is deleted.
prune() {
  kept=$(copies)
  count=$(printf '%s\n' "$kept" | grep -c . || true)
  excess=$((count - KEEP))
  [ "$excess" -gt 0 ] || return 0
  printf '%s\n' "$kept" | head -n "$excess" | while read -r old; do
    [ -n "$old" ] || continue
    rclone purge "$REMOTE/daily/$old" && log "cópia antiga removida: $old"
  done
}

# The copies kept, oldest first. A destination with no copy yet is an empty list, not an error.
copies() {
  { rclone lsf --dirs-only "$REMOTE/daily" 2>/dev/null || true; } | sed 's#/$##' | sort
}

latest() {
  copies | tail -n 1
}

cmd_list() {
  copies
}

# Downloads a copy and proves it can be restored: checksums, integrity, and what it holds.
fetch_and_check() {
  copy=$1
  dir="$WORK/restore-$copy"
  rm -rf "$dir" && mkdir -p "$dir"
  rclone copy "$REMOTE/daily/$copy" "$dir" || fail "não foi possível baixar a cópia $copy"
  [ -s "$dir/SHA256SUMS" ] || fail "a cópia $copy não existe ou está incompleta"
  (cd "$dir" && sha256sum -c SHA256SUMS >/dev/null) || fail "a cópia $copy não confere com o SHA256SUMS"
  gunzip -f "$dir/ledger.db.gz" "$dir/treasury.db.gz"
  check_db "$dir/ledger.db"
  check_db "$dir/treasury.db"
  log "cópia $copy íntegra: $(sqlite3 -readonly "$dir/ledger.db" 'SELECT count(*) FROM ledger_events;') eventos no Ledger, $(sqlite3 -readonly "$dir/treasury.db" "SELECT (SELECT count(*) FROM sqlite_master WHERE type='table') || ' tabelas';") no Treasury"
}

cmd_verify() {
  copy=${1:-$(latest)}
  [ -n "$copy" ] || fail "nenhuma cópia encontrada em $REMOTE/daily"
  fetch_and_check "$copy"
  rm -rf "$WORK"
}

# Replaces one live file. The current one, with its WAL, is kept aside: a restore never destroys anything.
put_in_place() {
  restored=$1 live=$2 stamp=$3
  owner=$(stat -c '%u:%g' "$live" 2>/dev/null || stat -c '%u:%g' "$(dirname "$live")")
  if [ -e "$live" ]; then
    for suffix in "" -wal -shm; do
      [ -e "$live$suffix" ] && mv "$live$suffix" "$live$suffix.before-restore-$stamp"
    done
  fi
  cp "$restored" "$live"
  chown "$owner" "$live"
  check_db "$live"
}

cmd_restore() {
  copy=${1:-}
  [ -n "$copy" ] || fail "uso: backup.sh restore <cópia> --services-stopped  (veja: backup.sh list)"
  [ "${2:-}" = "--services-stopped" ] || fail "pare o ledger e o treasury antes (docker compose stop ledger treasury) e repita com --services-stopped"
  fetch_and_check "$copy"
  stamp=$(date '+%Y-%m-%dT%H%M%S')
  put_in_place "$WORK/restore-$copy/ledger.db" "$LEDGER_DB" "$stamp"
  put_in_place "$WORK/restore-$copy/treasury.db" "$TREASURY_DB" "$stamp"
  rm -rf "$WORK"
  log "cópia $copy restaurada. Os arquivos anteriores ficaram com o sufixo .before-restore-$stamp. Suba os serviços de novo."
}

cmd_schedule() {
  cron=${BACKUP_CRON:-0 3 * * *}
  mkdir -p "$STATE"
  # A copy right away: a wrong credential shows up at deploy time, not the next morning.
  ( cmd_run ) || log "a primeira cópia falhou; o serviço fica unhealthy até uma cópia dar certo"
  echo "$cron /usr/local/bin/backup.sh run > /proc/1/fd/1 2>&1" > /etc/crontabs/root
  log "próximas cópias: '$cron' ($(date +%Z)), guardando as $KEEP mais recentes em $REMOTE/daily"
  exec crond -f -l 8
}

case "${1:-schedule}" in
  schedule) cmd_schedule ;;
  run) cmd_run ;;
  list) cmd_list ;;
  verify) cmd_verify "${2:-}" ;;
  restore) cmd_restore "${2:-}" "${3:-}" ;;
  *) fail "comando desconhecido: $1 (schedule | run | list | verify [cópia] | restore <cópia> --services-stopped)" ;;
esac
