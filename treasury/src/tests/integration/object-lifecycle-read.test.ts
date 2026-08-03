import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "http";
import { AddressInfo } from "net";
import express from "express";
import { HttpLedgerReadAdapter } from "../../infra/ledger-read/HttpLedgerReadAdapter";
import { StubLedgerReadAdapter } from "../../infra/ledger-read/StubLedgerReadAdapter";
import { InMemoryLedgerSimulator } from "../../infra/ledger-sim/InMemoryLedgerSimulator";
import { GetObjectLifecycleUseCase } from "../../core/application/use-cases/GetObjectLifecycle";
import { dashboardRoutes } from "../../presentation/web/api/routes/dashboardRoutes";
import { GetTreasuryDashboardUseCase } from "../../core/application/use-cases/GetTreasuryDashboard";
import type { PositionLifecycle } from "../../core/application/dtos/LedgerReadModels";

/**
 * Makes the life of ONE economic object observable through Treasury's API. Nothing is projected
 * here: the Ledger already computes the position from its immutable chain (GET /api/positions/:id);
 * Treasury reads it, trims it to what it displays, and serves it. The evolution under test is the
 * one the continuity MVA made possible — an advance originated, then settled twice.
 */

/** The Ledger's real read-API shape for a position detail, as `serializePositionSummary` emits it. */
const advanceLifecycle = {
  objectId: "intent:intent-A",
  status: "fully_settled",
  outcome: "gain",
  currency: "BRL",
  totalOriginated: "500.00",
  totalSettled: "500.00",
  totalAdjusted: "0.00",
  openBalance: "0.00",
  overSettlement: "0.00",
  cashRecovered: "500.00",
  nonCashClosed: "0.00",
  allocationGap: "0.00",
  eventCount: 3,
  events: [
    {
      id: "evt-1", eventType: "advance_payment", economicEffect: "cash_out",
      occurredAt: "2026-07-02T00:00:00.000Z", recordedAt: "2026-07-02T10:00:00.000Z",
      amount: "500.00", currency: "BRL", description: "Advance disbursement",
      objects: [{ objectId: "intent:intent-A", objectType: "advance", relation: "originates" }],
      hash: "h1", previousHash: null,
    },
    {
      id: "evt-2", eventType: "advance_settlement", economicEffect: "cash_in",
      occurredAt: "2026-07-09T00:00:00.000Z", recordedAt: "2026-07-09T10:00:00.000Z",
      amount: "250.00", currency: "BRL", description: null,
      objects: [{ objectId: "intent:intent-A", objectType: "advance", relation: "settles" }],
      hash: "h2", previousHash: "h1",
    },
    {
      id: "evt-3", eventType: "advance_settlement", economicEffect: "cash_in",
      occurredAt: "2026-07-16T00:00:00.000Z", recordedAt: "2026-07-16T10:00:00.000Z",
      amount: "250.00", currency: "BRL", description: null,
      objects: [{ objectId: "intent:intent-A", objectType: "advance", relation: "settles" }],
      hash: "h3", previousHash: "h2",
    },
  ],
  origin: { eventId: "evt-1", eventType: "advance_payment", occurredAt: "2026-07-02T00:00:00.000Z" },
};

let ledger: Server;
let baseUrl: string;

beforeAll(async () => {
  ledger = createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    const path = decodeURIComponent((req.url || "").split("?")[0]);
    if (path === "/api/positions/intent:intent-A") {
      res.end(JSON.stringify(advanceLifecycle));
    } else if (path === "/api/positions/receivable:orphan") {
      // A position the Ledger settled but whose origination it does not know: it publishes no
      // number it cannot derive, so openBalance arrives as null — never "0.00".
      res.end(JSON.stringify({ ...advanceLifecycle, objectId: "receivable:orphan", status: "unknown_origin", outcome: "pending", totalOriginated: "0.00", openBalance: null, events: [] }));
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: "Position not found" }));
    }
  });
  await new Promise<void>((resolve) => ledger.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(ledger.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => ledger.close(() => resolve())));

