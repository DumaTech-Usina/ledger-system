/**
 * Audit log reader — for engineers and developers only.
 *
 * Usage:
 *   npx tsx src/infra/tools/read-audit.ts [options]
 *
 * Options:
 *   --date      YYYY-MM-DD   Read a single day (default: today)
 *   --from      YYYY-MM-DD   Start of date range (inclusive)
 *   --to        YYYY-MM-DD   End of date range (inclusive, default: today)
 *   --action    LEDGER_EVENT_CREATED | STAGING_RECORD_REJECTED
 *   --source    Filter by sourceSystem
 *   --format    pretty | json (default: pretty)
 *   --dir       Path to audit log directory (default: ./logs/audit)
 */

import * as fs from "fs";
import * as path from "path";
import { AuditEntry } from "../../core/application/services/IAuditLogger";

// ── Arg parsing ───────────────────────────────────────────────────────────────

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

const logDir = arg("dir") ?? "./logs/audit";
const format = arg("format") ?? "pretty";
const filterAction = arg("action");
const filterSource = arg("source");

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateRange(): string[] {
  const single = arg("date");
  if (single) return [single];

  const from = arg("from") ?? today();
  const to = arg("to") ?? today();

  const dates: string[] = [];
  const cursor = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");

  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

// ── Reading ───────────────────────────────────────────────────────────────────

function readDay(date: string): AuditEntry[] {
  const filePath = path.join(logDir, `${date}.log`);

  if (!fs.existsSync(filePath)) return [];

  return fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      try {
        return JSON.parse(line) as AuditEntry;
      } catch {
        return null;
      }
    })
    .filter((entry): entry is AuditEntry => entry !== null);
}

// ── Filtering ─────────────────────────────────────────────────────────────────

function matches(entry: AuditEntry): boolean {
  if (filterAction && entry.action !== filterAction) return false;
  if (filterSource && entry.sourceSystem !== filterSource) return false;
  return true;
}

// ── Formatting ────────────────────────────────────────────────────────────────

const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";

function prettyPrint(entry: AuditEntry): void {
  const color = entry.action === "LEDGER_EVENT_CREATED" ? GREEN : RED;
  const label = entry.action === "LEDGER_EVENT_CREATED" ? "CREATED" : "REJECTED";
  const ts = `${DIM}${entry.timestamp}${RESET}`;

  process.stdout.write(`${color}[${label}]${RESET} ${ts}\n`);

  if (entry.action === "LEDGER_EVENT_CREATED") {
    process.stdout.write(
      `  ${CYAN}event${RESET}   ${entry.eventId}\n` +
      `  ${CYAN}type${RESET}    ${entry.eventType}  ${DIM}(${entry.economicEffect})${RESET}\n` +
      `  ${CYAN}source${RESET}  ${entry.sourceSystem} / ${entry.sourceReference}\n`,
    );
    if (entry.commandId) {
      process.stdout.write(`  ${CYAN}cmd${RESET}     ${entry.commandId}\n`);
    }
  } else {
    process.stdout.write(
      `  ${CYAN}staging${RESET} ${entry.stagingId}\n` +
      `  ${CYAN}source${RESET}  ${entry.sourceSystem}\n` +
      `  ${CYAN}reasons${RESET} ${(entry.reasons ?? []).join(" | ")}\n`,
    );
  }

  process.stdout.write("\n");
}

// ── Main ──────────────────────────────────────────────────────────────────────

const dates = dateRange();
let total = 0;

for (const date of dates) {
  const entries = readDay(date).filter(matches);

  if (entries.length === 0) continue;

  if (format === "pretty") {
    process.stdout.write(`${"─".repeat(60)}\n  ${date}\n${"─".repeat(60)}\n\n`);
  }

  for (const entry of entries) {
    if (format === "json") {
      process.stdout.write(JSON.stringify(entry) + "\n");
    } else {
      prettyPrint(entry);
    }
    total++;
  }
}

if (format === "pretty") {
  process.stdout.write(`${"─".repeat(60)}\n  ${total} entries\n`);
}
