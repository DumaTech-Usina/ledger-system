/** REQ-401: one role per user. */
export type Role = "admin" | "finance_manager" | "viewer";

export const ROLES: Role[] = ["admin", "finance_manager", "viewer"];

export type Permission =
  | "intent:create"
  | "intent:submit"
  | "intent:read"
  | "dashboard:read"
  | "party:curate"
  | "user:manage";

/** What the server shows about a user (REQ-400): never the credential. */
export interface User {
  id: string;
  email: string;
  name: string | null;
  /** The name or, without one, the e-mail. */
  displayName: string;
  role: Role;
  status: "active" | "deactivated";
  curator: boolean;
  permissions: Permission[];
}
