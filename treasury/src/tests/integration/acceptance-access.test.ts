import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Server } from "http";
import type { AddressInfo } from "net";
import { createServer, type ServerDeps } from "../../presentation/web/api/server";
import { Role } from "../../core/domain/enums/Role";
import { Permission } from "../../core/domain/enums/Permission";
import { ManualClock, accessWorld, testUsers, tokenOf, PUBLIC_BASE_URL } from "../fixtures/access";

/**
 * §6 (Acesso), adopted from the authentication template on 2026-11-13, over the wire: the real server,
 * session cookie and guards. The access module is the only collaborator; every business route is left
 * unwired, which is enough here because the guards must refuse before any use case runs (REQ-430).
 */

const HOUR = 3_600_000;
const STRONG = "uma senha longa o bastante";

let server: Server;
let baseUrl: string;
let clock: ManualClock;
let world: ReturnType<typeof accessWorld>;

type Json = Record<string, unknown>;

const send = (method: string, path: string, opts: { cookie?: string; body?: unknown; origin?: string } = {}) =>
  fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(opts.cookie ? { cookie: opts.cookie } : {}),
      ...(opts.origin ? { origin: opts.origin } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });

async function login(email: string, password: string): Promise<string> {
  const res = await send("POST", "/api/auth/login", { body: { email, password } });
  expect(res.status).toBe(200);
  return (res.headers.get("set-cookie") ?? "").split(";")[0];
}

const loginStatus = async (email: string, password: string) =>
  (await send("POST", "/api/auth/login", { body: { email, password } })).status;

async function invite(admin: string, email: string, role: Role): Promise<string> {
  const res = await send("POST", "/api/users/invites", { cookie: admin, body: { email, role } });
  expect(res.status).toBe(201);
  return ((await res.json()) as { link: string }).link;
}

async function accept(link: string, password = STRONG, name?: string) {
  return send("POST", "/api/auth/invites/accept", { body: { token: tokenOf(link), password, name } });
}

/** Invites, accepts and logs in: the normal way a person gets into the Treasury. */
async function onboard(admin: string, email: string, role: Role): Promise<string> {
  expect((await accept(await invite(admin, email, role))).status).toBe(201);
  return login(email, STRONG);
}

