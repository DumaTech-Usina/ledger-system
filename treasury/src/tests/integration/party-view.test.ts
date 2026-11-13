import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer as createHttpServer, type Server } from "http";
import type { AddressInfo } from "net";
import { createServer } from "../../presentation/web/api/server";
import { AuthService } from "../../core/application/services/AuthService";
import { PartyDirectory } from "../../core/application/services/PartyDirectory";
import { GetPartyEventsUseCase } from "../../core/application/use-cases/GetPartyEvents";
import { GetPartyPageUseCase } from "../../core/application/use-cases/GetPartyPage";
import { InMemoryExternalSignalRepository } from "../../infra/persistence/InMemoryExternalSignalRepository";
import { ListPendingIdentitiesUseCase } from "../../core/application/use-cases/ListPendingIdentities";
import { PartyIdentityState } from "../../core/domain/enums/PartyIdentityState";
import { Role } from "../../core/domain/enums/Role";
import { HttpLedgerReadAdapter } from "../../infra/ledger-read/HttpLedgerReadAdapter";
import { StubLedgerReadAdapter } from "../../infra/ledger-read/StubLedgerReadAdapter";
import { InMemoryLedgerSimulator } from "../../infra/ledger-sim/InMemoryLedgerSimulator";
import { InMemoryIdentityLinkRepository } from "../../infra/persistence/InMemoryIdentityLinkRepository";
import { InMemoryIntentRepository } from "../../infra/persistence/InMemoryIntentRepository";
import { InMemoryPartyRepository } from "../../infra/persistence/InMemoryPartyRepository";
import { InMemoryUserRepository } from "../../infra/persistence/InMemoryUserRepository";
import { InMemorySessionStore } from "../../infra/auth/InMemorySessionStore";
import { ScryptPasswordHasher } from "../../infra/auth/ScryptPasswordHasher";
import { seedUsers } from "../../infra/auth/seedUsers";
import type { PartyEvent } from "../../core/application/dtos/LedgerReadModels";
import type { PartyEventsPort } from "../../core/application/ports/PartyEventsPort";
import type { Candidate } from "../../core/domain/value-objects/Candidate";

/** §8.2: every event a party has any role in, under every identifier it has been known by. */
const USINA = "party-usina";
const JOAO = "party-joao";
const ARGO = "party-argo";

const event = (eventId: string, occurredAt: string, parties: [string, string][], over: Partial<PartyEvent> = {}): PartyEvent => ({
  eventId,
  eventType: "advance_payment",
  economicEffect: "cash_out",
  amount: "100.00",
  currency: "BRL",
  occurredAt,
  recordedAt: occurredAt,
  description: null,
  relatedEventId: null,
  objects: [],
  parties: parties.map(([partyId, role]) => ({ partyId, role, direction: "neutral", amount: null })),
  source: { system: "treasury", reference: `intent:${eventId}` },
  retracted: false,
  ...over,
});

/** A Ledger holding these events, answering by exact identifier, as the real one does. */
const ledgerWith = (events: PartyEvent[]): PartyEventsPort & { asked: string[] } => {
  const asked: string[] = [];
  return {
    asked,
    eventsOfParty: async (id) => {
      asked.push(id);
      return events.filter((e) => e.parties.some((p) => p.partyId === id));
    },
  };
};

async function world(events: PartyEvent[], links: [string, string][] = []) {
  const parties = new InMemoryPartyRepository();
  const save = (partyId: string, displayName: string, identityState = PartyIdentityState.IDENTIFIED) =>
    parties.save({ partyId, displayName, identityState, aliases: [], externalIds: [], attributes: {} });
  await save(JOAO, "João Silva");
  await save(ARGO, "Argo Ltda");
  await save("prov-1", "J. Silva", PartyIdentityState.PROVISIONAL);
  const repo = new InMemoryIdentityLinkRepository();
  for (const [fromIdentifier, toPartyId] of links) {
    await repo.append({ id: fromIdentifier, fromIdentifier, toPartyId, linkedBy: "cfo", linkedAt: "2026-11-06T12:00:00.000Z" });
  }
  const directory = new PartyDirectory(parties, undefined, repo);
  const ledger = ledgerWith(events);
  return { ledger, parties, repo, directory, view: new GetPartyEventsUseCase(ledger, directory) };
}

