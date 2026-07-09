import { Role } from "../enums/Role";
import { Permission } from "../enums/Permission";

/** The role → permission policy. Data-driven so new roles are a one-line change. */
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.FINANCE_MANAGER]: [
    Permission.INTENT_CREATE,
    Permission.INTENT_SUBMIT,
    Permission.INTENT_READ,
    Permission.DASHBOARD_READ,
  ],
  [Role.VIEWER]: [Permission.INTENT_READ, Permission.DASHBOARD_READ],
};

export function permissionsFor(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function can(role: Role, permission: Permission): boolean {
  return permissionsFor(role).includes(permission);
}