async function start(users = testUsers(accessWorld().hasher, [])) {
  clock = new ManualClock();
  world = accessWorld(clock, users);
  const unused = undefined as never;
  const deps: ServerDeps = {
    auth: world.auth,
    userAdmin: world.userAdmin,
    trustedOrigins: [PUBLIC_BASE_URL],
    secureCookies: false,
    sessionTtlSeconds: 12 * 3600,
    getDashboard: unused, getObjectLifecycle: unused, getLedgerEvent: unused, getBookExposure: unused,
    listPositions: unused, listPayablePositions: unused, listCashMovements: unused, startIntent: unused,
    advanceDialog: unused, applyAnswers: unused, interpretUtterance: unused, previewIntent: unused,
    submitIntent: unused, submitRectification: unused, decideIdentity: unused, partyDirectory: unused,
    registerParty: unused, linkIdentity: unused, listPendingIdentities: unused, getPartyEvents: unused,
    getPartyPage: unused, listSettlementCandidates: unused, listPositionActions: unused,
    startPositionAction: unused, getIntent: unused, listIntents: unused, registerExternalSignal: unused,
    listExternalSignals: unused, getPolicySituation: unused, registerInsurerCredit: unused,
    listInsurerReceivables: unused,
  };
  server = createServer(deps).listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

/** The first administrator, born of the server command (REQ-405) and an accepted invite. */
async function firstAdmin(email = "cfo@usina.test"): Promise<string> {
  const { link } = await world.userAdmin.issueFirstAdminInvite(email);
  expect((await accept(link, STRONG, "CFO")).status).toBe(201);
  return login(email, STRONG);
}

beforeEach(() => start());
afterEach(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe("REQ-410 — tudo exige login", () => {
  it.each([
    ["GET", "/api/dashboard/overview"],
    ["POST", "/api/conversation/start"],
    ["GET", "/api/intents"],
    ["GET", "/api/signals"],
    ["GET", "/api/parties/names"],
    ["GET", "/api/parties/pending"],
    ["GET", "/api/users"],
    ["POST", "/api/users/invites"],
    ["GET", "/api/auth/me"],
    ["GET", "/api/rota-que-ainda-nao-existe"],
  ])("CA-418: %s %s sem sessão responde 401", async (method, path) => {
    expect((await send(method, path, { body: method === "POST" ? {} : undefined })).status).toBe(401);
  });

  it("CA-418: as exceções são só o login, o aceite do convite e a saúde do serviço", async () => {
    expect((await send("POST", "/api/auth/login", { body: { email: "x@y.z", password: "p" } })).status).toBe(401);
    expect((await send("POST", "/api/auth/invites/accept", { body: { token: "nada", password: STRONG } })).status).toBe(400);
    expect((await send("GET", "/health")).status).toBe(200);
  });
});

describe("REQ-405, REQ-407 — primeiro administrador, sem usuário padrão", () => {
  it("REJ-407: um Treasury novo não tem usuário nenhum", async () => {
    expect(await world.users.list()).toHaveLength(0);
    for (const [email, password] of [["cfo", "treasury"], ["viewer", "viewer"], ["admin@usina.test", "admin"]]) {
      expect(await loginStatus(email, password)).toBe(401);
    }
  });

  it("CA-420: o comando do primeiro administrador emite um convite, e só o aceite cria o usuário", async () => {
    const { link } = await world.userAdmin.issueFirstAdminInvite("cfo@usina.test");
    expect(link.startsWith(`${PUBLIC_BASE_URL}/?convite=`)).toBe(true);
    expect(await world.users.list()).toHaveLength(0);
    expect((await accept(link, STRONG, "CFO")).status).toBe(201);
    const [cfo] = await world.users.list();
    expect(cfo.role).toBe(Role.ADMIN);
  });

  it("CA-420: com um administrador ativo, o comando do primeiro administrador recusa", async () => {
    await firstAdmin();
    await expect(world.userAdmin.issueFirstAdminInvite("outro@usina.test")).rejects.toMatchObject({ code: "admin_exists" });
  });
});

describe("REQ-411, REQ-412 — login, logout e sessão", () => {
  it("CA-402: o login abre a sessão; depois do logout, a mesma sessão é recusada", async () => {
    const admin = await firstAdmin();
    expect((await send("GET", "/api/auth/me", { cookie: admin })).status).toBe(200);
    expect((await send("POST", "/api/auth/logout", { cookie: admin })).status).toBe(200);
    expect((await send("GET", "/api/auth/me", { cookie: admin })).status).toBe(401);
  });

  it("o cookie da sessão é HttpOnly e SameSite=Strict, e não carrega a senha", async () => {
    await firstAdmin();
    const res = await send("POST", "/api/auth/login", { body: { email: "cfo@usina.test", password: STRONG } });
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).not.toContain(STRONG);
  });

  it("CA-403: a sessão vale até 12 horas depois do login, qualquer que seja o uso", async () => {
    const admin = await firstAdmin();
    clock.advance(12 * HOUR - 60_000);
    expect((await send("GET", "/api/auth/me", { cookie: admin })).status).toBe(200);
    clock.advance(2 * 60_000);
    expect((await send("GET", "/api/auth/me", { cookie: admin })).status).toBe(401);
  });

  it("REQ-400: o usuário é o e-mail, sem diferença de maiúsculas, e a exibição é o nome", async () => {
    await firstAdmin();
    const res = await send("POST", "/api/auth/login", { body: { email: "  CFO@Usina.Test ", password: STRONG } });
    expect(res.status).toBe(200);
    const { user } = (await res.json()) as { user: Json };
    expect(user).toMatchObject({ email: "cfo@usina.test", name: "CFO", displayName: "CFO", role: Role.ADMIN });
    expect(JSON.stringify(user)).not.toMatch(/password|salt|hash/i);
  });
});

describe("REQ-413, REQ-414 — recusa uniforme e suspensão", () => {
  it("CA-404: e-mail inexistente, senha errada e usuário desativado recebem a mesma resposta", async () => {
    const admin = await firstAdmin();
    await onboard(admin, "saiu@usina.test", Role.FINANCE_MANAGER);
    const leaver = (await world.users.list()).find((u) => u.email === "saiu@usina.test")!;
    expect((await send("POST", `/api/users/${leaver.id}/deactivate`, { cookie: admin })).status).toBe(200);

    const answers = await Promise.all(
      [["ninguem@usina.test", STRONG], ["cfo@usina.test", "senha errada qualquer"], ["saiu@usina.test", STRONG]].map(
        async ([email, password]) => {
          const res = await send("POST", "/api/auth/login", { body: { email, password } });
          return { status: res.status, body: await res.text() };
        },
      ),
    );
    expect(answers[0].status).toBe(401);
    expect(new Set(answers.map((a) => JSON.stringify(a)))).toHaveLength(1);
  });

  it("CA-405: depois de 5 falhas seguidas, a sexta é recusada mesmo com a senha certa; 15 minutos depois, volta", async () => {
    await firstAdmin();
    for (let i = 0; i < 5; i++) expect(await loginStatus("cfo@usina.test", "senha errada qualquer")).toBe(401);
    expect(await loginStatus("cfo@usina.test", STRONG)).toBe(401);
    clock.advance(15 * 60_000 + 1000);
    expect(await loginStatus("cfo@usina.test", STRONG)).toBe(200);
  });

  it("REQ-414: um login bem-sucedido zera a contagem", async () => {
    await firstAdmin();
    for (let i = 0; i < 4; i++) await loginStatus("cfo@usina.test", "senha errada qualquer");
    expect(await loginStatus("cfo@usina.test", STRONG)).toBe(200);
    for (let i = 0; i < 4; i++) await loginStatus("cfo@usina.test", "senha errada qualquer");
    expect(await loginStatus("cfo@usina.test", STRONG)).toBe(200);
  });
});

describe("REQ-420–REQ-422 — convite", () => {
  it("CA-407: o aceite cria o usuário ativo com o papel e o nome; o mesmo link, de novo, é recusado", async () => {
    const admin = await firstAdmin();
    const link = await invite(admin, "ana@usina.test", Role.FINANCE_MANAGER);
    expect((await accept(link, STRONG, "Ana")).status).toBe(201);
    const ana = (await world.users.list()).find((u) => u.email === "ana@usina.test")!;
    expect(ana).toMatchObject({ role: Role.FINANCE_MANAGER, displayName: "Ana", isActive: true });
    const again = await accept(link, "outra senha bem longa");
    expect(again.status).toBe(400);
    expect(await again.json()).toEqual({ error: "invalid_invite" });
  });

  it("FA-405: aceito sem nome, a exibição usa o e-mail", async () => {
    const admin = await firstAdmin();
    const res = await send("POST", "/api/auth/login", {
      body: { email: "bia@usina.test", password: STRONG },
    });
    expect(res.status).toBe(401);
    await accept(await invite(admin, "bia@usina.test", Role.VIEWER));
    const me = await send("GET", "/api/auth/me", { cookie: await login("bia@usina.test", STRONG) });
    expect(((await me.json()) as { user: Json }).user.displayName).toBe("bia@usina.test");
  });

  it("CA-408: um convite com mais de 72 horas é recusado", async () => {
    const admin = await firstAdmin();
    const link = await invite(admin, "ana@usina.test", Role.FINANCE_MANAGER);
    clock.advance(72 * HOUR + 1000);
    expect(await (await accept(link)).json()).toEqual({ error: "invalid_invite" });
  });

  it("CA-408, FA-401: reenviado o convite, só o último vale", async () => {
    const admin = await firstAdmin();
    const first = await invite(admin, "ana@usina.test", Role.FINANCE_MANAGER);
    const second = await invite(admin, "ana@usina.test", Role.VIEWER);
    expect(await (await accept(first)).json()).toEqual({ error: "invalid_invite" });
    expect((await accept(second)).status).toBe(201);
    expect((await world.users.list()).find((u) => u.email === "ana@usina.test")?.role).toBe(Role.VIEWER);
  });

  it("EX-403: link desconhecido, usado, substituído ou expirado recebem a mesma mensagem", async () => {
    const admin = await firstAdmin();
    const used = await invite(admin, "a@usina.test", Role.VIEWER);
    await accept(used);
    const replaced = await invite(admin, "b@usina.test", Role.VIEWER);
    await invite(admin, "b@usina.test", Role.VIEWER);
    const expired = await invite(admin, "c@usina.test", Role.VIEWER);
    clock.advance(73 * HOUR);
    const bodies = await Promise.all(
      [`${PUBLIC_BASE_URL}/?convite=desconhecido`, used, replaced, expired].map(async (l) => (await accept(l)).text()),
    );
    expect(new Set(bodies)).toEqual(new Set([JSON.stringify({ error: "invalid_invite" })]));
  });

  it("EX-406: convidar o e-mail de um usuário ativo é recusado", async () => {
    const admin = await firstAdmin();
    const res = await send("POST", "/api/users/invites", { cookie: admin, body: { email: "CFO@usina.test", role: Role.VIEWER } });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "active_user" });
  });

  it("FA-404: o e-mail de um desativado pode ser convidado, e o aceite cria um usuário novo", async () => {
    const admin = await firstAdmin();
    await onboard(admin, "ana@usina.test", Role.FINANCE_MANAGER);
    const old = (await world.users.list()).find((u) => u.email === "ana@usina.test")!;
    await send("POST", `/api/users/${old.id}/deactivate`, { cookie: admin });
    await onboard(admin, "ana@usina.test", Role.VIEWER);
    const anas = (await world.users.list()).filter((u) => u.email === "ana@usina.test");
    expect(anas).toHaveLength(2);
    expect(anas.find((u) => u.id === old.id)?.isActive).toBe(false);
    expect(anas.find((u) => u.id !== old.id)).toMatchObject({ isActive: true, role: Role.VIEWER });
  });

  it("REQ-408: não existe papel para quem é de fora", async () => {
    const admin = await firstAdmin();
    const res = await send("POST", "/api/users/invites", { cookie: admin, body: { email: "corretor@fora.test", role: "broker" } });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_role" });
  });

  it("EX-407: a senha precisa ter de 12 a 128 caracteres, sem regra de composição", async () => {
    const admin = await firstAdmin();
    const link = await invite(admin, "ana@usina.test", Role.VIEWER);
    for (const password of ["onze chars!", "x".repeat(129)]) {
      const res = await accept(link, password);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "invalid_password" });
    }
    expect((await accept(link, "aaaaaaaaaaaa")).status).toBe(201);
  });

  it("REQ-436: sem envio de e-mail, o link vai ao administrador e o convite aparece como pendente", async () => {
    const admin = await firstAdmin();
    const res = await send("POST", "/api/users/invites", { cookie: admin, body: { email: "ana@usina.test", role: Role.VIEWER } });
    const body = (await res.json()) as Json;
    expect(body).toMatchObject({ delivered: false });
    expect(String(body.link)).toContain("convite=");
    const list = (await (await send("GET", "/api/users", { cookie: admin })).json()) as { invites: Json[] };
    expect(list.invites).toEqual([
      expect.objectContaining({ email: "ana@usina.test", role: Role.VIEWER, expiresAt: "2026-11-16T12:00:00.000Z" }),
    ]);
    expect(JSON.stringify(list)).not.toContain(tokenOf(String(body.link)));
  });
});

