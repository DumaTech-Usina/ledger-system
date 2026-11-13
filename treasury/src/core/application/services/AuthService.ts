import type { User } from "../../domain/entities/User";
import { normalizeEmail } from "../../domain/policies/accessPolicy";
import type { UserRepository } from "../repositories/UserRepository";
import type { PasswordHasher } from "../ports/PasswordHasher";
import type { SessionStore } from "../ports/SessionStore";
import type { Clock } from "../ports/Clock";

export interface LoginResult {
  sessionId: string;
  user: User;
}

/**
 * Who the user is (§6.2): credentials → session, session → user, logout. Every refusal is the same
 * `null`, so the caller cannot tell an unknown e-mail from a wrong password, a deactivated user or a
 * suspended login (REQ-413).
 */
export class AuthService {
  /** A hash nobody's password matches: an unknown e-mail costs the same work as a wrong password. */
  private readonly decoy: { hash: string; salt: string };

  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionStore,
    private readonly clock: Clock,
  ) {
    this.decoy = hasher.hash(`decoy-${Math.random()}`);
  }

  async login(email: string, password: string): Promise<LoginResult | null> {
    const user = await this.users.findActiveByEmail(normalizeEmail(email));
    if (!user) {
      this.hasher.verify(password, this.decoy.hash, this.decoy.salt);
      return null;
    }
    const now = Date.parse(this.clock.now());
    if (user.isSuspended(now)) return null; // REQ-414: not even the right password, and not counted
    if (!this.hasher.verify(password, user.passwordHash, user.passwordSalt)) {
      await this.users.save(user.afterFailedLogin(now));
      return null;
    }
    const fresh = user.afterSuccessfulLogin();
    if (fresh.failedLogins !== user.failedLogins || fresh.lockedUntil !== user.lockedUntil) await this.users.save(fresh);
    return { sessionId: await this.sessions.create(user.id), user: fresh };
  }

  /** The user behind a session, read fresh: a role change counts from the next request (REQ-404). */
  async authenticate(sessionId: string): Promise<User | null> {
    const userId = await this.sessions.userIdFor(sessionId);
    if (!userId) return null;
    const user = await this.users.findById(userId);
    if (!user?.isActive) {
      await this.sessions.destroy(sessionId);
      return null;
    }
    return user;
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessions.destroy(sessionId);
  }
}