const available = <T extends { available: boolean }>(r: T | null) => {
  if (!r?.available) throw new Error("expected an available result");
  return r as Extract<T, { available: true }>;
};

describe("REQ-615 — todos os eventos em que a parte tem algum papel", () => {
  const history = [
    event("expected", "2026-08-01T12:00:00.000Z", [[USINA, "beneficiary"], [JOAO, "broker"]], { eventType: "commission_expected", economicEffect: "non_cash" }),
    event("final", "2026-09-01T12:00:00.000Z", [[USINA, "payer"], [ARGO, "payee"], [JOAO, "beneficiary"]]),
    event("advance", "2026-10-01T12:00:00.000Z", [[USINA, "payer"], [JOAO, "payee"]]),
    event("someone-else", "2026-10-02T12:00:00.000Z", [[USINA, "payer"], ["party-outra", "payee"]]),
  ];

  it("CA-615, REJ-615: o filtro João traz os três eventos, em papéis diferentes", async () => {
    const { view } = await world(history);

    const { events } = available(await view.execute(JOAO));

    expect(events.map((e) => e.eventId).sort()).toEqual(["advance", "expected", "final"]);
    expect(events.find((e) => e.eventId === "expected")?.roles[0].role).toBe("broker");
    expect(events.find((e) => e.eventId === "final")?.roles[0].role).toBe("beneficiary");
    expect(events.find((e) => e.eventId === "advance")?.roles[0].role).toBe("payee");
  });

  it("traz eventos sem movimento de caixa, que os movimentos de caixa não mostrariam", async () => {
    const { view } = await world(history);

    const { events } = available(await view.execute(JOAO));

    expect(events.find((e) => e.eventId === "expected")?.economicEffect).toBe("non_cash");
  });

  it("vem do mais recente para o mais antigo", async () => {
    const { view } = await world(history);

    const { events } = available(await view.execute(JOAO));

    expect(events.map((e) => e.eventId)).toEqual(["advance", "final", "expected"]);
  });

  it("REQ-612: serve para enxergar, e não soma nada", async () => {
    const { view } = await world(history);

    const result = available(await view.execute(JOAO));

    expect(Object.keys(result).sort()).toEqual(["available", "events", "identifiers", "party", "partyNames"]);
  });

  it("a empresa e a pessoa do mesmo evento aparecem, cada uma na sua visão", async () => {
    const { view } = await world(history);

    const argo = available(await view.execute(ARGO));

    expect(argo.events.map((e) => e.eventId)).toEqual(["final"]);
    expect(argo.partyNames[JOAO]).toBe("João Silva");
  });

  it("REJ-611: o evento basta, sem nenhum vínculo cadastral entre pessoa e empresa", async () => {
    const { parties, view } = await world(history);

    expect((await parties.findById(JOAO))?.attributes).toEqual({});
    expect(available(await view.execute(JOAO)).events.find((e) => e.eventId === "final")?.parties.map((p) => p.partyId)).toContain(ARGO);
  });

  it("uma parte sem eventos responde lista vazia, e isso é um resultado", async () => {
    const { view } = await world([]);

    expect(available(await view.execute(ARGO)).events).toEqual([]);
  });
});

