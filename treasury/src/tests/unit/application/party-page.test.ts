import { describe, it, expect } from "vitest";
import { PartyDirectory } from "../../../core/application/services/PartyDirectory";
import { PreparedBatches, PreparedBatchError } from "../../../core/application/services/PreparedBatches";
import { GetPartyPageUseCase, USINA_OWES, PARTY_OWES } from "../../../core/application/use-cases/GetPartyPage";
import type { PartyEvent, PositionItem } from "../../../core/application/dtos/LedgerReadModels";
import { PartyIdentityState } from "../../../core/domain/enums/PartyIdentityState";
import { InMemoryExternalSignalRepository } from "../../../infra/persistence/InMemoryExternalSignalRepository";
import { InMemoryIdentityLinkRepository } from "../../../infra/persistence/InMemoryIdentityLinkRepository";
import { InMemoryIntentRepository } from "../../../infra/persistence/InMemoryIntentRepository";
import { InMemoryPartyRepository } from "../../../infra/persistence/InMemoryPartyRepository";

const TODAY = "2026-11-12T12:00:00.000Z";
const clock = { now: () => TODAY };

const position = (objectId: string, objectType: string, over: Partial<PositionItem> = {}): PositionItem => ({
  objectId,
  objectType,
  status: "open",
  outcome: "pending",
  currency: "BRL",
  totalOriginated: "10.00",
  openBalance: "10.00",
  eventCount: 1,
  lastEventAt: TODAY,
  originatedAt: "2026-11-01T12:00:00.000Z",
  createdAt: "2026-11-01T12:00:00.000Z",
  dueAt: null,
  parties: ["party-usina", "party-h"],
  ...over,
});

type Asked = Record<string, unknown>;

async function useCaseFor(positions: PositionItem[], { total, events = [], asked = [] as Asked[] }: { total?: number; events?: PartyEvent[]; asked?: Asked[] } = {}) {
  const parties = new InMemoryPartyRepository();
  await parties.save({ partyId: "party-h", displayName: "Halisson", identityState: PartyIdentityState.IDENTIFIED, aliases: [], externalIds: [], attributes: {} });
  const useCase = new GetPartyPageUseCase({
    directory: new PartyDirectory(parties, undefined, new InMemoryIdentityLinkRepository()),
    ledger: {
      eventsOfParty: async () => events,
      event: async () => null,
      positions: async (q = {}) => {
        asked.push(q as Asked);
        const types = q.objectType === undefined ? null : ([] as string[]).concat(q.objectType);
        const data = positions.filter((p) => !types || types.includes(p.objectType));
        const n = total ?? data.length;
        return { data, total: n, page: q.page ?? 1, limit: q.limit ?? 20, totalPages: Math.ceil(n / (q.limit ?? 20)) };
      },
      lifecycle: async () => null,
    },
    signals: new InMemoryExternalSignalRepository(),
    intents: new InMemoryIntentRepository(),
    clock,
    positionalTypes: ["advance", "loan", "commission_payable", "commission_entitlement", "contract"],
  });
  return useCase;
}

async function page(positions: PositionItem[], options: { total?: number; events?: PartyEvent[] } = {}) {
  const result = await (await useCaseFor(positions, options)).execute("party-h");
  if (!result?.available) throw new Error("expected a loaded page");
  return result;
}

