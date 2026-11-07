import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Server } from "http";
import type { AddressInfo } from "net";
import Database from "better-sqlite3";
import { createServer } from "../../presentation/web/api/server";
import { AuthService } from "../../core/application/services/AuthService";
import { PartyDirectory } from "../../core/application/services/PartyDirectory";
import { CandidateMapper } from "../../core/application/services/CandidateMapper";
import { StartIntentUseCase } from "../../core/application/use-cases/StartIntent";
import { AdvanceDialogUseCase } from "../../core/application/use-cases/AdvanceDialog";
import { ApplyAnswersUseCase } from "../../core/application/use-cases/ApplyAnswers";
import { DecideIdentityUseCase } from "../../core/application/use-cases/DecideIdentity";
import { PreviewIntentUseCase } from "../../core/application/use-cases/PreviewIntent";
import { SubmitIntentUseCase } from "../../core/application/use-cases/SubmitIntent";
import { RegisterPartyUseCase } from "../../core/application/use-cases/RegisterParty";
import { LinkIdentityUseCase } from "../../core/application/use-cases/LinkIdentity";
import { ListPendingIdentitiesUseCase } from "../../core/application/use-cases/ListPendingIdentities";
import { Permission } from "../../core/domain/enums/Permission";
import { Role } from "../../core/domain/enums/Role";
import { IntentStatus } from "../../core/domain/enums/IntentStatus";
import { SqliteIntentRepository } from "../../infra/persistence/SqliteIntentRepository";
import { InMemoryUserRepository } from "../../infra/persistence/InMemoryUserRepository";
import { InMemoryAuditLog } from "../../infra/audit/InMemoryAuditLog";
import { InMemoryConversationLog } from "../../infra/audit/InMemoryConversationLog";
import { InMemorySessionStore } from "../../infra/auth/InMemorySessionStore";
import { ScryptPasswordHasher } from "../../infra/auth/ScryptPasswordHasher";
import { seedUsers } from "../../infra/auth/seedUsers";
import { SqlitePartyRepository } from "../../infra/persistence/SqlitePartyRepository";
import { SqliteIdentityLinkRepository } from "../../infra/persistence/SqliteIdentityLinkRepository";
import type { Candidate } from "../../core/domain/value-objects/Candidate";
import type { Clock } from "../../core/application/ports/Clock";
import type { IdGenerator } from "../../core/application/ports/IdGenerator";

/**
 * The party registry (§5) through the real server, sessions and guards, on a real SQLite file. A
 * restart closes the handles and reopens the file, with nothing carried over in memory.
 */
const clock: Clock = { now: () => "2026-11-06T15:00:00.000Z" };
const USINA = "party-usina";
const CNPJ = "12.345.678/0001-99";
const CPF = "123.456.789-09";

let dir: string;
let file: string;
let server: Server;
let baseUrl: string;
let handles: { close(): void }[] = [];
const cookies: Record<string, string> = {};
let world: ReturnType<typeof wire>;

function wire() {
  const parties = new SqlitePartyRepository(file);
  const links = new SqliteIdentityLinkRepository(file);
  handles.push(parties, links);
  const directory = new PartyDirectory(parties, undefined, links);
  const intents = new SqliteIntentRepository(file);
  handles.push(intents);
  const log = new InMemoryConversationLog();
  const audit = new InMemoryAuditLog();
  const submitted: Candidate[] = [];
  let n = 0;
  const ids: IdGenerator = { next: () => `id-${Date.now()}-${++n}` };
  const mapper = new CandidateMapper(USINA);
  const submission = {
    submit: async (candidate: Candidate) => {
      submitted.push(candidate);
      return { status: "accepted" as const, ledgerReference: `evt-${submitted.length}` };
    },
  };
  return {
    parties,
    links,
    directory,
    intents,
    submitted,
    log,
    start: new StartIntentUseCase(intents, clock, ids, log),
    advance: new AdvanceDialogUseCase(intents, clock, log, directory),
    apply: new ApplyAnswersUseCase(intents, clock, log, directory),
    decide: new DecideIdentityUseCase(intents, parties, clock, ids, log),
    preview: new PreviewIntentUseCase(intents, mapper, directory),
    submit: new SubmitIntentUseCase(intents, mapper, submission, audit, clock, directory),
    registerParty: new RegisterPartyUseCase(parties, clock, ids),
    linkIdentity: new LinkIdentityUseCase(parties, links, clock, ids),
    listPendingIdentities: new ListPendingIdentitiesUseCase(parties, links, intents),
  };
}