describe("REQ-401, REQ-430 — gestão de usuários é só do Administrador, no servidor", () => {
  it("CA-411: gestor financeiro e visualizador são recusados; o administrador consegue", async () => {
    const admin = await firstAdmin();
    const manager = await onboard(admin, "gestora@usina.test", Role.FINANCE_MANAGER);
    const viewer = await onboard(admin, "business@usina.test", Role.VIEWER);
    const target = (await world.users.list()).find((u) => u.email === "business@usina.test")!;

    for (const who of [manager, viewer]) {
      expect((await send("GET", "/api/users", { cookie: who })).status).toBe(403);
      expect((await send("POST", "/api/users/invites", { cookie: who, body: { email: "x@usina.test", role: Role.VIEWER } })).status).toBe(403);
      expect((await send("POST", `/api/users/${target.id}/role`, { cookie: who, body: { role: Role.ADMIN } })).status).toBe(403);
      expect((await send("POST", `/api/users/${target.id}/curation`, { cookie: who, body: { curator: true } })).status).toBe(403);
      expect((await send("POST", `/api/users/${target.id}/deactivate`, { cookie: who })).status).toBe(403);
    }
    expect((await world.users.findById(target.id))).toMatchObject({ role: Role.VIEWER, isActive: true });
    expect((await send("GET", "/api/users", { cookie: admin })).status).toBe(200);
  });

  it("REQ-431: sem sessão é 401, sem papel é 403 — recusas distintas", async () => {
    const admin = await firstAdmin();
    const viewer = await onboard(admin, "business@usina.test", Role.VIEWER);
    expect((await send("GET", "/api/users")).status).toBe(401);
    const refused = await send("GET", "/api/users", { cookie: viewer });
    expect(refused.status).toBe(403);
    expect(((await refused.json()) as Json).error).toBeTruthy();
  });

  it("a lista de usuários traz nome, e-mail, papel, curadoria e situação, sem credencial", async () => {
    const admin = await firstAdmin();
    const { users } = (await (await send("GET", "/api/users", { cookie: admin })).json()) as { users: Json[] };
    expect(users).toEqual([
      expect.objectContaining({ email: "cfo@usina.test", name: "CFO", role: Role.ADMIN, curator: true, status: "active" }),
    ]);
    expect(JSON.stringify(users)).not.toMatch(/hash|salt|password/i);
  });
});

