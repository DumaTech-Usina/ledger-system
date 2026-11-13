import { Role } from "../enums/Role";
import { Permission } from "../enums/Permission";

const OPERATES = [Permission.INTENT_CREATE, Permission.INTENT_SUBMIT, Permission.INTENT_READ, Permission.DASHBOARD_READ];

/**
 * The role → permission policy of REQ-401. Data-driven so a new role is a one-line change. The
 * administrator has unrestricted access, curation included (decided 2026-11-13); for the other roles,
 * curation is a grant on top of the role (REQ-402).
 */
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.ADMIN]: [...OPERATES, Permission.USER_MANAGE, Permission.PARTY_CURATE],
  [Role.FINANCE_MANAGER]: OPERATES,
  [Role.VIEWER]: [Permission.INTENT_READ, Permission.DASHBOARD_READ],
};

export function permissionsFor(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function can(role: Role, permission: Permission): boolean {
  return permissionsFor(role).includes(permission);
}