async function boot() {
  world = wire();
  const hasher = new ScryptPasswordHasher();
  const users = new InMemoryUserRepository(
    seedUsers(hasher, [
      { id: "user-curadora", username: "curadora", displayName: "C", role: Role.FINANCE_MANAGER, password: "x", grants: [Permission.PARTY_CURATE] },
      { id: "user-operador", username: "operador", displayName: "O", role: Role.FINANCE_MANAGER, password: "x" },
      { id: "user-viewer", username: "viewer", displayName: "V", role: Role.VIEWER, password: "x" },
      { id: "user-viewer-curador", username: "viewercurador", displayName: "VC", role: Role.VIEWER, password: "x", grants: [Permission.PARTY_CURATE] },
    ]),
  );
  const unused = undefined as never;
  const app = createServer({
    auth: new AuthService(users, hasher, new InMemorySessionStore(3_600_000)),
    secureCookies: false,
    sessionTtlSeconds: 3600,
    partyDirectory: world.directory,
    registerParty: world.registerParty,
    linkIdentity: world.linkIdentity,
    listPendingIdentities: world.listPendingIdentities,
    getPartyEvents: undefined as never,
    getDashboard: unused, startIntent: world.start, advanceDialog: world.advance, applyAnswers: world.apply,
    interpretUtterance: unused, previewIntent: world.preview, submitIntent: world.submit, submitRectification: unused,
    decideIdentity: world.decide, listSettlementCandidates: unused, listPositionActions: unused,
    startPositionAction: unused, getIntent: unused, listIntents: unused, getObjectLifecycle: unused,
    getBookExposure: unused, listPositions: unused, listPayablePositions: unused, listCashMovements: unused,
    getLedgerEvent: unused,
  });
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  for (const username of ["curadora", "operador", "viewer", "viewercurador"]) {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password: "x" }),
    });
    cookies[username] = (res.headers.get("set-cookie") ?? "").split(";")[0];
  }
}

async function shutdown() {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const handle of handles) handle.close();
  handles = [];
}

