import { describe, it, expect } from "vitest";
import { ScryptPasswordHasher } from "../../infra/auth/ScryptPasswordHasher";
import { CryptoSecretGenerator } from "../../infra/auth/CryptoSecretGenerator";
import { Role } from "../../core/domain/enums/Role";
import { Permission } from "../../core/domain/enums/Permission";
import { ManualClock, accessWorld, testUsers } from "../fixtures/access";

function wire() {
  const clock = new ManualClock();
  const hasher = new ScryptPasswordHasher();
  const w = accessWorld(clock, [
    ...testUsers(hasher, [
      { id: "u1", email: "cfo@usina.test", name: "CFO", role: Role.FINANCE_MANAGER, password: "s3cret" },
      { id: "u2", email: "viewer@usina.test", role: Role.VIEWER, password: "look" },
    ]),
  ]);
  return { ...w, clock };
}

describe("ScryptPasswordHasher", () => {
  it("verifies a correct password and rejects a wrong one", () => {
    const hasher = new ScryptPasswordHasher();
    const { hash, salt } = hasher.hash("s3cret");
    expect(hasher.verify("s3cret", hash, salt)).toBe(true);
    expect(hasher.verify("wrong", hash, salt)).toBe(false);
  });
});

describe("CryptoSecretGenerator (REQ-416)", () => {
  it("issues long random tokens and a stable one-way hash that is not the token", () => {
    const secrets = new CryptoSecretGenerator();
    const a = secrets.newToken();
    expect(a.length).toBeGreaterThanOrEqual(43); // 256 bits in base64url
    expect(secrets.newToken()).not.toBe(a);
    expect(secrets.hash(a)).toBe(secrets.hash(a));
    expect(secrets.hash(a)).not.toContain(a);
  });
});

describe("AuthService", () => {
  it("logs in with valid credentials and resolves the session back to the user", async () => {
    const { auth } = wire();
    const result = await auth.login("cfo@usina.test", "s3cret");
    expect(result).not.toBeNull();
    expect((await auth.authenticate(result!.sessionId))?.email).toBe("cfo@usina.test");
  });

  it("rejects a wrong password and an unknown user alike (REQ-413)", async () => {
    const { auth } = wire();
    expect(await auth.login("cfo@usina.test", "nope")).toBeNull();
    expect(await auth.login("ghost@usina.test", "s3cret")).toBeNull();
  });

  it("invalidates the session on logout", async () => {
    const { auth } = wire();
    const result = await auth.login("cfo@usina.test", "s3cret");
    await auth.logout(result!.sessionId);
    expect(await auth.authenticate(result!.sessionId)).toBeNull();
  });

  it("a session belongs to one login: two logins are two sessions", async () => {
    const { auth } = wire();
    const a = await auth.login("cfo@usina.test", "s3cret");
    const b = await auth.login("cfo@usina.test", "s3cret");
    expect(a!.sessionId).not.toBe(b!.sessionId);
    await auth.logout(a!.sessionId);
    expect(await auth.authenticate(b!.sessionId)).not.toBeNull();
  });

  it("a deactivated user loses every permission, whatever the role says (REQ-403)", async () => {
    const { users } = wire();
    const cfo = (await users.findById("u1"))!;
    expect(cfo.can(Permission.INTENT_SUBMIT)).toBe(true);
    expect(cfo.deactivated().permissions).toEqual([]);
  });
});
