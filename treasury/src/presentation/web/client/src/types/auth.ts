export type Role = "finance_manager" | "viewer";

export type Permission = "intent:create" | "intent:submit" | "intent:read" | "dashboard:read" | "party:curate";

export interface User {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  permissions: Permission[];
}