describe("GetPartyPage — what the acceptance suite leaves implicit", () => {
  it("the two sides never share a kind", () => {
    expect([...USINA_OWES].filter((t) => PARTY_OWES.has(t))).toEqual([]);
  });

  it("a kind of unknown side is listed apart, never dropped", async () => {
    const { operation } = await page([position("x-1", "commission_entitlement")]);

    expect(operation.unclassified.map((l) => l.objectId)).toEqual(["x-1"]);
    expect([...operation.usinaOwes, ...operation.partyOwes]).toEqual([]);
  });

  it("a position already at zero, or with an unknown balance, is not a line", async () => {
    const { operation } = await page([
      position("zero", "advance", { openBalance: "0.00" }),
      position("unknown", "advance", { openBalance: null }),
    ]);

    expect(operation.partyOwes).toEqual([]);
  });

  it("contexts are never lines: a policy holds no balance (DEC-035)", async () => {
    const { operation } = await page([position("seguro:apolice:1", "contract")]);

    expect(operation.unclassified).toEqual([]);
  });

  it("each side carries the Ledger's own count and paging, never a sum", async () => {
    const { operation } = await page([position("a", "advance")], { total: 137 });

    expect(operation.pages.partyOwes).toMatchObject({ total: 137, page: 1, limit: 20, totalPages: 7 });
    expect(JSON.stringify(operation.pages)).not.toMatch(/\d+\.\d{2}/);
  });

  it("one side is paged on its own: page, size, order and filters go to the Ledger", async () => {
    const asked: Asked[] = [];
    const useCase = await useCaseFor([position("a", "advance"), position("cp", "commission_payable")], { asked });

    const result = await useCase.side("party-h", "partyOwes", { page: 3, limit: 50, sortBy: "dueAt", sortOrder: "ASC", objectType: ["advance", "commission_payable"], from: "2026-01-01" });

    expect(result).toMatchObject({ available: true, side: "partyOwes", page: 3, limit: 50 });
    expect(asked[asked.length - 1]).toMatchObject({ page: 3, limit: 50, sortBy: "dueAt", sortOrder: "ASC", objectType: ["advance"], from: "2026-01-01", status: ["open", "partially_settled"] });
    expect(result && result.available && result.lines.map((l) => l.objectId)).toEqual(["a"]);
  });

  it("the page size is kept between 1 and 100", async () => {
    const asked: Asked[] = [];
    const useCase = await useCaseFor([], { asked });

    await useCase.side("party-h", "usinaOwes", { limit: 5000 });

    expect(asked[asked.length - 1]).toMatchObject({ limit: 100 });
  });

  it("asking a side only for a kind of the other side reads nothing", async () => {
    const asked: Asked[] = [];
    const useCase = await useCaseFor([position("a", "advance")], { asked });

    const result = await useCase.side("party-h", "usinaOwes", { objectType: ["advance"] });

    expect(result).toMatchObject({ available: true, lines: [], total: 0 });
    expect(asked).toEqual([]);
  });

  it("a side of an unknown party is null, and an unreachable Ledger is unavailable", async () => {
    const useCase = await useCaseFor([]);
    expect(await useCase.side("party-nobody", "usinaOwes")).toBeNull();
  });

  it("says when an alert scan hit its limit", async () => {
    const result = await (await useCaseFor([position("cp", "commission_payable")], { total: 500 })).execute("party-h");

    expect(result && result.available && result.alertsPartial).toBe(true);
  });

  it("newest first by default, in the Ledger's own order: Treasury does not re-sort a page", async () => {
    const asked: Asked[] = [];
    await (await useCaseFor([], { asked })).side("party-h", "partyOwes");

    expect(asked[0]).toMatchObject({ sortBy: "createdAt", sortOrder: "DESC", page: 1, limit: 20 });
  });

  it("a retracted fact does not lend its context to the line", async () => {
    const retracted: PartyEvent = {
      eventId: "e1", eventType: "advance_payment", economicEffect: "cash_out", amount: "10.00", currency: "BRL",
      occurredAt: TODAY, recordedAt: TODAY, description: null, relatedEventId: null, retracted: true,
      objects: [{ objectId: "a", objectType: "advance", relation: "originates" }, { objectId: "seguro:apolice:1", objectType: "contract", relation: "references" }],
      parties: [], source: { system: "treasury", reference: "intent:e1" },
    };
    const { operation } = await page([position("a", "advance")], { events: [retracted] });

    expect(operation.partyOwes[0].contexts).toEqual([]);
  });
});

describe("PreparedBatches — refusals", () => {
  const batches = () => new PreparedBatches({ record: async () => undefined }, clock);
  const item = (objectId: string, amount = "10.00") => ({ objectId, amount });

  it.each([
    ["no party", { partyId: " ", items: [item("cp-1")], by: "cfo" }],
    ["no author", { partyId: "party-h", items: [item("cp-1")], by: "" }],
    ["no obligation", { partyId: "party-h", items: [], by: "cfo" }],
    ["the same obligation twice", { partyId: "party-h", items: [item("cp-1"), item("cp-1")], by: "cfo" }],
    ["a zero amount", { partyId: "party-h", items: [item("cp-1", "0.00")], by: "cfo" }],
    ["something that is not an amount", { partyId: "party-h", items: [item("cp-1", "dez")], by: "cfo" }],
  ])("refuses %s", async (_label, input) => {
    await expect(batches().prepare(input)).rejects.toBeInstanceOf(PreparedBatchError);
  });

  it("a batch is discarded once, and only one that exists", async () => {
    const service = batches();
    const { batchId } = await service.prepare({ partyId: "party-h", items: [item("cp-1")], by: "cfo" });

    await service.discard(batchId, "cfo");

    await expect(service.discard(batchId, "cfo")).rejects.toBeInstanceOf(PreparedBatchError);
    await expect(service.discard("batch-nope", "cfo")).rejects.toBeInstanceOf(PreparedBatchError);
  });

  it("the party's page reads only its standing batches", async () => {
    const service = batches();
    const kept = await service.prepare({ partyId: "party-h", items: [item("cp-1")], by: "cfo" });
    const gone = await service.prepare({ partyId: "party-h", items: [item("cp-2")], by: "cfo" });
    await service.prepare({ partyId: "party-x", items: [item("cp-3")], by: "cfo" });
    await service.discard(gone.batchId, "cfo");

    expect((await service.ofParty("party-h")).map((b) => b.batchId)).toEqual([kept.batchId]);
  });
});

