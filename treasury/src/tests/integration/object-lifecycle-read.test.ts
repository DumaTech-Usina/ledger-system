import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "http";
import { AddressInfo } from "net";
import express from "express";
import { HttpLedgerReadAdapter } from "../../infra/ledger-read/HttpLedgerReadAdapter";
import { StubLedgerReadAdapter } from "../../infra/ledger-read/StubLedgerReadAdapter";
import { InMemoryLedgerSimulator } from "../../infra/ledger-sim/InMemoryLedgerSimulator";
import { GetObjectLifecycleUseCase, type ObjectLifecycleView } from "../../core/application/use-cases/GetObjectLifecycle";
import { GetBookExposureUseCase } from "../../core/application/use-cases/GetBookExposure";
import { ListPositionsUseCase } from "../../core/application/use-cases/ListPositions";
import { ListPayablePositionsUseCase } from "../../core/application/use-cases/ListPayablePositions";
import { GetLedgerEventUseCase } from "../../core/application/use-cases/GetLedgerEvent";
import { dashboardRoutes } from "../../presentation/web/api/routes/dashboardRoutes";
import { GetTreasuryDashboardUseCase } from "../../core/application/use-cases/GetTreasuryDashboard";
import type { PositionLifecycle, LedgerEventRef } from "../../core/application/dtos/LedgerReadModels";
import { PARTY, PARTY_DISPLAY_NAMES, partyDirectory } from "../fixtures/parties";

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
      objects: [
        { objectId: "intent:intent-A", objectType: "advance", relation: "originates" },
        // The context the audit asked for: what document this position refers to.
        { objectId: "proposal:PRP-77", objectType: "proposal", relation: "references" },
      ],
      source: { system: "treasury", reference: "PRP-77" },
      // Who the position is with. The Ledger has always published this; the lifecycle route used
      // to drop it, so a reader could see what the position referred to and not with whom.
      parties: [
        { partyId: PARTY.USINA, role: "payer", direction: "out", amount: "500.00" },
        { partyId: PARTY.BROKER, role: "payee", direction: "neutral", amount: null },
      ],
      relatedEventId: null, retracted: false,
      hash: "h1", previousHash: null,
    },
    {
      id: "evt-2", eventType: "advance_settlement", economicEffect: "cash_in",
      occurredAt: "2026-07-09T00:00:00.000Z", recordedAt: "2026-07-09T10:00:00.000Z",
      amount: "250.00", currency: "BRL", description: null,
      objects: [{ objectId: "intent:intent-A", objectType: "advance", relation: "settles" }],
      relatedEventId: "evt-1", retracted: false,
      hash: "h2", previousHash: "h1",
    },
    {
      id: "evt-3", eventType: "advance_settlement", economicEffect: "cash_in",
      occurredAt: "2026-07-16T00:00:00.000Z", recordedAt: "2026-07-16T10:00:00.000Z",
      amount: "250.00", currency: "BRL", description: null,
      objects: [{ objectId: "intent:intent-A", objectType: "advance", relation: "settles" }],
      relatedEventId: "evt-1", retracted: false,
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
    } else if (path === "/api/positions/advance:rectified") {
      // A settlement wrongly recorded as 250, retracted, and re-asserted as 215. The Ledger
      // publishes every event AND which of them still stand — Treasury must not have to guess.
      res.end(JSON.stringify({
        ...advanceLifecycle,
        objectId: "advance:rectified",
        status: "partially_settled",
        outcome: "pending",
        totalSettled: "215.00",
        openBalance: "285.00",
        eventCount: 4,
        events: [
          advanceLifecycle.events[0],
          { ...advanceLifecycle.events[1], retracted: true },
          {
            id: "evt-fix", eventType: "ledger_correction", economicEffect: "non_cash",
            occurredAt: "2026-07-12T00:00:00.000Z", recordedAt: "2026-07-12T10:00:00.000Z",
            amount: "250.00", currency: "BRL", description: "verified by accounting",
            objects: [{ objectId: "advance:rectified", objectType: "advance", relation: "retracts" }],
            relatedEventId: "evt-2", retracted: false,
            hash: "h4", previousHash: "h3",
          },
          { ...advanceLifecycle.events[2], id: "evt-right", amount: "215.00" },
        ],
      }));
    } else if (path === "/api/positions/advance:origin-retracted") {
      // The origination itself was retracted. The Ledger's own `origin` block still names it —
      // it is extracted before the retraction fold — so this is what tells whether Treasury reads
      // the block or the standing events.
      res.end(JSON.stringify({
        ...advanceLifecycle,
        objectId: "advance:origin-retracted",
        status: "unknown_origin",
        events: [
          { ...advanceLifecycle.events[0], retracted: true },
          advanceLifecycle.events[1],
        ],
      }));
    } else if (path === "/api/events/evt-1") {
      res.end(JSON.stringify({
        id: "evt-1", eventType: "advance_payment", economicEffect: "cash_out",
        amount: "500.00", currency: "BRL", occurredAt: "2026-07-02T00:00:00.000Z",
        description: "Advance disbursement", relatedEventId: null,
        objects: [{ objectId: "intent:intent-A", objectType: "advance", relation: "originates" }],
        parties: [{ partyId: "party:usina", role: "payer", direction: "out", amount: "500.00" }],
        source: { system: "treasury", reference: "PRP-77" },
      }));
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

  it("carries what each event speaks about — relatedEventId is passed through, never derived", async () => {
    const life = (await new HttpLedgerReadAdapter(baseUrl).lifecycle("intent:intent-A"))!;
    expect(life.events.map((e) => e.relatedEventId)).toEqual([null, "evt-1", "evt-1"]);
  });

  it("a rectified life shows which event no longer stands, straight from the Ledger", async () => {
    const life = (await new HttpLedgerReadAdapter(baseUrl).lifecycle("advance:rectified"))!;

    // The whole history is still there: nothing was edited away.
    expect(life.events).toHaveLength(4);
    expect(life.events.map((e) => [e.amount, e.retracted])).toEqual([
      ["500.00", false],
      ["250.00", true], // the entry that never happened
      ["250.00", false], // the retraction itself
      ["215.00", false], // the truth that replaced it
    ]);

    // And the retraction says what it undoes.
    const fix = life.events.find((e) => e.relation === "retracts")!;
    expect(fix.relatedEventId).toBe("evt-2");

    // Treasury publishes the Ledger's figures, and never recomputes them from the events.
    expect(life.totalSettled).toBe("215.00");
    expect(life.openBalance).toBe("285.00");
  });

  it("carries the contextual references of each event — what it named and where it came from", async () => {
    const life = (await new HttpLedgerReadAdapter(baseUrl).lifecycle("intent:intent-A"))!;

    // Every object the origination named, not only the position being read.
    expect(life.events[0].objects).toEqual([
      { objectId: "intent:intent-A", objectType: "advance", relation: "originates" },
      { objectId: "proposal:PRP-77", objectType: "proposal", relation: "references" },
    ]);
    expect(life.events[0].source).toEqual({ system: "treasury", reference: "PRP-77" });
  });

  it("names what the standing origination refers to — the document, not a recomputed figure", async () => {
    const life = (await new HttpLedgerReadAdapter(baseUrl).lifecycle("intent:intent-A"))!;

    expect(life.origin).toEqual({
      eventId: "evt-1",
      eventType: "advance_payment",
      occurredAt: "2026-07-02T00:00:00.000Z",
      source: { system: "treasury", reference: "PRP-77" },
      // The siblings only: the position itself is the subject of the read, not a related object.
      relatedObjects: [{ objectId: "proposal:PRP-77", objectType: "proposal", relation: "references" }],
      parties: [
        { partyId: PARTY.USINA, role: "payer", direction: "out", amount: "500.00" },
        { partyId: PARTY.BROKER, role: "payee", direction: "neutral", amount: null },
      ],
    });
  });

  it("names who the position is with — the counterparty, without a second read", async () => {
    const life = (await new HttpLedgerReadAdapter(baseUrl).lifecycle("intent:intent-A"))!;

    expect(life.events[0].parties).toEqual([
      { partyId: PARTY.USINA, role: "payer", direction: "out", amount: "500.00" },
      { partyId: PARTY.BROKER, role: "payee", direction: "neutral", amount: null },
    ]);
    // And on the position itself, read from the origination that still stands.
    expect(life.origin?.parties.map((p) => [p.partyId, p.role])).toEqual([
      [PARTY.USINA, "payer"],
      [PARTY.BROKER, "payee"],
    ]);
  });

  it("an event that named no party carries an empty list — absence, not an unknown", async () => {
    // A settlement recorded with no party at all is a legitimate record, and the mirror says so
    // rather than omitting the field and leaving the reader to guess which it was.
    const life = (await new HttpLedgerReadAdapter(baseUrl).lifecycle("intent:intent-A"))!;
    expect(life.events[1].parties).toEqual([]);
  });

  it("a retracted origination refers to nothing — the Ledger's stale origin block is not read", async () => {
    const life = (await new HttpLedgerReadAdapter(baseUrl).lifecycle("advance:origin-retracted"))!;

    // The Ledger still publishes origin.eventId = "evt-1" on this payload; treasury answers null
    // because no origination stands. The event itself remains in the history.
    expect(life.origin).toBeNull();
    expect(life.events.map((e) => e.retracted)).toEqual([true, false]);
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
      dashboardRoutes(
        new GetTreasuryDashboardUseCase(read, PARTY.USINA, partyDirectory()),
        new GetObjectLifecycleUseCase(read, partyDirectory()),
        new GetBookExposureUseCase(read),
        new ListPositionsUseCase(read),
        new ListPayablePositionsUseCase(read),
        new GetLedgerEventUseCase(read),
      ),
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

  it("serves the rectification on the wire — both new fields reach the consumer", async () => {
    const res = await fetch(`${apiUrl}/api/dashboard/positions/${encodeURIComponent("advance:rectified")}`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as PositionLifecycle;
    expect(body.events.map((e) => e.retracted)).toEqual([false, true, false, false]);
    expect(body.events.find((e) => e.relation === "retracts")!.relatedEventId).toBe("evt-2");
  });

  it("serves what the position refers to — the audit's question, answerable in one read", async () => {
    const res = await fetch(`${apiUrl}/api/dashboard/positions/${encodeURIComponent("intent:intent-A")}`);
    const body = (await res.json()) as PositionLifecycle;

    expect(body.origin?.source).toEqual({ system: "treasury", reference: "PRP-77" });
    expect(body.origin?.relatedObjects.map((o) => o.objectType)).toEqual(["proposal"]);
    expect(body.events[0].objects.map((o) => o.objectId)).toContain("proposal:PRP-77");
  });

  it("serves the counterparty and its readable name, in one read", async () => {
    const res = await fetch(`${apiUrl}/api/dashboard/positions/${encodeURIComponent("intent:intent-A")}`);
    const body = (await res.json()) as ObjectLifecycleView;

    expect(body.origin?.parties.find((p) => p.partyId !== PARTY.USINA)?.partyId).toBe(PARTY.BROKER);
    // Names travel BESIDE the mirror, never inside it: the events keep publishing ids.
    expect(body.partyNames[PARTY.BROKER]).toBe(PARTY_DISPLAY_NAMES[PARTY.BROKER]);
    expect(body.events[0].parties[0]).not.toHaveProperty("displayName");
  });

  it("keeps the Ledger's projection when no name can be resolved — ids stay on screen", async () => {
    const read = new HttpLedgerReadAdapter(baseUrl);
    // No Directory at all: the same answer a Directory that does not know the party would give.
    const view = (await new GetObjectLifecycleUseCase(read).execute("intent:intent-A"))!;

    expect(view.partyNames).toEqual({});
    expect(view.origin?.parties.map((p) => p.partyId)).toEqual([PARTY.USINA, PARTY.BROKER]);
  });

  it("answers 404 for an object the Ledger does not know", async () => {
    const res = await fetch(`${apiUrl}/api/dashboard/positions/${encodeURIComponent("intent:nope")}`);
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toBe("Position not found");
  });

  // The eventId a movement or a lifecycle carries had nowhere to be resolved: the record existed on
  // treasury's read boundary and no route published it.
  it("resolves an eventId to the Ledger's own record of the event", async () => {
    const res = await fetch(`${apiUrl}/api/dashboard/events/evt-1`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as LedgerEventRef;
    expect(body.eventId).toBe("evt-1");
    expect(body.eventType).toBe("advance_payment");
    expect(body.amount).toBe("500.00");
    expect(body.objects).toEqual([{ objectId: "intent:intent-A", objectType: "advance", relation: "originates" }]);
    expect(body.parties[0].partyId).toBe("party:usina");
    expect(body.source).toEqual({ system: "treasury", reference: "PRP-77" });
  });

  it("an event the Ledger does not know is a 404 — not an empty record", async () => {
    const res = await fetch(`${apiUrl}/api/dashboard/events/evt-nope`);
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toBe("Event not found");
  });
});
