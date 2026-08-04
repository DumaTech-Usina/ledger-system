import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "http";
import { AddressInfo } from "net";
import express from "express";
import { setup } from "./helpers/setup";
import { makeRef } from "./helpers/ref";
import { advancePayment, advanceSettlement } from "./helpers/commands/advance-commands";
import { eventRoutes } from "../../../presentation/web/api/routes/eventRoutes";
import { InMemoryLedgerEventRepository } from "../../../infra/persistence/memory/InMemoryLedgerEventRepository";
import { EconomicEffect } from "../../../core/domain/enums/EconomicEffect";
import { EventType } from "../../../core/domain/enums/EventType";
import { ReasonType } from "../../../core/domain/enums/ReasonType";
import { Relation } from "../../../core/domain/enums/Relation";

/**
 * GET /api/events/:id — a single event, read-only.
 *
 * It exists so a producer preparing a rectification can read what the event it corrects actually
 * asserted, instead of retyping figures the ledger already holds. Everything it returns is stored
 * data passed through `serializeEvent`; nothing here is derived.
 */

const ref = makeRef();

let repo: InMemoryLedgerEventRepository;
let api: Server;
let baseUrl: string;
let advanceId: string;
let settlementId: string;

beforeAll(async () => {
  const s = setup();
  repo = s.ledgerRepo;

  const advance = await s.run(advancePayment(ref, "advance:lookup", "500.00"));
  advanceId = advance.id.value;
  const settlement = await s.run(
    advanceSettlement(ref, "advance:lookup", advanceId, Relation.SETTLES, EconomicEffect.CASH_IN, "250.00", ReasonType.ADVANCE_PAYMENT),
  );
  settlementId = settlement.id.value;

  api = createServer(express().use("/api/events", eventRoutes(repo)));
  await new Promise<void>((resolve) => api.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(api.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => api.close(() => resolve())));

describe("GET /api/events/:id", () => {
  it("returns everything a rectification needs to describe what it corrects", async () => {
    const res = await fetch(`${baseUrl}/api/events/${settlementId}`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      id: string; eventType: string; economicEffect: string; amount: string; currency: string;
      objects: Array<{ objectId: string; objectType: string; relation: string }>;
      relatedEventId: string | null;
    };
    expect(body.id).toBe(settlementId);
    expect(body.eventType).toBe(EventType.ADVANCE_SETTLEMENT);
    expect(body.economicEffect).toBe(EconomicEffect.CASH_IN);
    expect(body.amount).toBe("250.00");
    expect(body.currency).toBe("BRL");
    // The object the event moved — the position a retraction would have to name.
    expect(body.objects).toEqual([
      { objectId: "advance:lookup", objectType: "advance", relation: "settles" },
    ]);
    // And its own lineage, so a reader can follow the chain further back.
    expect(body.relatedEventId).toBe(advanceId);
  });

  it("an unknown id is a 404 with a legible body, never an exception", async () => {
    const res = await fetch(`${baseUrl}/api/events/00000000-0000-0000-0000-000000000000`);
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toBe("Event not found");
  });

  it("REGRESSION — /feed still resolves as a literal route, not as an id", async () => {
    const res = await fetch(`${baseUrl}/api/events/feed?limit=5`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { data: unknown[]; totalPages: number };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body).toHaveProperty("totalPages");
  });

  it("REGRESSION — the paginated listing is unchanged", async () => {
    const res = await fetch(`${baseUrl}/api/events?limit=10`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { total: number; data: { id: string }[] };
    expect(body.total).toBe(2);
    expect(body.data.map((e) => e.id).sort()).toEqual([advanceId, settlementId].sort());
  });
});
