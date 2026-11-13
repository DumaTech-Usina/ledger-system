import { describe, it, expect } from "vitest";
import { Role } from "../../core/domain/enums/Role";
import { Permission } from "../../core/domain/enums/Permission";
import { can } from "../../core/domain/policies/rolePermissions";
import { passwordProblem, normalizeEmail } from "../../core/domain/policies/accessPolicy";
import { runCreateUser, runFirstAdmin } from "../../infra/auth/accessCommands";
import { accessWorld, tokenOf } from "../fixtures/access";

const STRONG = "uma senha longa o bastante";

describe("REQ-401 — três papéis", () => {
  it("CA-412: administrador e gestor operam; o visualizador só consulta", () => {
    for (const role of [Role.ADMIN, Role.FINANCE_MANAGER]) {
      for (const p of [Permission.INTENT_CREATE, Permission.INTENT_SUBMIT, Permission.INTENT_READ, Permission.DASHBOARD_READ]) {
        expect(can(role, p)).toBe(true);
      }
    }
    expect(can(Role.VIEWER, Permission.INTENT_READ)).toBe(true);
    expect(can(Role.VIEWER, Permission.DASHBOARD_READ)).toBe(true);
    expect(can(Role.VIEWER, Permission.INTENT_CREATE)).toBe(false);
    expect(can(Role.VIEWER, Permission.INTENT_SUBMIT)).toBe(false);
  });

  it("CA-411: só o administrador gere usuários", () => {
    expect(can(Role.ADMIN, Permission.USER_MANAGE)).toBe(true);
    expect(can(Role.FINANCE_MANAGER, Permission.USER_MANAGE)).toBe(false);
    expect(can(Role.VIEWER, Permission.USER_MANAGE)).toBe(false);
  });

  it("REQ-402: o administrador tem a curadoria pelo papel; gestor e visualizador só por concessão", () => {
    expect(can(Role.ADMIN, Permission.PARTY_CURATE)).toBe(true);
    expect(can(Role.FINANCE_MANAGER, Permission.PARTY_CURATE)).toBe(false);
    expect(can(Role.VIEWER, Permission.PARTY_CURATE)).toBe(false);
  });
});

describe("REQ-415, REQ-400 — senha e e-mail", () => {
  it("a senha vai de 12 a 128 caracteres, sem regra de composição", () => {
    expect(passwordProblem("a".repeat(11))).not.toBeNull();
    expect(passwordProblem("a".repeat(12))).toBeNull();
    expect(passwordProblem("a".repeat(128))).toBeNull();
    expect(passwordProblem("a".repeat(129))).not.toBeNull();
  });

  it("o e-mail é comparado sem espaços nem diferença de maiúsculas", () => {
    expect(normalizeEmail("  Ana@Usina.TEST ")).toBe("ana@usina.test");
  });
});

describe("REQ-405, REQ-407 — comandos no servidor", () => {
  it("CA-420: o comando do primeiro administrador imprime o link, sem criar usuário nem pedir senha", async () => {
    const w = accessWorld();
    const out: string[] = [];
    await runFirstAdmin(["cfo@usina.test"], { userAdmin: w.userAdmin, print: (l) => out.push(l) });
    const link = out.join("\n").match(/http\S+convite=\S+/)?.[0] ?? "";
    expect(tokenOf(link)).not.toBe("");
    expect(await w.users.list()).toHaveLength(0);
    await w.userAdmin.acceptInvite(tokenOf(link), STRONG);
    expect((await w.users.list())[0].role).toBe(Role.ADMIN);
  });

  it("CA-420: o comando de criação de usuário recusa em produção, sem pedir a senha", async () => {
    const w = accessWorld();
    let asked = false;
    await expect(
      runCreateUser(["--email=ana@usina.test"], {
        userAdmin: w.userAdmin,
        production: true,
        askPassword: async () => {
          asked = true;
          return STRONG;
        },
        print: () => undefined,
      }),
    ).rejects.toThrow(/produção/);
    expect(asked).toBe(false);
    expect(await w.users.list()).toHaveLength(0);
  });

  it("REQ-407: em desenvolvimento cria o usuário ativo, com o papel Gestor por padrão, e a senha vem do prompt", async () => {
    const w = accessWorld();
    await runCreateUser(["--email=Ana@Usina.test", "--name=Ana"], {
      userAdmin: w.userAdmin,
      production: false,
      askPassword: async () => STRONG,
      print: () => undefined,
    });
    expect((await w.users.list())[0]).toMatchObject({ email: "ana@usina.test", role: Role.FINANCE_MANAGER, displayName: "Ana" });
    expect((await w.auth.login("ana@usina.test", STRONG))?.user.email).toBe("ana@usina.test");
  });

  it("REQ-407: a senha nunca é aceita como argumento do comando", async () => {
    const w = accessWorld();
    await expect(
      runCreateUser(["--email=ana@usina.test", `--password=${STRONG}`], {
        userAdmin: w.userAdmin,
        production: false,
        askPassword: async () => STRONG,
        print: () => undefined,
      }),
    ).rejects.toThrow(/senha/);
    expect(await w.users.list()).toHaveLength(0);
  });

  it("REQ-407: a senha curta é recusada também no comando", async () => {
    const w = accessWorld();
    await expect(
      runCreateUser(["--email=ana@usina.test", "--role=admin"], {
        userAdmin: w.userAdmin,
        production: false,
        askPassword: async () => "curta",
        print: () => undefined,
      }),
    ).rejects.toMatchObject({ code: "invalid_password" });
  });
});