describe("REQ-403, REQ-404, REQ-402, REQ-406 — desativar, trocar papel, curadoria, último administrador", () => {
  it("CA-413: o desativado perde a sessão na hora e não entra mais", async () => {
    const admin = await firstAdmin();
    const ana = await onboard(admin, "ana@usina.test", Role.FINANCE_MANAGER);
    const id = (await world.users.list()).find((u) => u.email === "ana@usina.test")!.id;
    expect((await send("GET", "/api/auth/me", { cookie: ana })).status).toBe(200);
    expect((await send("POST", `/api/users/${id}/deactivate`, { cookie: admin })).status).toBe(200);
    expect((await send("GET", "/api/auth/me", { cookie: ana })).status).toBe(401);
    expect(await loginStatus("ana@usina.test", STRONG)).toBe(401);
  });

  it("REJ-405: desativar não apaga o usuário", async () => {
    const admin = await firstAdmin();
    await onboard(admin, "ana@usina.test", Role.FINANCE_MANAGER);
    const id = (await world.users.list()).find((u) => u.email === "ana@usina.test")!.id;
    await send("POST", `/api/users/${id}/deactivate`, { cookie: admin });
    expect(await world.users.findById(id)).toMatchObject({ isActive: false, email: "ana@usina.test" });
    const { users } = (await (await send("GET", "/api/users", { cookie: admin })).json()) as { users: Json[] };
    expect(users.find((u) => u.id === id)).toMatchObject({ status: "deactivated" });
  });

  it("CA-414: a troca de papel registra quem, quando, antes e depois, e vale na operação seguinte, sem novo login", async () => {
    const admin = await firstAdmin();
    const ana = await onboard(admin, "ana@usina.test", Role.FINANCE_MANAGER);
    const id = (await world.users.list()).find((u) => u.email === "ana@usina.test")!.id;
    const adminId = (await world.users.list()).find((u) => u.email === "cfo@usina.test")!.id;
    expect((await send("GET", "/api/users", { cookie: ana })).status).toBe(403);

    expect((await send("POST", `/api/users/${id}/role`, { cookie: admin, body: { role: Role.ADMIN } })).status).toBe(200);
    expect((await send("GET", "/api/users", { cookie: ana })).status).toBe(200);
    expect((await world.log.list()).slice(-1)[0]).toMatchObject({
      kind: "role_changed",
      actorId: adminId,
      targetUserId: id,
      before: Role.FINANCE_MANAGER,
      after: Role.ADMIN,
      at: clock.now(),
    });
  });

  it("CA-414, REQ-402: o administrador dá e retira a curadoria, registrada como a troca de papel", async () => {
    const admin = await firstAdmin();
    const ana = await onboard(admin, "ana@usina.test", Role.FINANCE_MANAGER);
    const id = (await world.users.list()).find((u) => u.email === "ana@usina.test")!.id;
    const permissions = async () =>
      (((await (await send("GET", "/api/auth/me", { cookie: ana })).json()) as { user: { permissions: string[] } }).user
        .permissions);

    expect(await permissions()).not.toContain(Permission.PARTY_CURATE);
    await send("POST", `/api/users/${id}/curation`, { cookie: admin, body: { curator: true } });
    expect(await permissions()).toContain(Permission.PARTY_CURATE);
    await send("POST", `/api/users/${id}/curation`, { cookie: admin, body: { curator: false } });
    expect(await permissions()).not.toContain(Permission.PARTY_CURATE);
    expect((await world.log.list()).filter((e) => e.kind === "curation_changed").map((e) => [e.before, e.after])).toEqual([
      ["no", "yes"],
      ["yes", "no"],
    ]);
  });

  it("REQ-401, REQ-402: o administrador tem acesso irrestrito, curadoria incluída, sem concessão", async () => {
    const admin = await firstAdmin();
    const me = (await (await send("GET", "/api/auth/me", { cookie: admin })).json()) as { user: { permissions: string[]; curator: boolean } };
    expect(me.user.curator).toBe(true);
    expect(me.user.permissions).toEqual(
      expect.arrayContaining([Permission.PARTY_CURATE, Permission.USER_MANAGE, Permission.INTENT_SUBMIT]),
    );
  });

  it("CA-419: o último administrador ativo não pode ser desativado nem perder o papel", async () => {
    const admin = await firstAdmin();
    const adminId = (await world.users.list())[0].id;
    for (const [path, body] of [[`/api/users/${adminId}/deactivate`, undefined], [`/api/users/${adminId}/role`, { role: Role.VIEWER }]] as const) {
      const res = await send("POST", path, { cookie: admin, body });
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: "last_admin" });
    }
    expect(await world.users.findById(adminId)).toMatchObject({ role: Role.ADMIN, isActive: true });

    await onboard(admin, "socio@usina.test", Role.ADMIN);
    expect((await send("POST", `/api/users/${adminId}/role`, { cookie: admin, body: { role: Role.FINANCE_MANAGER } })).status).toBe(200);
  });

  it("os atos da gestão de usuários ficam registrados com o autor da sessão (REQ-807)", async () => {
    const admin = await firstAdmin();
    const adminId = (await world.users.list())[0].id;
    await onboard(admin, "ana@usina.test", Role.VIEWER);
    const id = (await world.users.list()).find((u) => u.email === "ana@usina.test")!.id;
    await send("POST", `/api/users/${id}/deactivate`, { cookie: admin, body: { actorId: "outra-pessoa" } });
    const kinds = (await world.log.list()).map((e) => [e.kind, e.actorId]);
    expect(kinds).toEqual(
      expect.arrayContaining([
        ["invited", adminId],
        ["deactivated", adminId],
      ]),
    );
    expect(kinds.flat()).not.toContain("outra-pessoa");
  });
});

