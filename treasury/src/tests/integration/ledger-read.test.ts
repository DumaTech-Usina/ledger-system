import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "http";
import { AddressInfo } from "net";
import { HttpLedgerReadAdapter } from "../../infra/ledger-read/HttpLedgerReadAdapter";
import { StubLedgerReadAdapter } from "../../infra/ledger-read/StubLedgerReadAdapter";
import { GetTreasuryDashboardUseCase } from "../../core/application/use-cases/GetTreasuryDashboard";
import type { LedgerReadPort } from "../../core/application/ports/LedgerReadPort";
import type { PartyDirectoryPort } from "../../core/application/ports/PartyDirectoryPort";
import { PARTY, PARTY_DISPLAY_NAMES, emptyPartyDirectory, partyDirectory } from "../fixtures/parties";

// A fake Ledger returning its real read-API shapes.
let server: Server;
let baseUrl: string;
let lastAuth: string | undefined;

beforeAll(async () => {
  server = createServer((req, res) => {
    lastAuth = req.headers["authorization"] as string | undefined;
    res.setHeader("content-type", "application/json");
    const path = (req.url || "").split("?")[0];
    if (path === "/api/cash-position") {
      res.end(JSON.stringify({
        totalCashIn: "1000.00", totalCashOut: "400.00", netCashFlow: "+600.00",
        openReceivables: "250.00", openPayables: "180.00", contingentExposure: "0.00",
        openReceivablesByType: [{ objectType: "loan", openBalance: "250.00" }],
        openPayablesByType: [
          { objectType: "payroll", openBalance: "150.00" },
          { objectType: "tax", openBalance: "30.00" },
        ],
        contingentExposureByType: [],
        currency: "BRL",
        asOf: "2026-07-09T00:00:00.000Z",
      }));
    } else if (path === "/api/cash-movements") {
      res.end(JSON.stringify({
        items: [{
          eventId: "e1", eventType: "commission_received",
          occurredAt: "2026-07-09T00:00:00.000Z", recordedAt: "2026-07-09T01:00:00.000Z",
          effect: "cash_in", amount: "1000.00",
          sourceReference: "charge:1", sourceSystem: "treasury",
          objects: [{ objectId: "charge:1", objectType: "charge", relation: "settles" }],
          parties: [
            { partyId: PARTY.USINA, role: "recipient", direction: "in", amount: "1000.00" },
            { partyId: PARTY.OPERATOR, role: "payer", direction: "neutral", amount: null },
          ],
          counterparty: PARTY.OPERATOR, description: "x",
        }],
        nextCursor: null, hasMore: false,
      }));
    } else if (path === "/api/positions") {
      res.end(JSON.stringify({
        data: [{ objectId: "charge:1", objectType: "charge", status: "open", outcome: "pending", currency: "BRL", totalOriginated: "1000.00", totalSettled: "0.00", totalAdjusted: "0.00", openBalance: "1000.00", overSettlement: "0.00", cashRecovered: "0.00", nonCashClosed: "0.00", allocationGap: "0.00", eventCount: 1, lastEventAt: "2026-07-09T00:00:00.000Z", originatedAt: null }],
        total: 1, page: 1, limit: 8, totalPages: 1,
      }));
    } else {
      res.statusCode = 404;
      res.end("{}");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe("HttpLedgerReadAdapter", () => {
  it("reads and maps the Ledger read-API shapes", async () => {
    const adapter = new HttpLedgerReadAdapter(baseUrl);
    expect((await adapter.cashPosition()).netCashFlow).toBe("+600.00");
    const mv = await adapter.cashMovements({ partyId: PARTY.USINA });
    expect(mv.items[0].effect).toBe("cash_in");
    const pos = await adapter.positions();
    expect(pos.total).toBe(1);
    expect(pos.data[0]).toHaveProperty("openBalance", "1000.00");
    expect(pos.data[0]).not.toHaveProperty("allocationGap"); // trimmed to displayed fields
  });

  it("carries what each open-balance total is made of, without adding anything up", async () => {
    const cash = await new HttpLedgerReadAdapter(baseUrl).cashPosition();

    expect(cash.openPayables).toBe("180.00");
    expect(cash.openPayablesByType).toEqual([
      { objectType: "payroll", openBalance: "150.00" },
      { objectType: "tax", openBalance: "30.00" },
    ]);
    expect(cash.openReceivablesByType).toEqual([{ objectType: "loan", openBalance: "250.00" }]);
    // Published and empty: nothing contingent is outstanding. Distinct from absent, which would
    // mean the book did not say — and the screen keeps the two apart.
    expect(cash.contingentExposureByType).toEqual([]);
  });

  it("sends the service token as a Bearer credential when configured", async () => {
    const adapter = new HttpLedgerReadAdapter(baseUrl, "read-tkn");
    await adapter.cashPosition();
    expect(lastAuth).toBe("Bearer read-tkn");
  });
});

describe("GetTreasuryDashboardUseCase", () => {
  it("composes an available dashboard from Ledger reads", async () => {
    const uc = new GetTreasuryDashboardUseCase(new HttpLedgerReadAdapter(baseUrl), PARTY.USINA, partyDirectory());
    const d = await uc.execute();
    expect(d.available).toBe(true);
    expect(d.cashPosition?.currency).toBe("BRL");
    expect(d.movements?.length).toBe(1);
    expect(d.positions?.length).toBe(1);
  });

  it("names the counterparties on screen, without touching the movements themselves", async () => {
    const uc = new GetTreasuryDashboardUseCase(new HttpLedgerReadAdapter(baseUrl), PARTY.USINA, partyDirectory());
    const d = await uc.execute();
    // Every party the movement now carries, named beside it — never inside it.
    expect(d.partyNames).toEqual({
      [PARTY.USINA]: PARTY_DISPLAY_NAMES[PARTY.USINA],
      [PARTY.OPERATOR]: PARTY_DISPLAY_NAMES[PARTY.OPERATOR],
    });
    // The movement stays the Ledger's own shape: an id, never a name.
    expect(d.movements?.[0].counterparty).toBe(PARTY.OPERATOR);
    expect(d.movements?.[0]).not.toHaveProperty("counterpartyName");
  });

  it("passes through what a movement is about — the fact, its objects, its whole cast", async () => {
    const mv = await new HttpLedgerReadAdapter(baseUrl).cashMovements({ partyId: PARTY.USINA });
    const [movement] = mv.items;

    // `effect` said the economic nature and never which fact the movement was part of.
    expect(movement.eventType).toBe("commission_received");
    expect(movement.sourceSystem).toBe("treasury");
    expect(movement.objects).toEqual([{ objectId: "charge:1", objectType: "charge", relation: "settles" }]);
    expect(movement.parties?.map((p) => [p.partyId, p.direction])).toEqual([
      [PARTY.USINA, "in"],
      [PARTY.OPERATOR, "neutral"],
    ]);
    // The field that was already published keeps meaning what it meant.
    expect(movement.counterparty).toBe(PARTY.OPERATOR);
  });

  it("leaves a party the Directory does not know absent, so its id stays on screen", async () => {
    const uc = new GetTreasuryDashboardUseCase(new HttpLedgerReadAdapter(baseUrl), PARTY.USINA, emptyPartyDirectory());
    const d = await uc.execute();
    expect(d.partyNames).toEqual({});
    expect(d.movements?.[0].counterparty).toBe(PARTY.OPERATOR);
  });

  it("keeps the Ledger's figures when the Directory is down — names are legibility, not truth", async () => {
    const brokenDirectory: PartyDirectoryPort = {
      get: () => Promise.reject(new Error("directory down")),
      list: () => Promise.reject(new Error("directory down")),
      resolve: () => Promise.reject(new Error("directory down")),
    };
    const uc = new GetTreasuryDashboardUseCase(new HttpLedgerReadAdapter(baseUrl), PARTY.USINA, brokenDirectory);
    const d = await uc.execute();
    expect(d.available).toBe(true);
    expect(d.cashPosition?.currency).toBe("BRL");
    expect(d.partyNames).toEqual({});
  });

  it("degrades to available:false when the Ledger is unreachable", async () => {
    const failing: LedgerReadPort = {
      cashPosition: () => Promise.reject(new Error("down")),
      cashMovements: () => Promise.reject(new Error("down")),
      positions: () => Promise.reject(new Error("down")),
      bookExposure: () => Promise.reject(new Error("down")),
    };
    const d = await new GetTreasuryDashboardUseCase(failing, PARTY.USINA, partyDirectory()).execute();
    expect(d).toEqual({
      available: false,
      cashPosition: null,
      movements: null,
      positions: null,
      // Null paging, not an empty page: a zeroed page would state that the book holds nothing,
      // where the truth is that it could not be read at all.
      positionsPage: null,
      movementsCursor: null,
      movementsHasMore: false,
      movementsPaging: null,
      classificationHealth: null,
      partyNames: {},
    });
  });

  it("stub adapter returns representative data", async () => {
    const d = await new GetTreasuryDashboardUseCase(new StubLedgerReadAdapter(), PARTY.USINA, partyDirectory()).execute();
    expect(d.available).toBe(true);
    expect(Number(d.cashPosition?.totalCashIn)).toBeGreaterThan(0);
  });
});
