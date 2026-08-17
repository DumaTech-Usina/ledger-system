import { describe, expect, it } from "vitest";
import { parseInstant, toInstantISO } from "../../../core/application/utils/instant";

/**
 * The day the CFO types, and the instant the Ledger ends up recording.
 *
 * This is the boundary that matters: Treasury converts an answer into an ISO string WITH an
 * explicit offset, and the Ledger honours what it is sent rather than second-guessing it. So if the
 * day is misread here, it is misread in the book, permanently — the Ledger has no way to tell an
 * intentional midnight-UTC from an accident.
 *
 * The assertions are invariants of the configured zone, not a fixed offset, so they hold under
 * whatever TZ a developer or CI runner exports.
 */
describe("reading a typed date", () => {
  it("keeps the day that was written", () => {
    // `new Date("2026-09-14")` resolves against UTC no matter the process timezone. Anywhere west
    // of Greenwich that is the previous day — in São Paulo, 21:00 on the 13th.
    const parsed = parseInstant("2026-09-14");

    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(8); // September
    expect(parsed.getDate()).toBe(14);
    expect(parsed.getHours()).toBe(0);
  });

  it("sends the Ledger an instant that reads back as the same day here", () => {
    const sent = toInstantISO("2026-09-14");

    // What travels is UTC, as it should be — an instant is an instant. What matters is that reading
    // it back in the usina's zone gives the day the CFO meant.
    expect(sent.endsWith("Z")).toBe(true);
    expect(new Date(sent).getDate()).toBe(14);
    expect(new Date(sent).getHours()).toBe(0);
  });

  it("leaves an answer that already carries a time alone", () => {
    expect(toInstantISO("2026-09-14T10:00:00Z")).toBe("2026-09-14T10:00:00.000Z");
    expect(toInstantISO("2026-09-14T10:00:00-03:00")).toBe("2026-09-14T13:00:00.000Z");
    // No offset stated: read in the usina's zone, which is the point of setting one.
    expect(parseInstant("2026-09-14T10:00:00").getHours()).toBe(10);
  });

  it("tolerates the whitespace a text answer arrives with", () => {
    expect(parseInstant("  2026-09-14  ").getDate()).toBe(14);
  });
});
