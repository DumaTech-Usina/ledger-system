import { describe, it, expect } from "vitest";
import { GetBookExposureUseCase } from "../../../core/application/use-cases/GetBookExposure";
import { ListPositionsUseCase } from "../../../core/application/use-cases/ListPositions";
import type { LedgerReadPort } from "../../../core/application/ports/LedgerReadPort";
import type { BookExposure, PositionsPage } from "../../../core/application/dtos/LedgerReadModels";

const exposure: BookExposure = {
  currency: "BRL",
  openExposure: "7800.00",
  openPayableExposure: "5000.00",
  overduePayable: "1200.00",
  upcomingPayable: "2300.00",
  undatedPayable: "1500.00",
  capitalAtRisk: "7000.00",
  healthScore: {
    score: 62.5,
    label: "at_risk",
    trend: "down",
    trendDelta: -4.2,
    closureQuality: 0.71,
    openBookHealth: 0.1,
    windowDays: 90,
  },
};

const emptyPage: PositionsPage = { data: [], total: 0, page: 1, limit: 20, totalPages: 1 };

/** A port that answers only what the use case under test asks for. */
function ledger(over: Partial<LedgerReadPort>): LedgerReadPort {
  return {
    cashPosition: () => Promise.reject(new Error("not used")),
    cashMovements: () => Promise.reject(new Error("not used")),
    positions: async () => emptyPage,
    bookExposure: async () => exposure,
    ...over,
  };
}

describe("GetBookExposureUseCase", () => {
  it("passes the Ledger's own figures through untouched", async () => {
    const result = await new GetBookExposureUseCase(ledger({})).execute();
    expect(result.available).toBe(true);
    expect(result.exposure).toEqual(exposure);
  });

  it("reports unavailable when the Ledger cannot be reached — never zero exposure", async () => {
    // Zeroes would read as a healthy book. Unknown has to stay unknown.
    const result = await new GetBookExposureUseCase(
      ledger({ bookExposure: () => Promise.reject(new Error("down")) }),
    ).execute();
    expect(result).toEqual({ available: false, exposure: null });
  });
});

describe("ListPositionsUseCase", () => {
  it("asks the Ledger for the requested page and forwards the filters", async () => {
    let asked: unknown;
    const uc = new ListPositionsUseCase(
      ledger({
        positions: async (params) => {
          asked = params;
          return emptyPage;
        },
      }),
    );
    await uc.execute({ page: 3, status: "open", objectType: "advance" });
    expect(asked).toEqual({ page: 3, limit: 20, status: "open", objectType: "advance" });
  });

  it("falls back to the first page for a missing or nonsensical page number", async () => {
    const seen: number[] = [];
    const uc = new ListPositionsUseCase(
      ledger({
        positions: async (params) => {
          seen.push(params?.page as number);
          return emptyPage;
        },
      }),
    );
    await uc.execute();
    await uc.execute({ page: 0 });
    await uc.execute({ page: -2 });
    expect(seen).toEqual([1, 1, 1]);
  });

  it("returns the Ledger's own paging, without slicing anything of its own", async () => {
    const page: PositionsPage = { data: [], total: 57, page: 2, limit: 20, totalPages: 3 };
    const result = await new ListPositionsUseCase(ledger({ positions: async () => page })).execute({ page: 2 });
    expect(result.page).toEqual(page);
  });

  it("reports unavailable when the Ledger cannot be reached", async () => {
    const result = await new ListPositionsUseCase(
      ledger({ positions: () => Promise.reject(new Error("down")) }),
      "party-usina",
    ).execute({ partyId: ["acme"] });

    // The page is unknown. What was ASKED for is not — and neither is which side is ours, so both
    // survive the failure. Only the answer is missing.
    expect(result).toEqual({
      available: false,
      page: null,
      selectedParties: ["acme"],
      selfPartyId: "party-usina",
    });
  });

  it("forwards the party selection and echoes it back for the screen to highlight", async () => {
    let asked: unknown;
    const result = await new ListPositionsUseCase(
      ledger({
        positions: async (params) => {
          asked = params;
          return { data: [], total: 0, page: 1, limit: 20, totalPages: 1 };
        },
      }),
      "party-usina",
    ).execute({ partyId: ["acme", "banco-xpto"] });

    expect((asked as { partyId: string[] }).partyId).toEqual(["acme", "banco-xpto"]);
    // Echoed, not derived: the screen marks these among each position's parties instead of
    // replacing them, so a position settled by a third party still shows who else took part.
    expect(result.selectedParties).toEqual(["acme", "banco-xpto"]);
    expect(result.selfPartyId).toBe("party-usina");
  });
});
