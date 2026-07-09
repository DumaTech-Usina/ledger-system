import { randomUUID } from "crypto";
import type { SessionStore } from "../../core/application/ports/SessionStore";

/** MVP session store with TTL expiry. Sessions are lost on restart — acceptable for the MVP. */
export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, { userId: string; expiresAt: number }>();

  constructor(private readonly ttlMs: number) {}

  create(userId: string): string {
    const sessionId = randomUUID();
    this.sessions.set(sessionId, { userId, expiresAt: Date.now() + this.ttlMs });
    return sessionId;
  }

  userIdFor(sessionId: string): string | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    if (session.expiresAt < Date.now()) {
      this.sessions.delete(sessionId);
      return null;
    }
    return session.userId;
  }

  destroy(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}
