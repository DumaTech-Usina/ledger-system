import { describe, it, expect } from "vitest";
import { ScryptPasswordHasher } from "../../infra/auth/ScryptPasswordHasher";
import { InMemorySessionStore } from "../../infra/auth/InMemorySessionStore";
import { InMemoryUserRepository } from "../../infra/persistence/InMemoryUserRepository";
import { seedUsers } from "../../infra/auth/seedUsers";
import { AuthService } from "../../core/application/services/AuthService";
import { Role } from "../../core/domain/enums/Role";
import { Permission } from "../../core/domain/enums/Permission";
import { can } from "../../core/domain/policies/rolePermissions";

function wire() {
  const hasher = new ScryptPasswordHasher();
  const users = new InMemoryUserRepository(
    seedUsers(hasher, [
      { id: "u1", username: "cfo", displayName: "CFO", role: Role.FINANCE_MANAGER, password: "s3cret" },
      { id: "u2", username: "viewer", displayName: "Analista", role: Role.VIEWER, password: "look" },
    ]),
  );
  const sessions = new InMemorySessionStore(60_000);
  return new AuthService(users, hasher, sessions);
}

describe("ScryptPasswordHasher", () => {
  it("verifies a correct password and rejects a wrong one", () => {
    const hasher = new ScryptPasswordHasher();
    const { hash, salt } = hasher.hash("s3cret");
    expect(hasher.verify("s3cret", hash, salt)).toBe(true);
    expect(hasher.verify("wrong", hash, salt)).toBe(false);
  });
});

describe("AuthService", () => {
  it("logs in with valid credentials and resolves the session back to the user", async () => {
    const auth = wire();
    const result = await auth.login("cfo", "s3cret");
    expect(result).not.toBeNull();
    const user = await auth.authenticate(result!.sessionId);
    expect(user?.username).toBe("cfo");
  });

  it("rejects a wrong password and an unknown user", async () => {
    const auth = wire();
    expect(await auth.login("cfo", "nope")).toBeNull();
    expect(await auth.login("ghost", "s3cret")).toBeNull();
  });

  it("invalidates the session on logout", async () => {
    const auth = wire();
    const result = await auth.login("cfo", "s3cret");
    auth.logout(result!.sessionId);
    expect(await auth.authenticate(result!.sessionId)).toBeNull();
  });
});

describe("RBAC policy", () => {
  it("grants a finance manager create + submit; a viewer only read", () => {
    expect(can(Role.FINANCE_MANAGER, Permission.INTENT_SUBMIT)).toBe(true);
    expect(can(Role.FINANCE_MANAGER, Permission.INTENT_CREATE)).toBe(true);
    expect(can(Role.VIEWER, Permission.INTENT_SUBMIT)).toBe(false);
    expect(can(Role.VIEWER, Permission.INTENT_CREATE)).toBe(false);
    expect(can(Role.VIEWER, Permission.INTENT_READ)).toBe(true);
  });
});
