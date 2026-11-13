import { User } from "../../core/domain/entities/User";
import type { Role } from "../../core/domain/enums/Role";
import type { Permission } from "../../core/domain/enums/Permission";
import type { PasswordHasher } from "../../core/application/ports/PasswordHasher";
import type { Clock } from "../../core/application/ports/Clock";
import { AuthService } from "../../core/application/services/AuthService";
import { UserAdministrationService } from "../../core/application/services/UserAdministrationService";
import { ScryptPasswordHasher } from "../../infra/auth/ScryptPasswordHasher";
import { CryptoSecretGenerator } from "../../infra/auth/CryptoSecretGenerator";
import { InMemorySessionStore } from "../../infra/auth/InMemorySessionStore";
import { NoEmailAccessMailer } from "../../infra/auth/NoEmailAccessMailer";
import { InMemoryUserRepository } from "../../infra/persistence/InMemoryUserRepository";
import { InMemoryInviteRepository } from "../../infra/persistence/InMemoryInviteRepository";
import { InMemoryAccessLog } from "../../infra/audit/InMemoryAccessLog";

/** A clock the test moves by hand: sessions, invites and lockouts all read it. */
export class ManualClock implements Clock {
  constructor(private ms = Date.parse("2026-11-13T12:00:00.000Z")) {}
  now(): string {
    return new Date(this.ms).toISOString();
  }
  advance(ms: number): void {
    this.ms += ms;
  }
}

export interface TestUserSeed {
  id: string;
  email: string;
  name?: string;
  role: Role;
  password: string;
  grants?: Permission[];
}

/**
 * Ready-made users for tests that are about something else than access. Production has no such thing
 * (REQ-405, REJ-407): there, every user comes from an invite or the development-only command.
 */
export function testUsers(hasher: PasswordHasher, seeds: TestUserSeed[]): User[] {
  return seeds.map((s) => {
    const { hash, salt } = hasher.hash(s.password);
    return new User({
      id: s.id,
      email: s.email,
      name: s.name ?? null,
      role: s.role,
      status: "active",
      passwordHash: hash,
      passwordSalt: salt,
      grants: s.grants ?? [],
      failedLogins: 0,
      lockedUntil: null,
      createdAt: "2026-11-01T00:00:00.000Z",
    });
  });
}

export const PUBLIC_BASE_URL = "http://treasury.test";

/** The whole access module wired in memory, around a clock the test controls. */
export function accessWorld(clock: Clock = new ManualClock(), users: User[] = []) {
  const hasher = new ScryptPasswordHasher();
  const userRepo = new InMemoryUserRepository(users);
  const sessions = new InMemorySessionStore(clock);
  const invites = new InMemoryInviteRepository();
  const log = new InMemoryAccessLog();
  let n = 0;
  const userAdmin = new UserAdministrationService({
    users: userRepo,
    invites,
    sessions,
    log,
    hasher,
    secrets: new CryptoSecretGenerator(),
    mailer: new NoEmailAccessMailer(),
    clock,
    ids: { next: () => `user-${++n}` },
    publicBaseUrl: PUBLIC_BASE_URL,
  });
  return { hasher, users: userRepo, sessions, invites, log, auth: new AuthService(userRepo, hasher, sessions, clock), userAdmin };
}

/** The token of an invite link (`…/?convite=<token>`). */
export const tokenOf = (link: string): string => new URL(link).searchParams.get("convite") ?? "";

/** The real time, for tests where the session's age does not matter. */
export const SYSTEM_CLOCK: Clock = { now: () => new Date().toISOString() };
