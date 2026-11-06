import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "http";
import type { AddressInfo } from "net";
import { createServer } from "../../presentation/web/api/server";
import { AuthService } from "../../core/application/services/AuthService";
import { StartIntentUseCase } from "../../core/application/use-cases/StartIntent";
import { ApplyAnswersUseCase } from "../../core/application/use-cases/ApplyAnswers";
import { SubmitIntentUseCase } from "../../core/application/use-cases/SubmitIntent";
import { GetTreasuryDashboardUseCase } from "../../core/application/use-cases/GetTreasuryDashboard";
import { CandidateMapper } from "../../core/application/services/CandidateMapper";
import { Role } from "../../core/domain/enums/Role";
import { IntentStatus } from "../../core/domain/enums/IntentStatus";
import { InMemoryIntentRepository } from "../../infra/persistence/InMemoryIntentRepository";
import { InMemoryUserRepository } from "../../infra/persistence/InMemoryUserRepository";
import { InMemoryAuditLog } from "../../infra/audit/InMemoryAuditLog";
import { InMemorySessionStore } from "../../infra/auth/InMemorySessionStore";
import { ScryptPasswordHasher } from "../../infra/auth/ScryptPasswordHasher";
import { seedUsers } from "../../infra/auth/seedUsers";
import { InMemoryLedgerSimulator } from "../../infra/ledger-sim/InMemoryLedgerSimulator";
import type { Candidate } from "../../core/domain/value-objects/Candidate";
import type { Clock } from "../../core/application/ports/Clock";
import type { IdGenerator } from "../../core/application/ports/IdGenerator";
import { PARTY, partyDirectory } from "../fixtures/parties";

/**
 * REQ-401 over the wire, through the real server, session and guards.
 *
 * `auth.test.ts` proves the permission table says the right thing. This proves the table is applied:
 * a route mounted outside its guard would pass that test and still let a viewer record a fact.
 */
const clock: Clock = { now: () => "2026-11-03T12:00:00.000Z" };

let server: Server;
let baseUrl: string;
let viewer: string;
let manager: string;
let secondManager: string;
let readyIntentId: string;
const repo = new InMemoryIntentRepository();
const submitted: Candidate[] = [];
const audit = new InMemoryAuditLog();

