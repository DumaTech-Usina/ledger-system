import type { User } from "../../domain/entities/User";
import type { UserRepository } from "../repositories/UserRepository";
import type { PasswordHasher } from "../ports/PasswordHasher";
import type { SessionStore } from "../ports/SessionStore";

export interface LoginResult {
  sessionId: string;
  user: User;
}

/** Authentication service: credential check → session issuance, session → user, and logout. */
export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionStore,
  ) {}

  async login(username: string, password: string): Promise<LoginResult | null> {
    const user = await this.users.findByUsername(username);
    // Verify even when the user is unknown would be ideal to avoid timing leaks; for the MVP a
    // simple guard is acceptable. Never reveal which of username/password was wrong.
    if (!user) return null;
    if (!this.hasher.verify(password, user.passwordHash, user.passwordSalt)) return null;
    return { sessionId: this.sessions.create(user.id), user };
  }

  async authenticate(sessionId: string): Promise<User | null> {
    const userId = this.sessions.userIdFor(sessionId);
    if (!userId) return null;
    return this.users.findById(userId);
  }

  logout(sessionId: string): void {
    this.sessions.destroy(sessionId);
  }
}
