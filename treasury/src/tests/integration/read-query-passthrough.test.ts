import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import express from "express";
import { createServer, type Server } from "http";
import { AddressInfo } from "net";
import { HttpLedgerReadAdapter } from "../../infra/ledger-read/HttpLedgerReadAdapter";
import { GetTreasuryDashboardUseCase } from "../../core/application/use-cases/GetTreasuryDashboard";
import { GetObjectLifecycleUseCase } from "../../core/application/use-cases/GetObjectLifecycle";
import { GetBookExposureUseCase } from "../../core/application/use-cases/GetBookExposure";
import { ListPositionsUseCase } from "../../core/application/use-cases/ListPositions";
import { ListPayablePositionsUseCase } from "../../core/application/use-cases/ListPayablePositions";
import { ListCashMovementsUseCase } from "../../core/application/use-cases/ListCashMovements";
import { GetLedgerEventUseCase } from "../../core/application/use-cases/GetLedgerEvent";
import { dashboardRoutes } from "../../presentation/web/api/routes/dashboardRoutes";
import { PARTY, partyDirectory } from "../fixtures/parties";

/**
 * What the Ledger was actually asked. These tests are about the boundary treasury owns: a filter a
 * person chose must arrive at the Ledger unchanged, and one it did not choose must not be invented
 * on the way. Every figure still comes from the Ledger — nothing here recomputes anything.
 */
const asked: Record<string, URLSearchParams[]> = {};

function record(url: string) {
  const [path, query = ""] = url.split("?");
  (asked[path] ??= []).push(new URLSearchParams(query));
}

/** The last query the Ledger received for a path, or undefined if it was never called. */
function lastQuery(path: string): URLSearchParams | undefined {
  const calls = asked[path];
  return calls?.[calls.length - 1];
}

const POSITION = {
  objectId: "charge:1", objectType: "charge", status: "open", outcome: "pending", currency: "BRL",
  totalOriginated: "1000.00", totalSettled: "0.00", totalAdjusted: "0.00", openBalance: "1000.00",
  overSettlement: "0.00", cashRecovered: "0.00", nonCashClosed: "0.00", allocationGap: "0.00",
  eventCount: 1, lastEventAt: "2026-07-09T00:00:00.000Z", originatedAt: null,
  createdAt: "2026-07-09T00:00:00.000Z", dueAt: null,
  parties: ["party-usina", "acme"],
};

const MOVEMENT = {
  eventId: "e1", eventType: "commission_received",
  occurredAt: "2026-07-09T00:00:00.000Z", recordedAt: "2026-07-09T01:00:00.000Z",
  effect: "cash_in", amount: "1000.00", sourceReference: "charge:1", sourceSystem: "treasury",
  objects: [], parties: [], counterparty: PARTY.OPERATOR, description: "x",
};

let ledger: Server;
let ledgerUrl: string;
let api: Server;
let apiUrl: string;