const send = (method: string, path: string, who?: string, body?: unknown) =>
  fetch(`${baseUrl}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(who ? { cookie: cookies[who] } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const read = async (res: Response) => (await res.json()) as Record<string, any>;

const register = (who: string, body: Record<string, unknown>) => send("POST", "/api/parties", who, body);

async function registered(displayName: string, extra: Record<string, unknown> = {}): Promise<string> {
  const res = await register("curadora", { displayName, kind: "person", hasBankAccount: false, ...extra });
  expect(res.status).toBe(201);
  return (await read(res)).partyId;
}

const pendingNames = async (who = "operador") =>
  (await read(await send("GET", "/api/parties/pending", who))).pending.map((p: { displayName: string }) => p.displayName);

/** A payroll the operator takes through the conversation for someone not registered. */
async function payrollFor(name: string) {
  const started = await read(await send("POST", "/api/conversation/start", "operador", { scenarioId: "register_payroll" }));
  const intentId: string = started.intentId;
  const answer = await read(await send("POST", `/api/conversation/${intentId}/answer`, "operador", { key: "payee", value: name }));
  return { intentId, answer };
}

async function completeAndSend(intentId: string) {
  for (const [key, value] of [["amount", "1500.00"], ["occurredAt", "2026-11-05"]]) {
    await send("POST", `/api/conversation/${intentId}/answer`, "operador", { key, value });
  }
  return read(await send("POST", `/api/conversation/${intentId}/submit`, "operador", {}));
}

const provisional = (intentId: string, mention: string) =>
  send("POST", `/api/conversation/${intentId}/identity`, "operador", { slot: "payee", kind: "provisional", mention });

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "treasury-registry-"));
  file = join(dir, "treasury.db");
  await boot();
});

afterEach(async () => {
  await shutdown();
  rmSync(dir, { recursive: true, force: true });
});

describe("REQ-402 — a curadoria é uma permissão, não um papel", () => {
  it("CA-311: sem curadoria, cadastrar é negado, e nada entra no cadastro", async () => {
    const before = (await world.parties.findAll()).length;

    const res = await register("operador", { displayName: "Maria Souza", kind: "person", hasBankAccount: false });

    expect(res.status).toBe(403);
    expect((await world.parties.findAll()).length).toBe(before);
  });

  it("o papel de gestor não dá curadoria; a curadoria não dá o papel", async () => {
    expect((await register("operador", { displayName: "A", kind: "person" })).status).toBe(403);

    // Um visualizador com curadoria cadastra, e continua sem poder operar.
    expect((await register("viewercurador", { displayName: "A", kind: "person" })).status).toBe(201);
    expect((await send("POST", "/api/conversation/start", "viewercurador", { scenarioId: "register_payroll" })).status).toBe(403);
  });

  it("o login informa a permissão, para a tela saber o que oferecer", async () => {
    const me = async (who: string) => (await read(await send("GET", "/api/auth/me", who))).user.permissions;

    expect(await me("curadora")).toContain("party:curate");
    expect(await me("operador")).not.toContain("party:curate");
  });

  it("quem não entrou no sistema não vê nada", async () => {
    expect((await send("GET", "/api/parties/pending")).status).toBe(401);
    expect((await send("GET", "/api/parties")).status).toBe(401);
    expect((await register("", { displayName: "A", kind: "person" })).status).toBe(401);
  });

  it("documentos só aparecem para quem tem curadoria", async () => {
    expect((await send("GET", "/api/parties", "operador")).status).toBe(403);
    expect((await send("GET", "/api/parties", "viewer")).status).toBe(403);
  });
});

describe("REQ-314 — CPF/CNPJ para quem recebe ou paga por conta bancária", () => {
  it("CA-314, REJ-314: a Argo, com conta bancária e sem CNPJ, é negada", async () => {
    const res = await register("curadora", { displayName: "Argo", kind: "company", hasBankAccount: true });

    expect(res.status).toBe(422);
    expect((await read(res)).error).toMatch(/CPF or CNPJ/);
  });

  it("CA-314: uma parte sem conta bancária e sem documento é aceita", async () => {
    expect((await register("curadora", { displayName: "João", kind: "person", hasBankAccount: false })).status).toBe(201);
  });

  it("com conta bancária e documento, é aceita, e o cadastro mostra o que foi dito", async () => {
    await registered("Argo", { kind: "company", hasBankAccount: true, document: CNPJ });

    const { parties } = await read(await send("GET", "/api/parties", "curadora"));
    expect(parties).toEqual([
      expect.objectContaining({ displayName: "Argo", kind: "company", document: "12345678000199", hasBankAccount: true }),
    ]);
  });

  it.each([
    ["CPF em empresa", { kind: "company", document: CPF }, /CNPJ has 14/],
    ["CNPJ em pessoa", { kind: "person", document: CNPJ }, /CPF has 11/],
    ["documento incompleto", { kind: "person", document: "123" }, /CPF has 11/],
  ])("%s é recusado", async (_label, extra, message) => {
    const res = await register("curadora", { displayName: "A", hasBankAccount: true, ...extra });

    expect(res.status).toBe(422);
    expect((await read(res)).error).toMatch(message);
  });

  it("o mesmo documento não entra duas vezes", async () => {
    await registered("Argo", { kind: "company", document: CNPJ });

    const res = await register("curadora", { displayName: "Argo Serviços", kind: "company", document: CNPJ });

    expect(res.status).toBe(422);
    expect((await read(res)).error).toMatch(/already has this document/);
  });

  it("um nome é obrigatório", async () => {
    expect((await register("curadora", { displayName: "   ", kind: "person" })).status).toBe(422);
  });

  it("REJ-313: o cliente final não é um tipo de parte", async () => {
    const res = await register("curadora", { displayName: "Cliente Y", kind: "client", hasBankAccount: false });

    expect(res.status).toBe(422);
    expect(await world.parties.findAll()).toEqual([]);
  });
});

describe("REQ-311 — quem opera não cria parte", () => {
  it("REJ-311: a rota não aceita mais criar parte durante a operação", async () => {
    const { intentId } = await payrollFor("Fornecedor Novo");

    const res = await send("POST", `/api/conversation/${intentId}/identity`, "operador", {
      slot: "payee",
      kind: "create",
      mention: "Fornecedor Novo",
    });

    expect(res.status).toBe(422);
    expect(await world.parties.findAll()).toEqual([]);
  });

  it("o que nasce na operação é provisório, e não entra no cadastro", async () => {
    const { intentId } = await payrollFor("Maria Souza");
    await provisional(intentId, "Maria Souza");

    expect((await read(await send("GET", "/api/parties", "curadora"))).parties).toEqual([]);
  });

  it("uma parte cadastrada é encontrada, sem nada a decidir", async () => {
    const maria = await registered("Maria Souza");

    const { intentId, answer } = await payrollFor("maria souza");

    expect(answer.identity.resolution.kind).toBe("resolved");
    expect((await world.intents.findById(intentId))?.answers.payee).toBe(maria);
  });
});

describe("REQ-320 — o fato é registrado mesmo sem cadastro", () => {
  it("CA-320, REJ-320: a folha paga a quem não está cadastrada vai ao Ledger, com a identidade provisória", async () => {
    const { intentId, answer } = await payrollFor("Maria Souza");
    expect(answer.identity.resolution.kind).toBe("new");

    const { decision } = await read(await provisional(intentId, "Maria Souza"));
    const result = await completeAndSend(intentId);

    expect(result.status).toBe("accepted");
    expect(world.submitted[0].parties.map((p) => p.partyId)).toContain(decision.partyId);
    expect(decision.partyId).toMatch(/^party-/);
  });

  it("REQ-105: ao Ledger só vai o identificador, nunca o nome", async () => {
    const { intentId } = await payrollFor("Maria Souza");
    await provisional(intentId, "Maria Souza");

    await completeAndSend(intentId);

    expect(JSON.stringify(world.submitted[0])).not.toContain("Maria");
  });

  it("D4: a mesma pessoa reaproveita a identidade provisória, em qualquer grafia normalizada", async () => {
    const first = await payrollFor("Maria Souza");
    const { decision } = await read(await provisional(first.intentId, "Maria Souza"));
    await completeAndSend(first.intentId);

    const second = await payrollFor("MARIA SOUZA");

    expect(second.answer.identity.resolution).toMatchObject({ kind: "resolved", partyId: decision.partyId });
    expect(await pendingNames()).toEqual(["Maria Souza"]);
  });

  it("decidir de novo pelo mesmo nome também não cria outra", async () => {
    const first = await payrollFor("Maria Souza");
    const a = await read(await provisional(first.intentId, "Maria Souza"));
    const started = await read(await send("POST", "/api/conversation/start", "operador", { scenarioId: "register_tax" }));

    const b = await read(await provisional(started.intentId, "maria souza"));

    expect(b.decision.partyId).toBe(a.decision.partyId);
  });

  it("uma identidade provisória não é marcada como não identificada: sabe-se quem é (Q-036)", async () => {
    const { intentId } = await payrollFor("Maria Souza");
    await provisional(intentId, "Maria Souza");

    await completeAndSend(intentId);

    expect(world.submitted[0].reason.requiresFollowup).toBe(false);
  });
});

describe("REQ-321 — a notificação", () => {
  it("REJ-321: uma identidade provisória sem resolução aparece, para todos", async () => {
    const { intentId } = await payrollFor("Maria Souza");
    await provisional(intentId, "Maria Souza");
    await completeAndSend(intentId);

    for (const who of ["curadora", "operador", "viewer"]) {
      expect(await pendingNames(who)).toEqual(["Maria Souza"]);
    }
  });

  it("REQ-302: a contraparte não identificável entra na mesma notificação", async () => {
    const started = await read(await send("POST", "/api/conversation/start", "operador", { scenarioId: "register_commission_received" }));
    await send("POST", `/api/conversation/${started.intentId}/identity`, "operador", {
      slot: "payer",
      kind: "unidentifiable",
      justification: "O banco não informou o remetente",
    });
    await completeAndSend(started.intentId);

    const { pending } = await read(await send("GET", "/api/parties/pending", "viewer"));
    expect(pending).toEqual([expect.objectContaining({ kind: "unidentifiable" })]);
  });

  it("uma conversa abandonada não gera notificação: não há fato a cobrar", async () => {
    const { intentId } = await payrollFor("Maria Sozua");
    await provisional(intentId, "Maria Sozua");

    expect(await pendingNames()).toEqual([]);
  });

  it("pronta para envio também não: sem fato no Ledger, nada a cobrar", async () => {
    const { intentId } = await payrollFor("Maria Souza");
    await provisional(intentId, "Maria Souza");
    for (const [key, value] of [["amount", "1500.00"], ["occurredAt", "2026-11-05"]]) {
      await send("POST", `/api/conversation/${intentId}/answer`, "operador", { key, value });
    }

    // Pronta para envio, mas não enviada.
    expect((await world.intents.findById(intentId))?.status).toBe(IntentStatus.AWAITING_CONFIRMATION);
    expect(await pendingNames()).toEqual([]);
  });

  it("a identidade de uma conversa abandonada passa a contar quando um fato a usa", async () => {
    const abandoned = await payrollFor("Maria Souza");
    await provisional(abandoned.intentId, "Maria Souza");
    expect(await pendingNames()).toEqual([]);

    const { intentId } = await payrollFor("Maria Souza");
    await completeAndSend(intentId);

    expect(await pendingNames()).toEqual(["Maria Souza"]);
  });

  it("uma parte cadastrada não gera notificação", async () => {
    await registered("Maria Souza");

    expect(await pendingNames()).toEqual([]);
  });
});

describe("REQ-322 — quem tem curadoria resolve ligando a uma parte cadastrada", () => {
  async function provisionalFact() {
    const { intentId } = await payrollFor("Maria Souza");
    const { decision } = await read(await provisional(intentId, "Maria Souza"));
    await completeAndSend(intentId);
    return { intentId, identifier: decision.partyId as string };
  }

  it("CA-322: ligar faz a notificação sumir", async () => {
    const { identifier } = await provisionalFact();
    const maria = await registered("Maria Souza", { document: CPF });

    const res = await send("POST", "/api/parties/links", "curadora", { identifier, partyId: maria });

    expect(res.status).toBe(201);
    expect((await read(res)).link).toMatchObject({ fromIdentifier: identifier, toPartyId: maria, linkedBy: "user-curadora" });
    expect(await pendingNames()).toEqual([]);
  });

  it("CA-322: depois de ligar, a parte responde pelo identificador antigo", async () => {
    const { identifier } = await provisionalFact();
    const maria = await registered("Maria de Souza");
    await send("POST", "/api/parties/links", "curadora", { identifier, partyId: maria });

    expect(await world.directory.identifiersOf(maria)).toEqual([maria, identifier]);
    expect((await world.directory.get(identifier))?.displayName).toBe("Maria de Souza");
  });

  it("depois de ligar, o nome leva à parte cadastrada, sem escolha", async () => {
    const { identifier } = await provisionalFact();
    const maria = await registered("Maria Souza");

    // Antes de ligar, são dois com o mesmo nome: o operador escolhe.
    expect((await payrollFor("Maria Souza")).answer.identity.resolution.kind).toBe("similar");

    await send("POST", "/api/parties/links", "curadora", { identifier, partyId: maria });

    expect((await payrollFor("Maria Souza")).answer.identity.resolution).toMatchObject({ kind: "resolved", partyId: maria });
  });

  it("REJ-322: quem não tem curadoria não resolve", async () => {
    const { identifier } = await provisionalFact();
    const maria = await registered("Maria Souza");

    expect((await send("POST", "/api/parties/links", "operador", { identifier, partyId: maria })).status).toBe(403);
    expect(await pendingNames()).toEqual(["Maria Souza"]);
  });

  it("só se liga a uma parte cadastrada", async () => {
    const { identifier } = await provisionalFact();
    const other = await payrollFor("Outra Pessoa");
    const { decision } = await read(await provisional(other.intentId, "Outra Pessoa"));

    for (const partyId of [decision.partyId, "party-inexistente"]) {
      const res = await send("POST", "/api/parties/links", "curadora", { identifier, partyId });
      expect(res.status).toBe(422);
    }
  });

  it("REJ-331: uma ligação não é trocada por outra (DEC-015)", async () => {
    const { identifier } = await provisionalFact();
    const a = await registered("Maria A");
    const b = await registered("Maria B");
    await send("POST", "/api/parties/links", "curadora", { identifier, partyId: a });

    const res = await send("POST", "/api/parties/links", "curadora", { identifier, partyId: b });

    expect(res.status).toBe(422);
    expect(await world.directory.identifiersOf(a)).toContain(identifier);
    expect(await world.directory.identifiersOf(b)).toEqual([b]);
  });

  it("a ligação não pode apontar para uma parte que já foi ligada a outra, nem criar um ciclo", async () => {
    const a = await registered("A");
    const b = await registered("B");
    await send("POST", "/api/parties/links", "curadora", { identifier: a, partyId: b });

    expect((await send("POST", "/api/parties/links", "curadora", { identifier: b, partyId: a })).status).toBe(422);
    expect((await send("POST", "/api/parties/links", "curadora", { identifier: "x", partyId: a })).status).toBe(422);
    expect((await send("POST", "/api/parties/links", "curadora", { identifier: b, partyId: b })).status).toBe(422);
  });

  it("REJ-330, REJ-332: ligar não envia nada ao Ledger, e o fato registrado continua igual", async () => {
    const { intentId, identifier } = await provisionalFact();
    const sentBefore = JSON.stringify(world.submitted);
    const maria = await registered("Maria Souza");

    await send("POST", "/api/parties/links", "curadora", { identifier, partyId: maria });

    expect(JSON.stringify(world.submitted)).toBe(sentBefore);
    const intent = await world.intents.findById(intentId);
    expect(intent?.answers.payee).toBe(identifier);
    expect(intent?.status).toBe(IntentStatus.ACCEPTED);
  });
});

describe("REQ-332 — o passado é mapeado, não corrigido", () => {
  it("CA-332: identificadores antigos, sem cadastro próprio, passam a ser a mesma parte", async () => {
    const alfa = await registered("Alfa Serviços Ltda", { kind: "company" });

    for (const identifier of ["Fornecedor Alfa", "ALFA LTDA"]) {
      expect((await send("POST", "/api/parties/links", "curadora", { identifier, partyId: alfa })).status).toBe(201);
    }

    expect(await world.directory.identifiersOf(alfa)).toEqual([alfa, "Fornecedor Alfa", "ALFA LTDA"]);
    expect((await world.directory.get("ALFA LTDA"))?.displayName).toBe("Alfa Serviços Ltda");
    expect((await payrollFor("Fornecedor Alfa")).answer.identity.resolution).toMatchObject({ kind: "resolved", partyId: alfa });
  });
});

describe("mesmo nome exato", () => {
  it("dois cadastros com o mesmo nome viram uma escolha, e nada é registrado até escolher", async () => {
    const a = await registered("João Silva", { document: CPF });
    const b = await registered("João Silva");

    const { intentId, answer } = await payrollFor("João Silva");

    expect(answer.identity.resolution.kind).toBe("similar");
    expect(answer.identity.resolution.candidates.map((c: { partyId: string }) => c.partyId).sort()).toEqual([a, b].sort());
    expect((await world.intents.findById(intentId))?.answers.payee).toBeUndefined();

    await send("POST", `/api/conversation/${intentId}/answer`, "operador", { key: "payee", value: b });
    expect((await world.intents.findById(intentId))?.answers.payee).toBe(b);
  });
});

describe("depois de reiniciar", () => {
  it("o cadastro, as provisórias e as ligações continuam lá", async () => {
    const { intentId } = await payrollFor("Pessoa Pendente");
    await provisional(intentId, "Pessoa Pendente");
    await completeAndSend(intentId);
    const second = await payrollFor("Maria Souza");
    const { decision } = await read(await provisional(second.intentId, "Maria Souza"));
    const maria = await registered("Maria Souza");
    await send("POST", "/api/parties/links", "curadora", { identifier: decision.partyId, partyId: maria });

    await shutdown();
    await boot();

    expect(await pendingNames()).toEqual(["Pessoa Pendente"]);
    expect(await world.directory.identifiersOf(maria)).toEqual([maria, decision.partyId]);
  });
});

describe("REJ-331 — direto no banco", () => {
  const raw = () => {
    const db = new Database(file);
    handles.push(db);
    return db;
  };

  beforeEach(async () => {
    const a = await registered("Alfa");
    await send("POST", "/api/parties/links", "curadora", { identifier: "ALFA LTDA", partyId: a });
  });

  it.each([
    ["apagar", "DELETE FROM identity_links"],
    ["reescrever", "UPDATE identity_links SET to_party_id = 'outra'"],
  ])("%s uma ligação é recusado", (_label, statement) => {
    expect(() => raw().exec(statement)).toThrow(/append-only/);
    expect((raw().prepare("SELECT count(*) AS n FROM identity_links").get() as { n: number }).n).toBe(1);
  });

  it("um identificador não recebe duas ligações", () => {
    expect(() =>
      raw()
        .prepare("INSERT INTO identity_links (id, from_identifier, to_party_id, linked_by, linked_at) VALUES ('z', 'ALFA LTDA', 'b', 'c', 'd')")
        .run(),
    ).toThrow(/UNIQUE/);
  });

  it("os guardas sobrevivem a reabrir o banco", async () => {
    await shutdown();
    await boot();

    expect(() => raw().exec("DELETE FROM identity_links")).toThrow(/append-only/);
  });
});
