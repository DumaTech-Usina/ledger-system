import { describe, it, expect } from "vitest";
import { ListPayablePositionsUseCase } from "../../../core/application/use-cases/ListPayablePositions";
import type { LedgerReadPort } from "../../../core/application/ports/LedgerReadPort";
import type { PositionItem, PositionsPage } from "../../../core/application/dtos/LedgerReadModels";

/**
 * The lists behind the "upcoming" and "overdue" cards.
 *
 * The property that matters most here is what does NOT happen: a payable whose establishing fact
 * stated no due date never appears under either heading. It has its own list, because the book can
 * neither call it late nor call it upcoming, and putting it in either would be publishing a claim
 * nobody made.
 */

const NOW = new Date("2026-08-07T12:00:00Z");

function position(over: Partial<PositionItem> & { objectId: string }): PositionItem {
  return {
    objectType: "payable",
    status: "open",
    outcome: "pending",
    currency: "BRL",
    totalOriginated: "1000.00",
    openBalance: "1000.00",
    eventCount: 1,
    lastEventAt: "2026-08-01T00:00:00.000Z",
    originatedAt: "2026-08-01T00:00:00.000Z",
    createdAt: "2026-08-01T00:00:00.000Z",
    dueAt: null,
    ...over,
  };
}

/** Answers every (objectType × status) query with the same set; the use case does the folding. */
function ledgerReturning(items: PositionItem[], overrides: Partial<LedgerReadPort> = {}): LedgerReadPort {
  let served = false;
  return {
    cashPosition: async () => { throw new Error("not used"); },
    cashMovements: async () => { throw new Error("not used"); },
    bookExposure: async () => { throw new Error("not used"); },
    positions: async (): Promise<PositionsPage> => {
      // Only the first query carries the rows, so a position is not counted once per object type.
      const data = served ? [] : items;
      served = true;
      return { data, total: data.length, page: 1, limit: 200, totalPages: 1 };
    },
    ...overrides,
  } as LedgerReadPort;
}

describe("ListPayablePositions", () => {
  it("splits outstanding payables into overdue, upcoming and undated", async () => {
    const ledger = ledgerReturning([
      position({ objectId: "late", dueAt: "2026-08-05T00:00:00.000Z" }),
      position({ objectId: "soon", dueAt: "2026-08-30T00:00:00.000Z" }),
      position({ objectId: "untold", dueAt: null }),
    ]);

    const result = await new ListPayablePositionsUseCase(ledger).execute(NOW);

    expect(result.overdue.map((p) => p.objectId)).toEqual(["late"]);
    expect(result.upcoming.map((p) => p.objectId)).toEqual(["soon"]);
    expect(result.undated.map((p) => p.objectId)).toEqual(["untold"]);
  });

  it("orders each list by nearest deadline first, across the stitched queries", async () => {
    const ledger = ledgerReturning([
      position({ objectId: "far", dueAt: "2026-12-01T00:00:00.000Z" }),
      position({ objectId: "near", dueAt: "2026-08-10T00:00:00.000Z" }),
      position({ objectId: "middle", dueAt: "2026-09-15T00:00:00.000Z" }),
    ]);

    const result = await new ListPayablePositionsUseCase(ledger).execute(NOW);

    expect(result.upcoming.map((p) => p.objectId)).toEqual(["near", "middle", "far"]);
  });

  it("drops a position with nothing outstanding — a paid obligation is not upcoming", async () => {
    const ledger = ledgerReturning([
      position({ objectId: "paid", dueAt: "2026-08-30T00:00:00.000Z", openBalance: "0.00" }),
    ]);

    const result = await new ListPayablePositionsUseCase(ledger).execute(NOW);

    expect(result.upcoming).toEqual([]);
    expect(result.overdue).toEqual([]);
  });

  it("drops a position whose balance is unknown: it is not zero, and it is not summable either", async () => {
    const ledger = ledgerReturning([
      position({ objectId: "orphan", dueAt: "2026-08-05T00:00:00.000Z", openBalance: null }),
    ]);

    const result = await new ListPayablePositionsUseCase(ledger).execute(NOW);

    expect(result.overdue).toEqual([]);
  });

  it("asks the Ledger for the due-date order rather than sorting a page it did not choose", async () => {
    const calls: unknown[] = [];
    const ledger = ledgerReturning([], {
      positions: async (params) => {
        calls.push(params);
        return { data: [], total: 0, page: 1, limit: 200, totalPages: 1 };
      },
    });

    await new ListPayablePositionsUseCase(ledger).execute(NOW);

    expect(calls).toHaveLength(10); // 5 payable object types × 2 open statuses
    expect(calls.every((c) => (c as { sortBy: string }).sortBy === "dueAt")).toBe(true);
  });

  it("reports truncation instead of presenting a capped list as the whole book", async () => {
    const many = Array.from({ length: 200 }, (_, i) =>
      position({ objectId: `p-${i}`, dueAt: "2026-08-30T00:00:00.000Z" }),
    );
    const ledger = ledgerReturning(many);

    const result = await new ListPayablePositionsUseCase(ledger).execute(NOW);

    expect(result.truncated).toBe(true);
  });

  it("reports unavailable, never three empty lists, when the Ledger cannot be reached", async () => {
    const ledger = ledgerReturning([], {
      positions: async () => { throw new Error("ledger down"); },
    });

    const result = await new ListPayablePositionsUseCase(ledger).execute(NOW);

    expect(result.available).toBe(false);
  });
});