describe("HttpLedgerReadAdapter — position lifecycle", () => {
  it("reads the life of one economic object from the Ledger's position detail", async () => {
    const life = (await new HttpLedgerReadAdapter(baseUrl).lifecycle("intent:intent-A"))!;

    expect(life.objectId).toBe("intent:intent-A");
    expect(life.status).toBe("fully_settled");
    expect(life.outcome).toBe("gain");
    expect(life.totalOriginated).toBe("500.00");
    expect(life.openBalance).toBe("0.00");
    expect(life.events).toHaveLength(3);
  });

  it("preserves the Ledger's event order — the object's history reads as it happened", async () => {
    const life = (await new HttpLedgerReadAdapter(baseUrl).lifecycle("intent:intent-A"))!;

    expect(life.events.map((e) => e.eventId)).toEqual(["evt-1", "evt-2", "evt-3"]);
    expect(life.events.map((e) => [e.relation, e.amount])).toEqual([
      ["originates", "500.00"],
      ["settles", "250.00"],
      ["settles", "250.00"],
    ]);
  });

  it("every event in the lifecycle belongs to the requested objectId", async () => {
    const life = (await new HttpLedgerReadAdapter(baseUrl).lifecycle("intent:intent-A"))!;
    // The relation is the one each event declares FOR THIS object — never another object's.
    expect(life.events.every((e) => e.relation !== null)).toBe(true);
    expect(life.eventCount).toBe(life.events.length);
  });

  it("an unknown object is null, not an error", async () => {
    expect(await new HttpLedgerReadAdapter(baseUrl).lifecycle("intent:nope")).toBeNull();
  });

  it("an unknown origination arrives as unknown — treasury never turns it into zero", async () => {
    const life = (await new HttpLedgerReadAdapter(baseUrl).lifecycle("receivable:orphan"))!;
    expect(life.status).toBe("unknown_origin");
    expect(life.openBalance).toBeNull();
  });

  it("the demo adapters answer null — they do not project lifecycles", async () => {
    expect(await new StubLedgerReadAdapter().lifecycle("intent:intent-A")).toBeNull();
    expect(await new InMemoryLedgerSimulator().lifecycle("intent:intent-A")).toBeNull();
  });
});

describe("GetObjectLifecycleUseCase", () => {
  it("returns the lifecycle of a known object", async () => {
    const uc = new GetObjectLifecycleUseCase(new HttpLedgerReadAdapter(baseUrl));
    expect((await uc.execute("intent:intent-A"))?.events).toHaveLength(3);
  });

  it("returns null for an unknown object", async () => {
    const uc = new GetObjectLifecycleUseCase(new HttpLedgerReadAdapter(baseUrl));
    expect(await uc.execute("intent:nope")).toBeNull();
  });
});

describe("GET /api/dashboard/positions/:objectId", () => {
  function app(ledgerBaseUrl: string) {
    const read = new HttpLedgerReadAdapter(ledgerBaseUrl);
    return express().use(
      "/api/dashboard",
      dashboardRoutes(new GetTreasuryDashboardUseCase(read, "party-usina"), new GetObjectLifecycleUseCase(read)),
    );
  }

  let api: Server;
  let apiUrl: string;

  beforeAll(async () => {
    api = createServer(app(baseUrl));
    await new Promise<void>((resolve) => api.listen(0, resolve));
    apiUrl = `http://127.0.0.1:${(api.address() as AddressInfo).port}`;
  });

  afterAll(() => new Promise<void>((resolve) => api.close(() => resolve())));

  it("serves the whole life of one economic object", async () => {
    const res = await fetch(`${apiUrl}/api/dashboard/positions/${encodeURIComponent("intent:intent-A")}`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as PositionLifecycle;
    expect(body.objectId).toBe("intent:intent-A");
    expect(body.status).toBe("fully_settled");
    expect(body.events.map((e) => e.relation)).toEqual(["originates", "settles", "settles"]);
  });

  it("answers 404 for an object the Ledger does not know", async () => {
    const res = await fetch(`${apiUrl}/api/dashboard/positions/${encodeURIComponent("intent:nope")}`);
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toBe("Position not found");
  });
});