describe("REQ-417 — requisição de outro site", () => {
  it("EX-405: uma operação que altera dados, vinda de outra origem, é recusada mesmo com sessão", async () => {
    const admin = await firstAdmin();
    const res = await send("POST", "/api/users/invites", {
      cookie: admin,
      origin: "https://site-malicioso.example",
      body: { email: "intruso@usina.test", role: Role.ADMIN },
    });
    expect(res.status).toBe(403);
    expect(world.invites.all()).toHaveLength(1); // only the first administrator's
  });

  it("a mesma operação vinda da própria origem, ou sem origem, passa", async () => {
    const admin = await firstAdmin();
    const own = await send("POST", "/api/users/invites", {
      cookie: admin,
      origin: PUBLIC_BASE_URL,
      body: { email: "ana@usina.test", role: Role.VIEWER },
    });
    expect(own.status).toBe(201);
    const sameHost = await send("POST", "/api/users/invites", {
      cookie: admin,
      origin: baseUrl,
      body: { email: "bia@usina.test", role: Role.VIEWER },
    });
    expect(sameHost.status).toBe(201);
  });

  it("o login vindo de outra origem também é recusado", async () => {
    await firstAdmin();
    const res = await send("POST", "/api/auth/login", {
      origin: "https://site-malicioso.example",
      body: { email: "cfo@usina.test", password: STRONG },
    });
    expect(res.status).toBe(403);
  });
});
