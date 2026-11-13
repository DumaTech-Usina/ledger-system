/**
 * Server-side sessions (REQ-411, REQ-412). The store hands out an opaque token and keeps only its hash
 * (REQ-416). A session ends 12 hours after the login, at logout, or when every session of the user is
 * ended (deactivation, REQ-403; password reset, REQ-426).
 */
export interface SessionStore {
  create(userId: string): Promise<string>;
  userIdFor(token: string): Promise<string | null>;
  destroy(token: string): Promise<void>;
  destroyAllFor(userId: string): Promise<void>;
}
