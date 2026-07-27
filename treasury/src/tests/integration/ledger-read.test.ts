import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "http";
import { AddressInfo } from "net";
import { HttpLedgerReadAdapter } from "../../infra/ledger-read/HttpLedgerReadAdapter";
import { StubLedgerReadAdapter } from "../../infra/ledger-read/StubLedgerReadAdapter";
import { GetTreasuryDashboardUseCase } from "../../core/application/use-cases/GetTreasuryDashboard";
import type { LedgerReadPort } from "../../core/application/ports/LedgerReadPort";

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
        openReceivables: "250.00", contingentExposure: "0.00", currency: "BRL",
        asOf: "2026-07-09T00:00:00.000Z",
      }));
    } else if (path === "/api/cash-movements") {
      res.end(JSON.stringify({
        items: [{ eventId: "e1", occurredAt: "2026-07-09T00:00:00.000Z", effect: "cash_in", amount: "1000.00", sourceReference: "charge:1", description: "x" }],
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
    const mv = await adapter.cashMovements({ partyId: "party-usina" });
    expect(mv.items[0].effect).toBe("cash_in");
    const pos = await adapter.positions();
    expect(pos.total).toBe(1);
    expect(pos.data[0]).toHaveProperty("openBalance", "1000.00");
    expect(pos.data[0]).not.toHaveProperty("allocationGap"); // trimmed to displayed fields
  });

  it("sends the service token as a Bearer credential when configured", async () => {
    const adapter = new HttpLedgerReadAdapter(baseUrl, "read-tkn");
    await adapter.cashPosition();
    expect(lastAuth).toBe("Bearer read-tkn");
  });
});

describe("GetTreasuryDashboardUseCase", () => {
  it("composes an available dashboard from Ledger reads", async () => {
    const uc = new GetTreasuryDashboardUseCase(new HttpLedgerReadAdapter(baseUrl), "party-usina");
    const d = await uc.execute();
    expect(d.available).toBe(true);
    expect(d.cashPosition?.currency).toBe("BRL");
    expect(d.movements?.length).toBe(1);
    expect(d.positions?.length).toBe(1);
  });

  it("degrades to available:false when the Ledger is unreachable", async () => {
    const failing: LedgerReadPort = {
      cashPosition: () => Promise.reject(new Error("down")),
      cashMovements: () => Promise.reject(new Error("down")),
      positions: () => Promise.reject(new Error("down")),
    };
    const d = await new GetTreasuryDashboardUseCase(failing, "party-usina").execute();
    expect(d).toEqual({
      available: false,
      cashPosition: null,
      movements: null,
      positions: null,
      classificationHealth: null,
      period: null,
    });
  });

  it("stub adapter returns representative data", async () => {
    const d = await new GetTreasuryDashboardUseCase(new StubLedgerReadAdapter(), "party-usina").execute();
    expect(d.available).toBe(true);
    expect(Number(d.cashPosition?.totalCashIn)).toBeGreaterThan(0);
  });
});