describe("REQ-332 — o que foi gravado com outros identificadores", () => {
  const scattered = [
    event("e1", "2026-07-01T12:00:00.000Z", [[USINA, "payer"], ["Fornecedor Alfa", "payee"]]),
    event("e2", "2026-08-01T12:00:00.000Z", [[USINA, "payer"], ["ALFA LTDA", "payee"]]),
    event("e3", "2026-09-01T12:00:00.000Z", [[USINA, "payer"], ["prov-1", "payee"]]),
  ];
  const mapped: [string, string][] = [["Fornecedor Alfa", ARGO], ["ALFA LTDA", ARGO], ["prov-1", ARGO]];

  it("CA-332: a visão mostra os três, sob identificadores diferentes", async () => {
    const { view } = await world(scattered, mapped);

    const { events, identifiers } = available(await view.execute(ARGO));

    expect(events.map((e) => e.eventId).sort()).toEqual(["e1", "e2", "e3"]);
    expect(identifiers).toEqual([ARGO, "Fornecedor Alfa", "ALFA LTDA", "prov-1"]);
  });

  it("diz sob qual identificador cada evento foi gravado, sem alterar o evento", async () => {
    const { view } = await world(scattered, mapped);

    const { events } = available(await view.execute(ARGO));

    const e2 = events.find((e) => e.eventId === "e2")!;
    expect(e2.roles[0].recordedAs).toBe("ALFA LTDA");
    expect(e2.parties.map((p) => p.partyId)).toContain("ALFA LTDA");
  });

  it("os identificadores viram nomes para quem lê", async () => {
    const { view } = await world(scattered, mapped);

    expect(available(await view.execute(ARGO)).partyNames["ALFA LTDA"]).toBe("Argo Ltda");
  });

  it("CA-322: depois de ligar, a visão da parte mostra o fato da identidade provisória", async () => {
    const before = await world(scattered);
    expect(available(await before.view.execute(ARGO)).events).toEqual([]);

    const after = await world(scattered, [["prov-1", ARGO]]);
    expect(available(await after.view.execute(ARGO)).events.map((e) => e.eventId)).toEqual(["e3"]);
  });

  it("pedir pela identidade ligada leva à parte", async () => {
    const { view } = await world(scattered, mapped);

    const result = available(await view.execute("prov-1"));

    expect(result.party).toEqual({ partyId: ARGO, displayName: "Argo Ltda" });
    expect(result.events).toHaveLength(3);
  });

  it("um evento que cita dois identificadores da mesma parte aparece uma vez, com os dois papéis", async () => {
    const { view } = await world(
      [event("both", "2026-07-01T12:00:00.000Z", [["ALFA LTDA", "payer"], [ARGO, "beneficiary"]])],
      [["ALFA LTDA", ARGO]],
    );

    const { events } = available(await view.execute(ARGO));

    expect(events).toHaveLength(1);
    expect(events[0].roles.map((r) => r.recordedAs).sort()).toEqual([ARGO, "ALFA LTDA"].sort());
  });

  it("uma identidade provisória sem ligação mostra os próprios fatos", async () => {
    const { view } = await world(scattered);

    expect(available(await view.execute("prov-1")).events.map((e) => e.eventId)).toEqual(["e3"]);
  });
});

describe("o que o Ledger disse", () => {
  it("REQ-524: um lançamento retirado aparece, e aparece como retirado", async () => {
    const { view } = await world([
      event("wrong", "2026-08-01T12:00:00.000Z", [[USINA, "payer"], [JOAO, "payee"]], { retracted: true, amount: "400.00" }),
      event("right", "2026-08-02T12:00:00.000Z", [[USINA, "payer"], [JOAO, "payee"]], { amount: "450.00" }),
    ]);

    const { events } = available(await view.execute(JOAO));

    expect(events.map((e) => [e.amount, e.retracted])).toEqual([["450.00", false], ["400.00", true]]);
  });

  it("REQ-602: com o Ledger fora do ar, diz indisponível, e nunca lista vazia", async () => {
    const { directory } = await world([]);
    const down = new GetPartyEventsUseCase({ eventsOfParty: () => Promise.reject(new Error("down")) }, directory);

    const result = await down.execute(JOAO);

    expect(result).toEqual({ available: false, party: { partyId: JOAO, displayName: "João Silva" } });
  });

  it("se um dos identificadores falha, não mostra metade da história como se fosse tudo", async () => {
    const { directory } = await world([], [["ALFA LTDA", JOAO]]);
    const partly = new GetPartyEventsUseCase(
      {
        eventsOfParty: (id) =>
          id === "ALFA LTDA"
            ? Promise.reject(new Error("down"))
            : Promise.resolve([event("e", "2026-08-01T12:00:00.000Z", [[JOAO, "payee"]])]),
      },
      directory,
    );

    expect((await partly.execute(JOAO))?.available).toBe(false);
  });

  it("uma parte que o cadastro não conhece é null, sem consultar o Ledger", async () => {
    const { view, ledger } = await world([]);

    expect(await view.execute("party-desconhecida")).toBeNull();
    expect(ledger.asked).toEqual([]);
  });
});

