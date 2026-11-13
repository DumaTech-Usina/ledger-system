import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import Database from "better-sqlite3";
import { Role } from "../../core/domain/enums/Role";
import { AuthService } from "../../core/application/services/AuthService";
import { UserAdministrationService } from "../../core/application/services/UserAdministrationService";
import { ScryptPasswordHasher } from "../../infra/auth/ScryptPasswordHasher";
import { CryptoSecretGenerator } from "../../infra/auth/CryptoSecretGenerator";
import { NoEmailAccessMailer } from "../../infra/auth/NoEmailAccessMailer";
import { SqliteUserRepository } from "../../infra/persistence/SqliteUserRepository";
import { SqliteInviteRepository } from "../../infra/persistence/SqliteInviteRepository";
import { SqliteSessionStore } from "../../infra/auth/SqliteSessionStore";
import { SqliteAccessLog } from "../../infra/audit/SqliteAccessLog";
import { ManualClock, tokenOf } from "../fixtures/access";

/** §6 on disk: what the Treasury keeps about access, and what it must never keep. */

const STRONG = "uma senha longa o bastante";
let dir: string;
let file: string;
let clock: ManualClock;

function open() {
  const hasher = new ScryptPasswordHasher();
  const users = new SqliteUserRepository(file);
  const sessions = new SqliteSessionStore(file, clock);
  const invites = new SqliteInviteRepository(file);
  const log = new SqliteAccessLog(file);
  let n = 0;
  const userAdmin = new UserAdministrationService({
    users, invites, sessions, log, hasher,
    secrets: new CryptoSecretGenerator(),
    mailer: new NoEmailAccessMailer(),
    clock,
    ids: { next: () => `user-${Date.now()}-${++n}` },
    publicBaseUrl: "http://treasury.test",
  });
  return { users, sessions, invites, log, auth: new AuthService(users, hasher, sessions, clock), userAdmin };
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "treasury-access-"));
  file = path.join(dir, "treasury.db");
  clock = new ManualClock();
});

afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

/** Every byte the Treasury wrote about access: the database and its write-ahead log. */
const onDisk = () =>
  fs
    .readdirSync(dir)
    .map((f) => fs.readFileSync(path.join(dir, f)).toString("latin1"))
    .join("\n");

describe("REQ-416 — segredos nunca em claro", () => {
  it("CA-406: nada guardado contém a senha, o identificador da sessão ou o link do convite", async () => {
    const a = open();
    const { link } = await a.userAdmin.issueFirstAdminInvite("cfo@usina.test");
    const pending = await a.userAdmin.issueFirstAdminInvite("cfo@usina.test"); // replaces the first, still pending
    await a.userAdmin.acceptInvite(tokenOf(pending.link), STRONG, "CFO");
    const session = await a.auth.login("cfo@usina.test", STRONG);
    expect(session).not.toBeNull();

    const bytes = onDisk();
    expect(bytes).toContain("cfo@usina.test"); // the scan does read the stored data
    for (const secret of [STRONG, session!.sessionId, tokenOf(link), tokenOf(pending.link)]) {
      expect(bytes).not.toContain(secret);
    }
  });
});

describe("REQ-412 — a sessão sobrevive a um reinício do Treasury", () => {
  it("CA-403: a sessão aberta antes do reinício continua valendo, e expira 12 horas depois do login", async () => {
    const before = open();
    const { link } = await before.userAdmin.issueFirstAdminInvite("cfo@usina.test");
    await before.userAdmin.acceptInvite(tokenOf(link), STRONG, "CFO");
    const { sessionId } = (await before.auth.login("cfo@usina.test", STRONG))!;

    const after = open(); // a new process reading the same file
    expect((await after.auth.authenticate(sessionId))?.email).toBe("cfo@usina.test");
    clock.advance(12 * 3_600_000 + 1);
    expect(await after.auth.authenticate(sessionId)).toBeNull();
  });

  it("a suspensão por tentativas também sobrevive ao reinício (REQ-414)", async () => {
    const before = open();
    const { link } = await before.userAdmin.issueFirstAdminInvite("cfo@usina.test");
    await before.userAdmin.acceptInvite(tokenOf(link), STRONG);
    for (let i = 0; i < 5; i++) await before.auth.login("cfo@usina.test", "senha errada qualquer");
    expect(await open().auth.login("cfo@usina.test", STRONG)).toBeNull();
  });
});

describe("REQ-403, REQ-807 — nada é apagado", () => {
  it("REJ-405: o banco recusa apagar um usuário", async () => {
    const a = open();
    const { link } = await a.userAdmin.issueFirstAdminInvite("cfo@usina.test");
    await a.userAdmin.acceptInvite(tokenOf(link), STRONG);
    const db = new Database(file);
    expect(() => db.prepare("DELETE FROM users").run()).toThrow(/never deleted/);
    db.close();
  });

  it("o registro da gestão de usuários só aceita acréscimo", async () => {
    const a = open();
    const { link } = await a.userAdmin.issueFirstAdminInvite("cfo@usina.test");
    await a.userAdmin.acceptInvite(tokenOf(link), STRONG);
    expect((await a.log.list()).map((e) => e.kind)).toEqual(["invited", "invite_accepted"]);
    const db = new Database(file);
    expect(() => db.prepare("UPDATE access_log SET kind = 'x'").run()).toThrow(/append-only/);
    expect(() => db.prepare("DELETE FROM access_log").run()).toThrow(/append-only/);
    db.close();
  });

  it("uma troca de papel feita num processo vale no outro (REQ-404)", async () => {
    const a = open();
    const first = await a.userAdmin.issueFirstAdminInvite("cfo@usina.test");
    await a.userAdmin.acceptInvite(tokenOf(first.link), STRONG);
    const cfo = (await a.users.list())[0];
    const ana = await a.userAdmin.invite(cfo, "ana@usina.test", Role.VIEWER);
    await a.userAdmin.acceptInvite(tokenOf(ana.link), STRONG);
    const anaUser = (await a.users.list()).find((u) => u.email === "ana@usina.test")!;
    await a.userAdmin.changeRole(cfo, anaUser.id, Role.FINANCE_MANAGER);
    expect((await open().users.findById(anaUser.id))?.role).toBe(Role.FINANCE_MANAGER);
  });
});