describe("GetPartyPage — histórico de auditoria (refinamento de 2026-11-12)", () => {
  const fact = (eventId: string, recordedAt: string, over: Partial<PartyEvent> = {}): PartyEvent => ({
    eventId, eventType: "advance_payment", economicEffect: "cash_out", amount: "10.00", currency: "BRL",
    occurredAt: recordedAt, recordedAt, description: null, relatedEventId: null, retracted: false,
    objects: [], parties: [{ partyId: "party-h", role: "beneficiary", direction: "in", amount: null }],
    source: { system: "treasury", reference: `intent:${eventId}` },
    reporter: { type: "user", id: "user-cfo", name: null },
    ...over,
  });

  async function historyOf(events: PartyEvent[]) {
    const parties = new InMemoryPartyRepository();
    await parties.save({ partyId: "party-h", displayName: "Halisson", identityState: PartyIdentityState.IDENTIFIED, aliases: [], externalIds: [], attributes: {} });
    return new GetPartyPageUseCase({
      directory: new PartyDirectory(parties, undefined, new InMemoryIdentityLinkRepository()),
      ledger: {
        eventsOfParty: async () => events,
        event: async () => null,
        positions: async () => ({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 }),
        lifecycle: async () => null,
      },
      signals: new InMemoryExternalSignalRepository(),
      intents: new InMemoryIntentRepository(),
      clock,
      users: { findById: async (id) => (id === "user-cfo" ? { displayName: "Diretoria financeira" } : null) },
    });
  }
  const loaded = async (events: PartyEvent[], query = {}) => {
    const result = await (await historyOf(events)).history("party-h", query);
    if (!result?.available) throw new Error("expected a loaded history");
    return result;
  };
  const many = Array.from({ length: 45 }, (_, i) => fact(`e${String(i).padStart(2, "0")}`, `2026-11-${String((i % 28) + 1).padStart(2, "0")}T12:00:00.000Z`));

  it("pagina pela data de registro, a mais recente primeiro", async () => {
    const first = await loaded(many);

    expect(first).toMatchObject({ total: 45, page: 1, limit: 20, totalPages: 3 });
    expect(first.entries[0].recordedAt >= first.entries[19].recordedAt).toBe(true);
    expect((await loaded(many, { page: 3 })).entries).toHaveLength(5);
  });

  it("ou a mais antiga primeiro", async () => {
    const { entries } = await loaded(many, { sortOrder: "ASC" });

    expect(entries[0].recordedAt <= entries[1].recordedAt).toBe(true);
  });

  it("filtra por período de registro, tipo de fato, quem registrou e situação", async () => {
    const events = [
      fact("a", "2026-11-01T12:00:00.000Z"),
      fact("b", "2026-11-05T12:00:00.000Z", { eventType: "commission_split" }),
      fact("c", "2026-11-09T12:00:00.000Z", { reporter: { type: "external_system", id: "system:seguro", name: null } }),
      fact("d", "2026-11-10T12:00:00.000Z", { retracted: true }),
    ];
    const ids = async (q: object) => (await loaded(events, q)).entries.map((e) => e.eventId).sort();

    expect(await ids({ from: "2026-11-04", to: "2026-11-09" })).toEqual(["b", "c"]);
    expect(await ids({ eventType: ["commission_split"] })).toEqual(["b"]);
    expect(await ids({ reporter: ["system:seguro"] })).toEqual(["c"]);
    expect(await ids({ status: "retracted" })).toEqual(["d"]);
    expect(await ids({ status: "standing" })).toEqual(["a", "b", "c"]);
  });

  it("os filtros oferecem o que existe no histórico inteiro, e quem registrou vem pelo nome", async () => {
    const { facets, entries } = await loaded([fact("a", TODAY), fact("b", TODAY, { eventType: "commission_split" })], { eventType: ["commission_split"] });

    expect(facets.eventTypes).toEqual(["advance_payment", "commission_split"]);
    expect(facets.reporters).toEqual([{ type: "user", id: "user-cfo", name: "Diretoria financeira" }]);
    expect(entries[0].reporter).toEqual({ type: "user", id: "user-cfo", name: "Diretoria financeira" });
  });

  it("quem não se sabe que registrou fica nulo, nunca inventado", async () => {
    const { entries } = await loaded([fact("a", TODAY, { reporter: undefined })]);

    expect(entries[0].reporter).toBeNull();
  });

  it("C1: a retirada publicada pelo Ledger diz quem retirou, mesmo sem citar a parte", async () => {
    const { entries } = await loaded([
      fact("adv", "2026-11-01T12:00:00.000Z", {
        retracted: true,
        retractedBy: { eventId: "retr", occurredAt: "2026-11-11T12:00:00.000Z", recordedAt: "2026-11-11T12:00:00.000Z", reporter: { type: "user", id: "user-cfo", name: null } },
      }),
    ]);

    expect(entries[0].retractedBy).toEqual({
      eventId: "retr", occurredAt: "2026-11-11T12:00:00.000Z", recordedAt: "2026-11-11T12:00:00.000Z",
      reporter: { type: "user", id: "user-cfo", name: "Diretoria financeira" },
    });
  });

  it("o histórico de uma parte desconhecida é nulo; com o Ledger fora do ar, indisponível", async () => {
    const useCase = await historyOf([]);
    expect(await useCase.history("party-nobody")).toBeNull();
  });
});
