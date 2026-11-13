/**
 * The record of user management (REQ-404, REQ-420, REQ-807): who did what to whom, when, before and
 * after. Append-only, like the operations audit, but kept apart from it: that one is about intents.
 */
export type AccessLogKind =
  | "invited"
  | "invite_accepted"
  | "deactivated"
  | "role_changed"
  | "curation_changed"
  | "user_created_by_command";

export interface AccessLogEntry {
  at: string;
  kind: AccessLogKind;
  /** The user of the session, or a server command (`command:<name>`). */
  actorId: string;
  targetUserId: string | null;
  email: string | null;
  before: string | null;
  after: string | null;
}

export interface AccessLog {
  append(entry: AccessLogEntry): Promise<void>;
  list(): Promise<AccessLogEntry[]>;
}
