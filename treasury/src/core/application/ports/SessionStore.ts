/** Server-side session boundary. In-memory for the MVP; swappable for Redis/DB later. */
export interface SessionStore {
  create(userId: string): string; // returns a new opaque session id
  userIdFor(sessionId: string): string | null;
  destroy(sessionId: string): void;
}
