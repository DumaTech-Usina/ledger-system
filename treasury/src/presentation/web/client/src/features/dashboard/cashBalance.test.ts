import { describe, it, expect } from "vitest";
import { runningBalances } from "@/features/dashboard/cashBalance";
import type { CashMovement } from "@/types/dashboard";

function movement(over: Partial<CashMovement> & { eventId: string }): CashMovement {
  return {
    occurredAt: "2026-01-01T00:00:00.000Z",
    recordedAt: "2026-01-01T00:00:00.000Z",
    effect: "cash_in",
    amount: "0.00",
    sourceReference: "ref",
    counterparty: null,
    description: null,
    ...over,
  };
}

describe("runningBalances", () => {
  it("carries the balance forward through cash in and cash out", () => {
    const balances = runningBalances([
      movement({ eventId: "a", occurredAt: "2026-01-01T00:00:00.000Z", effect: "cash_in", amount: "1000.00" }),
      movement({ eventId: "b", occurredAt: "2026-01-02T00:00:00.000Z", effect: "cash_in", amount: "500.00" }),
      movement({ eventId: "c", occurredAt: "2026-01-03T00:00:00.000Z", effect: "cash_out", amount: "200.00" }),
    ]);

    expect(balances.get("a")).toBe("1000.00");
    expect(balances.get("b")).toBe("1500.00");
    expect(balances.get("c")).toBe("1300.00");
  });

  it("accumulates chronologically no matter which order the caller holds them in", () => {
    // The dashboard's two sources disagree on ordering, so the result must not depend on it.
    const rows = [
      movement({ eventId: "c", occurredAt: "2026-01-03T00:00:00.000Z", effect: "cash_out", amount: "200.00" }),
      movement({ eventId: "a", occurredAt: "2026-01-01T00:00:00.000Z", effect: "cash_in", amount: "1000.00" }),
      movement({ eventId: "b", occurredAt: "2026-01-02T00:00:00.000Z", effect: "cash_in", amount: "500.00" }),
    ];

    const balances = runningBalances(rows);

    expect(balances.get("a")).toBe("1000.00");
    expect(balances.get("b")).toBe("1500.00");
    expect(balances.get("c")).toBe("1300.00");
  });

  it("opens from the balance the caller states, not from zero", () => {
    const balances = runningBalances(
      [movement({ eventId: "a", effect: "cash_in", amount: "500.00" })],
      "1000.00",
    );

    expect(balances.get("a")).toBe("1500.00");
  });

  it("leaves the balance where it was for a movement that moved no cash", () => {
    const balances = runningBalances([
      movement({ eventId: "a", occurredAt: "2026-01-01T00:00:00.000Z", effect: "cash_in", amount: "1000.00" }),
      movement({ eventId: "b", occurredAt: "2026-01-02T00:00:00.000Z", effect: "non_cash", amount: "750.00" }),
      movement({ eventId: "c", occurredAt: "2026-01-03T00:00:00.000Z", effect: "contingent", amount: "900.00" }),
    ]);

    // The rows still carry a balance — it just did not change, which is what happened.
    expect(balances.get("b")).toBe("1000.00");
    expect(balances.get("c")).toBe("1000.00");
  });

  it("goes negative rather than clamping", () => {
    const balances = runningBalances([
      movement({ eventId: "a", occurredAt: "2026-01-01T00:00:00.000Z", effect: "cash_in", amount: "100.00" }),
      movement({ eventId: "b", occurredAt: "2026-01-02T00:00:00.000Z", effect: "cash_out", amount: "250.00" }),
    ]);

    expect(balances.get("b")).toBe("-150.00");
  });

  it("adds cents exactly, without floating-point drift", () => {
    const balances = runningBalances([
      movement({ eventId: "a", occurredAt: "2026-01-01T00:00:00.000Z", effect: "cash_in", amount: "0.10" }),
      movement({ eventId: "b", occurredAt: "2026-01-02T00:00:00.000Z", effect: "cash_in", amount: "0.20" }),
    ]);

    expect(balances.get("b")).toBe("0.30");
  });

  it("reports the balance as unknown from the first amount it cannot read onward", () => {
    const balances = runningBalances([
      movement({ eventId: "a", occurredAt: "2026-01-01T00:00:00.000Z", effect: "cash_in", amount: "1000.00" }),
      movement({ eventId: "b", occurredAt: "2026-01-02T00:00:00.000Z", effect: "cash_in", amount: "not a number" }),
      movement({ eventId: "c", occurredAt: "2026-01-03T00:00:00.000Z", effect: "cash_in", amount: "50.00" }),
    ]);

    expect(balances.get("a")).toBe("1000.00");
    // Never the previous total: that would state the unreadable movement was worth nothing.
    expect(balances.get("b")).toBeNull();
    expect(balances.get("c")).toBeNull();
  });

  it("has nothing to say about an empty list", () => {
    expect(runningBalances([]).size).toBe(0);
  });
});
