import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "http";
import { AddressInfo } from "net";
import express from "express";
import { setup } from "./helpers/setup";
import { makeRef } from "./helpers/ref";
import { USINA, reporter } from "./helpers/parties";
import { advancePayment, advanceSettlement } from "./helpers/commands/advance-commands";
import { eventRoutes } from "../../../presentation/web/api/routes/eventRoutes";
import { CreateLedgerEventCommand } from "../../../core/application/dtos/CreateLedgerEventInput";
import { ConfidenceLevel } from "../../../core/domain/enums/ConfidenceLevel";
import { Direction } from "../../../core/domain/enums/Direction";
import { EconomicEffect } from "../../../core/domain/enums/EconomicEffect";
import { EventType } from "../../../core/domain/enums/EventType";
import { ObjectType } from "../../../core/domain/enums/ObjectType";
import { PartyRole } from "../../../core/domain/enums/PartyRole";
import { ReasonType } from "../../../core/domain/enums/ReasonType";
import { Relation } from "../../../core/domain/enums/Relation";

/**
 * GET /api/events/by-party — one party's history, in any role, read-only.
 *
 * The one thing it adds to what is stored is `retracted`, because a retraction does not name the
 * corrected party and so could not be seen from this list.
 */
const ref = makeRef();
const ADV = "advance:by-party";

const retraction = (objectId: string, relatedEventId: string, amount: string): CreateLedgerEventCommand => ({
  eventType: EventType.LEDGER_CORRECTION,
  economicEffect: EconomicEffect.NON_CASH,
  occurredAt: new Date("2025-04-20"),
  amount,
  currency: "BRL",
  sourceSystem: "manual-import",
  sourceReference: ref("retraction"),
  normalizationVersion: "1.0",
  normalizationWorkerId: "worker-test",
  relatedEventId,
  parties: [{ partyId: USINA, role: PartyRole.PLATFORM, direction: Direction.NEUTRAL }],
  objects: [{ objectId, objectType: ObjectType.ADVANCE, relation: Relation.RETRACTS }],
  reason: {
    type: ReasonType.DATA_RECONCILIATION,
    description: "verified by accounting: the recorded amount never arrived",
    confidence: ConfidenceLevel.HIGH,
    requiresFollowup: false,
  },
  reporter: reporter(),
});

let api: Server;
let baseUrl: string;
let counterparty: string;
let advanceId: string;
let wrongId: string;
let rightId: string;
let retractionId: string;

interface Listed {
  id: string;
  retracted: boolean;
  retractedBy?: { eventId: string; occurredAt: string; recordedAt: string; reporter: { reporterType: string; reporterId: string } } | null;
  reporter?: { reporterType: string; reporterId: string };
  parties: { partyId: string }[];
}

const read = async (partyId: string) => {
  const res = await fetch(`${baseUrl}/api/events/by-party?partyId=${encodeURIComponent(partyId)}`);
  expect(res.status).toBe(200);
  return (await res.json()) as { data: Listed[]; total: number };
};

beforeAll(async () => {
  const s = setup();
  const advance = await s.run(advancePayment(ref, ADV, "500.00"));
  advanceId = advance.id.value;
  counterparty = advance.getParties().find((p) => p.partyId.value !== USINA)!.partyId.value;

  const settle = (amount: string) =>
    advanceSettlement(ref, ADV, advanceId, Relation.SETTLES, EconomicEffect.CASH_IN, amount, ReasonType.ADVANCE_PAYMENT);
  const wrong = await s.run(settle("250.00"));
  wrongId = wrong.id.value;
  retractionId = (await s.run(retraction(ADV, wrongId, "250.00"))).id.value;
  rightId = (await s.run(settle("215.00"))).id.value;

  api = createServer(express().use("/api/events", eventRoutes(s.ledgerRepo)));
  await new Promise<void>((resolve) => api.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(api.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => api.close(() => resolve())));

describe("GET /api/events/by-party", () => {
  it("lists every event the party takes part in, with everyone in each event", async () => {
    const { data, total } = await read(counterparty);

    expect(data.map((e) => e.id).sort()).toEqual([advanceId, wrongId, rightId].sort());
    expect(total).toBe(3);
    for (const event of data) {
      expect(event.parties.map((p) => p.partyId)).toContain(counterparty);
    }
  });

  it("says which of them no longer stand, though the retraction does not name this party", async () => {
    const { data } = await read(counterparty);
    const byId = new Map(data.map((e) => [e.id, e.retracted]));

    expect(byId.get(wrongId)).toBe(true);
    expect(byId.get(advanceId)).toBe(false);
    expect(byId.get(rightId)).toBe(false);
  });

  it("names the retraction that withdrew each event, with who recorded it (C1, 2026-11-12)", async () => {
    const { data } = await read(counterparty);
    const wrong = data.find((e) => e.id === wrongId)!;

    expect(wrong.retractedBy).toMatchObject({ eventId: retractionId, reporter: { reporterId: reporter().reporterId } });
    expect(typeof wrong.retractedBy!.recordedAt).toBe("string");
    expect(data.find((e) => e.id === rightId)!.retractedBy).toBeNull();
  });

  it("every event carries who recorded it", async () => {
    const { data } = await read(counterparty);

    for (const event of data) expect(event.reporter?.reporterId).toBe(reporter().reporterId);
  });

  it("an event whose retraction was itself retracted stands again", async () => {
    const s = setup();
    const advance = await s.run(advancePayment(ref, "advance:twice", "500.00"));
    const party = advance.getParties().find((p) => p.partyId.value !== USINA)!.partyId.value;
    const firstRetraction = await s.run(retraction("advance:twice", advance.id.value, "500.00"));
    await s.run(retraction("advance:twice", firstRetraction.id.value, "500.00"));
    const server = createServer(express().use("/api/events", eventRoutes(s.ledgerRepo)));
    await new Promise<void>((resolve) => server.listen(0, resolve));

    const port = (server.address() as AddressInfo).port;
    const res = await fetch(`http://127.0.0.1:${port}/api/events/by-party?partyId=${encodeURIComponent(party)}`);
    const { data } = (await res.json()) as { data: Listed[] };
    await new Promise<void>((resolve) => server.close(() => resolve()));

    expect(data.find((e) => e.id === advance.id.value)?.retracted).toBe(false);
    expect(data.find((e) => e.id === advance.id.value)?.retractedBy).toBeNull();
  });

  it("a party with no events answers an empty list, which is not an error", async () => {
    expect(await read("party-nobody")).toEqual({ data: [], total: 0 });
  });

  it("asks for the party instead of listing the whole book", async () => {
    expect((await fetch(`${baseUrl}/api/events/by-party`)).status).toBe(400);
  });

  it("does not take the place of a single event's lookup", async () => {
    expect((await fetch(`${baseUrl}/api/events/${advanceId}`)).status).toBe(200);
  });
});