describe("os adaptadores", () => {
  it("HTTP: pergunta ao Ledger pelo identificador, codificado, e traz o que ele respondeu", async () => {
    let asked = "";
    const ledger = createHttpServer((req, res) => {
      asked = req.url ?? "";
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          data: [
            {
              id: "e1",
              eventType: "advance_payment",
              economicEffect: "cash_out",
              amount: "400.00",
              currency: "BRL",
              occurredAt: "2026-08-01T12:00:00.000Z",
              recordedAt: "2026-08-02T12:00:00.000Z",
              description: null,
              relatedEventId: null,
              objects: [{ objectId: "o", objectType: "advance", relation: "originates" }],
              parties: [{ partyId: "ALFA & CIA", role: "payee", direction: "neutral", amount: null }],
              source: { system: "s", reference: "r" },
              retracted: true,
              reporter: { reporterType: "user", reporterId: "user-cfo", reporterName: null },
              retractedBy: {
                eventId: "r1",
                occurredAt: "2026-08-03T12:00:00.000Z",
                recordedAt: "2026-08-03T13:00:00.000Z",
                reporter: { reporterType: "user", reporterId: "user-gestora", reporterName: "Gestora" },
              },
            },
          ],
          total: 1,
        }),
      );
    });
    await new Promise<void>((resolve) => ledger.listen(0, resolve));
    const url = `http://127.0.0.1:${(ledger.address() as AddressInfo).port}`;

    const events = await new HttpLedgerReadAdapter(url).eventsOfParty("ALFA & CIA");
    await new Promise<void>((resolve) => ledger.close(() => resolve()));

    expect(asked).toBe("/api/events/by-party?partyId=ALFA%20%26%20CIA");
    expect(events[0]).toMatchObject({ eventId: "e1", recordedAt: "2026-08-02T12:00:00.000Z", retracted: true });
    expect(events[0].reporter).toEqual({ type: "user", id: "user-cfo", name: null });
    expect(events[0].retractedBy).toEqual({
      eventId: "r1",
      occurredAt: "2026-08-03T12:00:00.000Z",
      recordedAt: "2026-08-03T13:00:00.000Z",
      reporter: { type: "user", id: "user-gestora", name: "Gestora" },
    });
  });

  it("simulador: lê de volta o que foi enviado a ele", async () => {
    const simulator = new InMemoryLedgerSimulator();
    await simulator.submit({
      sourceReference: "intent:1",
      eventType: "payroll_payment",
      economicEffect: "cash_out",
      occurredAt: "2026-08-01T12:00:00.000Z",
      amount: "10.00",
      currency: "BRL",
      parties: [{ partyId: JOAO, role: "payee", direction: "in" }],
      objects: [],
      reason: { type: "x", description: "", confidence: "high", requiresFollowup: false },
      reporter: { reporterType: "user", reporterId: "cfo", channel: "web" },
    } as unknown as Candidate);

    expect((await simulator.eventsOfParty(JOAO)).map((e) => e.eventType)).toEqual(["payroll_payment"]);
    expect(await simulator.eventsOfParty(ARGO)).toEqual([]);
  });

  it("stub: não tem eventos, e diz isso sem falhar", async () => {
    expect(await new StubLedgerReadAdapter().eventsOfParty(JOAO)).toEqual([]);
  });
});