const send = (method: string, path: string, cookie?: string, body?: unknown) =>
  fetch(`${baseUrl}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

async function login(username: string, password: string): Promise<string> {
  const res = await send("POST", "/api/auth/login", undefined, { username, password });
  expect(res.status).toBe(200);
  return (res.headers.get("set-cookie") ?? "").split(";")[0];
}

beforeAll(async () => {
  const hasher = new ScryptPasswordHasher();
  const users = new InMemoryUserRepository(
    seedUsers(hasher, [
      { id: "user-cfo", username: "cfo", displayName: "CFO", role: Role.FINANCE_MANAGER, password: "treasury" },
      { id: "user-viewer", username: "viewer", displayName: "Analista", role: Role.VIEWER, password: "viewer" },
      { id: "user-gestora", username: "gestora", displayName: "Gestora", role: Role.FINANCE_MANAGER, password: "gestora" },
    ]),
  );
  const directory = partyDirectory();
  const simulator = new InMemoryLedgerSimulator();
  let n = 0;
  const ids: IdGenerator = { next: () => `intent-${++n}` };
  const applyAnswers = new ApplyAnswersUseCase(repo, clock, audit, directory);
  const startIntent = new StartIntentUseCase(repo, clock, ids, audit);
  const submitIntent = new SubmitIntentUseCase(
    repo,
    new CandidateMapper(PARTY.USINA),
    {
      submit: (candidate: Candidate) => {
        submitted.push(candidate);
        return simulator.submit(candidate);
      },
    },
    audit,
    clock,
    directory,
  );

  // The guards stop a refused request before any use case, so the routes not exercised here need
  // no collaborators. Had a guard been missing, the call would fail loudly on the absent one.
  const unused = undefined as never;
  const app = createServer({
    auth: new AuthService(users, hasher, new InMemorySessionStore(3_600_000)),
    secureCookies: false,
    sessionTtlSeconds: 3600,
    getDashboard: new GetTreasuryDashboardUseCase(simulator, PARTY.USINA, directory),
    startIntent,
    applyAnswers,
    submitIntent,
    advanceDialog: unused,
    interpretUtterance: unused,
    previewIntent: unused,
    submitRectification: unused,
    decideIdentity: unused,
    recordPartyAttribute: unused,
    listIncompleteParties: unused,
    listSettlementCandidates: unused,
    listPositionActions: unused,
    startPositionAction: unused,
    getIntent: unused,
    listIntents: unused,
    getObjectLifecycle: unused,
    getBookExposure: unused,
    listPositions: unused,
    listPayablePositions: unused,
    listCashMovements: unused,
    getLedgerEvent: unused,
  });
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  viewer = await login("viewer", "viewer");
  manager = await login("cfo", "treasury");
  secondManager = await login("gestora", "gestora");

  // A real intent, ready to submit, so "the viewer may not submit" is refused for the right reason.
  const started = await send("POST", "/api/conversation/start", manager, { scenarioId: "register_payroll" });
  readyIntentId = ((await started.json()) as { intentId: string }).intentId;
  const applied = await send("POST", `/api/conversation/${readyIntentId}/apply`, manager, {
    answers: [
      { key: "payee", value: PARTY.ACME },
      { key: "amount", value: "1500.00" },
      { key: "currency", value: "BRL" },
      { key: "occurredAt", value: "2026-11-03" },
    ],
  });
  expect(applied.status).toBe(200);
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe("REQ-401 — visualizador", () => {
  it("CA-401: abre o painel", async () => {
    const res = await send("GET", "/api/dashboard/overview", viewer);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { available: boolean }).available).toBe(true);
  });

  it.each([
    ["iniciar uma operação", "/api/conversation/start"],
    ["iniciar por texto livre", "/api/conversation/interpret"],
    ["iniciar a partir de uma posição", "/api/conversation/positions/any/start"],
    ["retificar", "/api/conversation/rectify"],
  ])("REJ-401: não pode %s", async (_label, path) => {
    const before = (await repo.listByUser("user-viewer")).length;
    const res = await send("POST", path, viewer, { scenarioId: "register_payroll", utterance: "folha" });
    expect(res.status).toBe(403);
    expect((await repo.listByUser("user-viewer")).length).toBe(before);
  });

  it.each(["answer", "apply", "interpret", "identity"])(
    "REJ-401: não pode alterar uma intenção existente por /%s",
    async (route) => {
      const res = await send("POST", `/api/conversation/${readyIntentId}/${route}`, viewer, {
        key: "amount",
        value: "9.00",
        answers: [{ key: "amount", value: "9.00" }],
        utterance: "9.00",
      });
      expect(res.status).toBe(403);
      expect((await repo.findById(readyIntentId))?.answers.amount).toBe("1500.00");
    },
  );

  it("REJ-401: não pode enviar, e nada chega ao Ledger", async () => {
    const res = await send("POST", `/api/conversation/${readyIntentId}/submit`, viewer);
    expect(res.status).toBe(403);
    expect(submitted).toHaveLength(0);
    expect((await repo.findById(readyIntentId))?.status).toBe(IntentStatus.AWAITING_CONFIRMATION);
  });
});

describe("REQ-401 — quem não entrou no sistema", () => {
  it.each([
    ["GET", "/api/dashboard/overview"],
    ["POST", "/api/conversation/start"],
  ])("%s %s responde 401", async (method, path) => {
    expect((await send(method, path)).status).toBe(401);
  });
});

describe("REQ-401 — gestor financeiro", () => {
  it("consulta, e a mesma intenção recusada ao visualizador é enviada por ele", async () => {
    expect((await send("GET", "/api/dashboard/overview", manager)).status).toBe(200);

    const res = await send("POST", `/api/conversation/${readyIntentId}/submit`, manager);
    expect(res.status).toBe(200);
    expect(submitted).toHaveLength(1);
    expect((await repo.findById(readyIntentId))?.status).toBe(IntentStatus.ACCEPTED);
  });

  it("CA-801: a auditoria registra quem enviou", async () => {
    const entries = await audit.listByIntent(readyIntentId);
    const submission = entries.find((e) => e.type === "intent.submitted");

    expect(submission?.actor).toEqual({ kind: "user", id: "user-cfo" });
  });

  it("CA-801: o autor do envio é quem está logado, não quem iniciou a intenção", async () => {
    const started = await send("POST", "/api/conversation/start", manager, { scenarioId: "register_payroll" });
    const { intentId } = (await started.json()) as { intentId: string };
    await send("POST", `/api/conversation/${intentId}/apply`, manager, {
      answers: [
        { key: "payee", value: PARTY.ACME },
        { key: "amount", value: "700.00" },
        { key: "currency", value: "BRL" },
        { key: "occurredAt", value: "2026-11-03" },
      ],
    });

    expect((await send("POST", `/api/conversation/${intentId}/submit`, secondManager)).status).toBe(200);

    const entries = await audit.listByIntent(intentId);
    expect(entries.find((e) => e.type === "intent.started")?.actor.id).toBe("user-cfo");
    expect(entries.find((e) => e.type === "intent.submitted")?.actor.id).toBe("user-gestora");
  });

  it("§11.1: editar uma intenção aceita responde 409 e não muda nada", async () => {
    const res = await send("POST", `/api/conversation/${readyIntentId}/apply`, manager, {
      mode: "edit",
      answers: [{ key: "amount", value: "9999.00" }],
    });

    expect(res.status).toBe(409);
    const intent = await repo.findById(readyIntentId);
    expect(intent?.status).toBe(IntentStatus.ACCEPTED);
    expect(intent?.answers.amount).toBe("1500.00");
  });
});
