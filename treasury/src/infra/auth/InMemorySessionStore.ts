import { createHash, randomBytes } from "node:crypto";
import type { SessionStore } from "../../core/application/ports/SessionStore";
import type { Clock } from "../../core/application/ports/Clock";
import { SESSION_TTL_MS } from "../../core/domain/policies/accessPolicy";

const hashOf = (token: string) => createHash("sha256").update(token, "utf8").digest("hex");

/** Sessions in memory, for tests. Same rules as the SQLite store: hash only, 12 h absolute. */
export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, { userId: string; expiresAt: number }>();

  constructor(private readonly clock: Clock, private readonly ttlMs: number = SESSION_TTL_MS) {}

  async create(userId: string): Promise<string> {
    const token = randomBytes(32).toString("base64url");
    this.sessions.set(hashOf(token), { userId, expiresAt: this.now() + this.ttlMs });
    return token;
  }

  async userIdFor(token: string): Promise<string | null> {
    const key = hashOf(token);
    const session = this.sessions.get(key);
    if (!session) return null;
    if (session.expiresAt <= this.now()) {
      this.sessions.delete(key);
      return null;
    }
    return session.userId;
  }

  async destroy(token: string): Promise<void> {
    this.sessions.delete(hashOf(token));
  }

  async destroyAllFor(userId: string): Promise<void> {
    for (const [key, session] of this.sessions) if (session.userId === userId) this.sessions.delete(key);
  }

  private now(): number {
    return Date.parse(this.clock.now());
  }
}
