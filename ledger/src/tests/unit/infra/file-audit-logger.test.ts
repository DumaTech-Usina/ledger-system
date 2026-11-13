import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FileAuditLogger } from "../../../infra/audit/FileAuditLogger";
import type { AuditEntry } from "../../../core/application/services/IAuditLogger";

// The Ledger's audit trail on disk: one file per UTC day, one JSON line per entry. Writing it must never
// block the caller — a fact the Ledger accepted stays accepted even if its audit line could not be written.

const entry = (eventId: string): AuditEntry => ({
  action: "LEDGER_EVENT_CREATED",
  timestamp: "2026-11-13T12:00:00.000Z",
  sourceSystem: "treasury",
  eventId,
  eventType: "commission_received",
  economicEffect: "cash_in",
  sourceReference: `ref-${eventId}`,
  commandId: null,
});

describe("FileAuditLogger", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "ledger-audit-"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("creates the log directory when it does not exist", () => {
    const logDir = path.join(dir, "nested", "audit");
    new FileAuditLogger(logDir);
    expect(fs.existsSync(logDir)).toBe(true);
  });

  it("appends one JSON line per entry to the file of the current UTC day", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-13T23:30:00.000Z"), toFake: ["Date"] });
    const logger = new FileAuditLogger(dir);

    await logger.log(entry("evt-1"));
    await logger.log(entry("evt-2"));

    const lines = fs.readFileSync(path.join(dir, "2026-11-13.log"), "utf8").trim().split("\n");
    expect(lines.map((l) => JSON.parse(l).eventId)).toEqual(["evt-1", "evt-2"]);
  });

  it("starts a new file when the UTC day changes, without touching the previous one", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-13T23:59:00.000Z"), toFake: ["Date"] });
    const logger = new FileAuditLogger(dir);
    await logger.log(entry("evt-1"));

    vi.setSystemTime(new Date("2026-11-14T00:01:00.000Z"));
    await logger.log(entry("evt-2"));

    expect(fs.readFileSync(path.join(dir, "2026-11-13.log"), "utf8").trim().split("\n")).toHaveLength(1);
    expect(JSON.parse(fs.readFileSync(path.join(dir, "2026-11-14.log"), "utf8")).eventId).toBe("evt-2");
  });

  it("never throws when the entry cannot be written, and reports the failure on stderr", async () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const logger = new FileAuditLogger(dir);
    fs.rmSync(dir, { recursive: true, force: true }); // the directory vanished after start-up

    await expect(logger.log(entry("evt-1"))).resolves.toBeUndefined();
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining("[FileAuditLogger] Failed to write audit entry"));
  });
});