describe("pelo servidor", () => {
  let server: Server;
  let baseUrl: string;
  const cookies: Record<string, string> = {};
  const history = [event("e1", "2026-08-01T12:00:00.000Z", [[USINA, "payer"], [JOAO, "payee"], ["ALFA & CIA", "beneficiary"]])];

  const get = (path: string, who?: string) =>
    fetch(`${baseUrl}${path}`, { headers: who ? { cookie: cookies[who] } : {} });

  beforeAll(async () => {
    const w = await world(history, [["ALFA & CIA", ARGO]]);
    const hasher = new ScryptPasswordHasher();
    const users = new InMemoryUserRepository(
      seedUsers(hasher, [{ id: "u-viewer", username: "viewer", displayName: "V", role: Role.VIEWER, password: "x" }]),
    );
    const unused = undefined as never;
    const app = createServer({
      auth: new AuthService(users, hasher, new InMemorySessionStore(3_600_000)),
      secureCookies: false,
      sessionTtlSeconds: 3600,
      partyDirectory: w.directory,
      getPartyEvents: w.view,
      getPartyPage: new GetPartyPageUseCase({
        directory: w.directory,
        ledger: {
          eventsOfParty: async (id) => history.filter((e) => e.parties.some((p) => p.partyId === id)),
          event: async () => null,
          lifecycle: async () => null,
          positions: async () => ({ data: [], total: 0, page: 1, limit: 200, totalPages: 0 }),
        },
        signals: new InMemoryExternalSignalRepository(),
        intents: new InMemoryIntentRepository(),
        clock: { now: () => "2026-11-12T12:00:00.000Z" },
      }),
      listPendingIdentities: new ListPendingIdentitiesUseCase(w.parties, w.repo, new InMemoryIntentRepository()),
      registerParty: unused, linkIdentity: unused, getDashboard: unused, startIntent: unused, advanceDialog: unused,
      applyAnswers: unused, interpretUtterance: unused, previewIntent: unused, submitIntent: unused,
      submitRectification: unused, decideIdentity: unused, listSettlementCandidates: unused, listPositionActions: unused,
      startPositionAction: unused, getIntent: unused, listIntents: unused, registerExternalSignal: unused, listExternalSignals: unused, getPolicySituation: unused, registerInsurerCredit: unused, listInsurerReceivables: unused, getObjectLifecycle: unused,
      getBookExposure: unused, listPositions: unused, listPayablePositions: unused, listCashMovements: unused,
      getLedgerEvent: unused,
    });
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", () => resolve()));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "viewer", password: "x" }),
    });
    cookies.viewer = (login.headers.get("set-cookie") ?? "").split(";")[0];
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it("REQ-401: o visualizador consulta a visão por parte", async () => {
    const res = await get(`/api/parties/${JOAO}/events`, "viewer");

    expect(res.status).toBe(200);
    expect(((await res.json()) as { events: unknown[] }).events).toHaveLength(1);
  });

  it("um identificador com caracteres especiais chega inteiro", async () => {
    const res = await get(`/api/parties/${encodeURIComponent("ALFA & CIA")}/events`, "viewer");

    expect(res.status).toBe(200);
    expect(((await res.json()) as { party: { partyId: string } }).party.partyId).toBe(ARGO);
  });

  it("a lista de nomes não traz documentos, nem o que já foi ligado", async () => {
    const res = await get("/api/parties/names", "viewer");
    const { parties } = (await res.json()) as { parties: Record<string, string>[] };

    expect(res.status).toBe(200);
    expect(parties.map((p) => p.partyId).sort()).toEqual([ARGO, JOAO, "prov-1"].sort());
    expect(Object.keys(parties[0]).sort()).toEqual(["displayName", "partyId", "state"]);
  });

  it("uma parte desconhecida é 404", async () => {
    expect((await get("/api/parties/party-desconhecida/events", "viewer")).status).toBe(404);
    expect((await get("/api/parties/party-desconhecida/page", "viewer")).status).toBe(404);
    expect((await get("/api/parties/party-desconhecida/positions/usinaOwes", "viewer")).status).toBe(404);
    expect((await get(`/api/parties/${JOAO}/positions/qualquer`, "viewer")).status).toBe(404);
  });

  it("o histórico é paginado e filtrado por conta própria, pela data de registro", async () => {
    const res = await get(`/api/parties/${JOAO}/history?page=1&limit=20&sortOrder=ASC&status=standing&eventType=advance_payment`, "viewer");

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ available: true, total: 1, page: 1, limit: 20 });
    expect((await get("/api/parties/party-desconhecida/history", "viewer")).status).toBe(404);
  });

  it("cada lado da Operação é paginado por conta própria", async () => {
    const res = await get(`/api/parties/${JOAO}/positions/partyOwes?page=2&limit=50&sortBy=dueAt&sortOrder=ASC`, "viewer");

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ available: true, side: "partyOwes", lines: [] });
  });

  it("REQ-638: o visualizador vê a página da parte, pela identidade a que o identificador foi ligado", async () => {
    const res = await get(`/api/parties/${encodeURIComponent("ALFA & CIA")}/page`, "viewer");
    const body = (await res.json()) as { available: boolean; party: { partyId: string }; history: { eventId?: string }[] };

    expect(res.status).toBe(200);
    expect(body.available).toBe(true);
    expect(body.party.partyId).toBe(ARGO);
    expect(body.history.map((h) => h.eventId)).toEqual(["e1"]);
  });

  it("quem não entrou no sistema não consulta", async () => {
    expect((await get(`/api/parties/${JOAO}/events`)).status).toBe(401);
    expect((await get("/api/parties/names")).status).toBe(401);
    expect((await get(`/api/parties/${JOAO}/page`)).status).toBe(401);
  });
});
