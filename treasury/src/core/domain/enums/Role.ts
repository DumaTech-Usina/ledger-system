/**
 * The three roles of REQ-401: one per user. Authorization lives in the User App; the Ledger stays
 * role-blind. People outside the Usina have no role at all (REQ-408).
 */
export enum Role {
  /** Everything the finance manager does, plus user management (REQ-401, from the template). */
  ADMIN = "admin",
  FINANCE_MANAGER = "finance_manager",
  VIEWER = "viewer",
}

export const ROLES: readonly Role[] = [Role.ADMIN, Role.FINANCE_MANAGER, Role.VIEWER];

export const isRole = (value: unknown): value is Role => ROLES.includes(value as Role);