beforeAll(async () => {
  ledger = createServer((req, res) => {
    const url = req.url || "";
    record(url);
    const path = url.split("?")[0];
    res.setHeader("content-type", "application/json");
    if (path === "/api/cash-position") {
      res.end(JSON.stringify({
        totalCashIn: "1000.00", totalCashOut: "400.00", netCashFlow: "+600.00",
        openReceivables: "250.00", contingentExposure: "0.00", currency: "BRL",
        asOf: "2026-07-09T00:00:00.000Z",
      }));
    } else if (path === "/api/cash-movements") {
      res.end(JSON.stringify({
        items: [MOVEMENT], nextCursor: "cursor-2", hasMore: true,
        total: null, page: null, totalPages: null,
      }));
    } else if (path === "/api/positions") {
      res.end(JSON.stringify({ data: [POSITION], total: 1, page: 1, limit: 20, totalPages: 1 }));
    } else if (path === "/api/dashboard") {
      res.end(JSON.stringify({
        currency: "BRL",
        period: { from: "2026-06-01T00:00:00.000Z", to: "2026-06-30T00:00:00.000Z" },
        cashIn: "1000.00", cashOut: "400.00", netCash: "600.00", netCashNegative: false,
        cashInByType: { commission_received: "1000.00" }, cashOutByType: {},
        openExposure: "250.00", openPayableExposure: "180.00",
        overduePayable: "0.00", upcomingPayable: "180.00", undatedPayable: "0.00",
        capitalAtRisk: "0.00",
        healthScore: { score: 80, label: "good", trend: "flat", trendDelta: 0, closureQuality: 1, openBookHealth: 1, windowDays: 30 },
      }));
    } else {
      res.statusCode = 404;
      res.end("{}");
    }
  });
  await new Promise<void>((resolve) => ledger.listen(0, resolve));
  ledgerUrl = `http://127.0.0.1:${(ledger.address() as AddressInfo).port}`;

  const read = new HttpLedgerReadAdapter(ledgerUrl);
  const app = express().use(
    "/api/dashboard",
    dashboardRoutes(
      new GetTreasuryDashboardUseCase(read, PARTY.USINA, partyDirectory()),
      new GetObjectLifecycleUseCase(read, partyDirectory()),
      new GetBookExposureUseCase(read),
      new ListPositionsUseCase(read, PARTY.USINA),
      new ListPayablePositionsUseCase(read),
      new ListCashMovementsUseCase(read),
      new GetLedgerEventUseCase(read),
    ),
  );
  api = app.listen(0);
  await new Promise<void>((resolve) => api.once("listening", () => resolve()));
  apiUrl = `http://127.0.0.1:${(api.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => ledger.close(() => resolve()));
  await new Promise<void>((resolve) => api.close(() => resolve()));
});

beforeEach(() => {
  for (const key of Object.keys(asked)) delete asked[key];
});

const get = (path: string) => fetch(`${apiUrl}${path}`);
/** The route's payload. Typed loosely on purpose: these tests assert shape, not the DTO. */
const json = async (path: string): Promise<Record<string, any>> =>
  (await get(path)).json() as Promise<Record<string, any>>;

describe("GET /api/dashboard/positions — what reaches the Ledger", () => {
  it("per_page becomes the Ledger's limit", async () => {
    await get("/api/dashboard/positions?per_page=50");
    expect(lastQuery("/api/positions")?.get("limit")).toBe("50");
  });

  it("an absurd per_page is clamped to the Ledger's cap rather than round-tripped", async () => {
    await get("/api/dashboard/positions?per_page=5000");
    expect(lastQuery("/api/positions")?.get("limit")).toBe("200");
  });

  it("no per_page keeps the established page size of 20", async () => {
    await get("/api/dashboard/positions");
    expect(lastQuery("/api/positions")?.get("limit")).toBe("20");
  });

  it("several object types travel as several values, comma or repeated", async () => {
    await get("/api/dashboard/positions?objectType=payroll,tax");
    expect(lastQuery("/api/positions")?.getAll("objectType")).toEqual(["payroll", "tax"]);

    await get("/api/dashboard/positions?status=open&status=partially_settled");
    expect(lastQuery("/api/positions")?.getAll("status")).toEqual(["open", "partially_settled"]);
  });

  it("outcome, sort and period are forwarded as written", async () => {
    await get("/api/dashboard/positions?outcome=gain&sortBy=dueAt&sortOrder=ASC&from=2026-01-01&to=2026-02-01");
    const q = lastQuery("/api/positions")!;

    expect(q.get("outcome")).toBe("gain");
    expect(q.get("sortBy")).toBe("dueAt");
    expect(q.get("sortOrder")).toBe("ASC");
    expect(q.get("from")).toBe("2026-01-01");
    expect(q.get("to")).toBe("2026-02-01");
  });

  it("counterparty and partyId ask the Ledger the same thing", async () => {
    await get("/api/dashboard/positions?counterparty=acme,banco-xpto");
    expect(lastQuery("/api/positions")?.getAll("partyId")).toEqual(["acme", "banco-xpto"]);

    await get("/api/dashboard/positions?partyId=acme");
    expect(lastQuery("/api/positions")?.getAll("partyId")).toEqual(["acme"]);
  });

  it("publishes everyone involved, and says which id is ours instead of hiding it", async () => {
    const body = await json("/api/dashboard/positions?partyId=acme");

    // The Ledger published the usina among the parties; treasury does not strip it, it names it.
    // Hiding is a display choice, and the screen can make it with this — no second copy of the
    // configuration in the client, and no information lost at the boundary.
    expect(body.page.data[0].parties).toEqual(["party-usina", "acme"]);
    expect(body.selfPartyId).toBe(PARTY.USINA);
    expect(body.selectedParties).toEqual(["acme"]);
  });

  it("a filter nobody asked for is never sent", async () => {
    await get("/api/dashboard/positions");
    const q = lastQuery("/api/positions")!;

    expect(q.has("status")).toBe(false);
    expect(q.has("objectType")).toBe(false);
    expect(q.has("from")).toBe(false);
    expect(q.has("outcome")).toBe(false);
  });

  it("an unreadable date is refused, not degraded to 'the book is unavailable'", async () => {
    const res = await get("/api/dashboard/positions?from=not-a-date");

    expect(res.status).toBe(400);
    expect(asked["/api/positions"]).toBeUndefined();
  });
});

describe("GET /api/dashboard/movements", () => {
  it("lists the whole book when no party is named — the usina is not assumed", async () => {
    const res = await get("/api/dashboard/movements");
    const body = (await res.json()) as Record<string, any>;

    expect(body.available).toBe(true);
    expect(body.page.items).toHaveLength(1);
    expect(lastQuery("/api/cash-movements")?.has("partyId")).toBe(false);
  });

  it("forwards party, direction, period and cursor", async () => {
    await get(`/api/dashboard/movements?partyId=${PARTY.USINA}&effect=cash_out&from=2026-01-01&to=2026-02-01&cursor=abc&limit=25`);
    const q = lastQuery("/api/cash-movements")!;

    expect(q.get("partyId")).toBe(PARTY.USINA);
    expect(q.get("effect")).toBe("cash_out");
    expect(q.get("from")).toBe("2026-01-01");
    expect(q.get("to")).toBe("2026-02-01");
    expect(q.get("cursor")).toBe("abc");
    expect(q.get("limit")).toBe("25");
  });

  it("passes the Ledger's cursor through, and publishes no page number over it", async () => {
    const body = await json("/api/dashboard/movements");

    expect(body.page.nextCursor).toBe("cursor-2");
    expect(body.page.hasMore).toBe(true);
    // The fake Ledger answers in keyset mode, where nobody counted. Null, never zero.
    expect(body.page.total).toBeNull();
    expect(body.page.page).toBeNull();
  });

  it("forwards a numbered page and the ordering, so the Ledger can refuse a mismatched cursor", async () => {
    await get("/api/dashboard/movements?page=3&sortBy=recordedAt&sortOrder=ASC");
    const q = lastQuery("/api/cash-movements")!;

    expect(q.get("page")).toBe("3");
    expect(q.get("sortBy")).toBe("recordedAt");
    expect(q.get("sortOrder")).toBe("ASC");
  });

  it("sends no ordering when none was chosen — the Ledger's default is the answer", async () => {
    await get("/api/dashboard/movements");
    const q = lastQuery("/api/cash-movements")!;

    expect(q.has("sortBy")).toBe(false);
    expect(q.has("sortOrder")).toBe(false);
    expect(q.has("page")).toBe(false);
  });

  it("an unreadable date is refused here too", async () => {
    const res = await get("/api/dashboard/movements?to=13/13/2026x");

    expect(res.status).toBe(400);
    expect(asked["/api/cash-movements"]).toBeUndefined();
  });
});

describe("GET /api/dashboard/exposure", () => {
  it("forwards the period and publishes the window the Ledger applied", async () => {
    const body = await json("/api/dashboard/exposure?from=2026-06-01&to=2026-06-30");
    const q = lastQuery("/api/dashboard")!;

    expect(q.get("from")).toBe("2026-06-01");
    expect(q.get("to")).toBe("2026-06-30");
    expect(body.exposure.period).toEqual({ from: "2026-06-01T00:00:00.000Z", to: "2026-06-30T00:00:00.000Z" });
  });

  it("publishes the period cash beside the current-state exposure, without merging them", async () => {
    const body = await json("/api/dashboard/exposure?from=2026-06-01");

    expect(body.exposure.cashIn).toBe("1000.00");
    expect(body.exposure.cashOut).toBe("400.00");
    // The position fold is untouched by the window: the two are different maths and never summed.
    expect(body.exposure.openExposure).toBe("250.00");
    expect(body.exposure.openPayableExposure).toBe("180.00");
  });

  it("with no period the Ledger's own default window still applies", async () => {
    await get("/api/dashboard/exposure");
    expect(lastQuery("/api/dashboard")?.toString()).toBe("");
  });
});

describe("GET /api/dashboard/overview", () => {
  it("the default read still asks the Ledger once for positions — the summary slice", async () => {
    const body = await json("/api/dashboard/overview");

    expect(asked["/api/positions"]).toHaveLength(1);
    expect(lastQuery("/api/positions")?.get("limit")).toBe("500");
    expect(body.positionsPage).toEqual({ total: 1, page: 1, limit: 8, totalPages: 1 });
  });

  it("a filtered slice is read from the Ledger, and the health scan stays unfiltered", async () => {
    await get("/api/dashboard/overview?objectType=payroll&per_page=25&page=2");
    const calls = asked["/api/positions"]!;

    expect(calls).toHaveLength(2);
    // The scan: whole book, no filter — the governance signal must describe everything recorded.
    expect(calls[0].get("limit")).toBe("500");
    expect(calls[0].has("objectType")).toBe(false);
    // The slice: exactly what was asked for.
    expect(calls[1].get("objectType")).toBe("payroll");
    expect(calls[1].get("limit")).toBe("25");
    expect(calls[1].get("page")).toBe("2");
  });

  it("the period scopes the movements block", async () => {
    await get("/api/dashboard/overview?from=2026-01-01&to=2026-02-01");
    const q = lastQuery("/api/cash-movements")!;

    expect(q.get("from")).toBe("2026-01-01");
    expect(q.get("to")).toBe("2026-02-01");
    expect(q.get("partyId")).toBe(PARTY.USINA);
  });

  it("pages the movements block by number when asked, and keyset otherwise", async () => {
    await get("/api/dashboard/overview?movementsPage=2&per_page=15");
    const q = lastQuery("/api/cash-movements")!;

    expect(q.get("page")).toBe("2");
    expect(q.get("limit")).toBe("15");

    await get("/api/dashboard/overview");
    expect(lastQuery("/api/cash-movements")?.has("page")).toBe(false);
  });

  it("the direction filter scopes the movements block", async () => {
    await get("/api/dashboard/overview?effect=cash_out");

    expect(lastQuery("/api/cash-movements")?.get("effect")).toBe("cash_out");
  });

  it("carries the movements cursor so the block can be continued", async () => {
    const body = await json("/api/dashboard/overview");

    expect(body.movementsCursor).toBe("cursor-2");
    expect(body.movementsHasMore).toBe(true);
  });
});
