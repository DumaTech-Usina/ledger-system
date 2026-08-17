import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { parseInstant, parseOptionalInstant } from "../../../core/application/utils/instant";
import { env } from "../../../config/env";

/**
 * How a written date becomes an instant.
 *
 * The book is kept in the usina's timezone (America/Sao_Paulo by default) and stores instants in
 * UTC. Those are two different statements and both matter: the first decides what a caller MEANT,
 * the second decides how it is written down. These cases pin the first, because it is the one that
 * silently depended on where the process happened to run.
 *
 * The parsing cases below assert INVARIANTS rather than a fixed offset — "the day that was written,
 * at midnight, in the configured zone" — so they hold under any TZ a developer or a CI runner
 * happens to export. The default itself is checked separately, in a process that exports none.
 */
describe("the book's timezone", () => {
  it("defaults to São Paulo when the environment names none", () => {
    // Run with TZ genuinely absent — this is the only way to observe the default, since an exported
    // TZ (a CI runner's `TZ=UTC`, say) legitimately overrides it and would mask the assertion.
    const script =
      'const { env } = require("./src/config/env");' +
      'console.log(JSON.stringify({ env: env.TZ, process: process.env.TZ,' +
      ' zone: Intl.DateTimeFormat().resolvedOptions().timeZone,' +
      ' bareDate: new Date("2026-09-14T00:00:00").toISOString() }));';

    const environment = { ...process.env };
    delete environment.TZ;

    const output = execFileSync(
      process.execPath,
      ["--import", "tsx", "-e", script],
      { env: environment, encoding: "utf8", cwd: process.cwd() },
    );
    const result = JSON.parse(output.trim().split("\n").pop() as string);

    expect(result.env).toBe("America/Sao_Paulo");
    // Applied to the PROCESS, not merely parsed into a config object — the point is that `new Date`
    // behaves this way everywhere, including in code that never reads `env`.
    expect(result.process).toBe("America/Sao_Paulo");
    expect(result.zone).toBe("America/Sao_Paulo");
    // UTC-03:00 year round: Brazil ended daylight saving in 2019.
    expect(result.bareDate).toBe("2026-09-14T03:00:00.000Z");
  });

  it("lets the environment override it — the zone is the business's, not this code's", () => {
    // Whatever the runner exported is what the app adopted, default or not.
    expect(process.env.TZ).toBe(env.TZ);
  });
});

describe("parseInstant", () => {
  it("reads a bare date as midnight in the book's timezone, not in UTC", () => {
    // The regression this exists for. ECMAScript resolves a date-only string against UTC no matter
    // what the process timezone is, which anywhere west of Greenwich puts it on the PREVIOUS day —
    // in São Paulo, at 21:00 on the 13th. A due date entered as the 14th would then age as if it
    // fell on the 13th, and an invoice would read as overdue a day early.
    const parsed = parseInstant("2026-09-14");

    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(8); // September
    expect(parsed.getDate()).toBe(14); // the day that was written, not the one before
    expect(parsed.getHours()).toBe(0);
    expect(parsed.getMinutes()).toBe(0);

    // Identical to naming the midnight explicitly, which is the whole of the fix.
    expect(parsed.getTime()).toBe(new Date("2026-09-14T00:00:00").getTime());
  });

  it("reads a time without an offset in the book's timezone", () => {
    const parsed = parseInstant("2026-09-14T10:00:00");
    expect(parsed.getHours()).toBe(10);
    expect(parsed.getDate()).toBe(14);
  });

  it("never overrides an offset the caller stated", () => {
    // An explicit offset is the caller being unambiguous, and it is honoured as written — including
    // when it is not the book's own. Re-reading it in São Paulo would discard what was said.
    expect(parseInstant("2026-09-14T10:00:00Z").toISOString()).toBe("2026-09-14T10:00:00.000Z");
    expect(parseInstant("2026-09-14T10:00:00-03:00").toISOString()).toBe("2026-09-14T13:00:00.000Z");
    expect(parseInstant("2026-09-14T10:00:00+02:00").toISOString()).toBe("2026-09-14T08:00:00.000Z");
  });

  it("does not treat a timezone as a validity rule", () => {
    // Deciding WHICH instant a string denotes is this function's whole job; deciding whether the
    // caller was allowed to send it belongs to the validators, which reject it and say why.
    expect(isNaN(parseInstant("not a date").getTime())).toBe(true);
  });

  it("keeps absent optional instants absent", () => {
    // Null is not "midnight today". A due date that was never stated stays unstated.
    expect(parseOptionalInstant(null)).toBeNull();
    expect(parseOptionalInstant(undefined)).toBeNull();
    expect(parseOptionalInstant("")).toBeNull();
    expect(parseOptionalInstant("2026-09-14")?.getDate()).toBe(14);
  });

  it("round-trips through the stored form without moving the instant", () => {
    // Storage is UTC; the timezone decided what was meant, and after that the two agree forever.
    const parsed = parseInstant("2026-09-14");
    const stored = parsed.toISOString();
    expect(new Date(stored).getTime()).toBe(parsed.getTime());
    expect(new Date(stored).getDate()).toBe(14);
  });
});
