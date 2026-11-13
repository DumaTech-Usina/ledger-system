import { Role } from "../enums/Role";
import { Permission } from "../enums/Permission";
import { permissionsFor } from "../policies/rolePermissions";
import { LOGIN_MAX_FAILURES, LOGIN_SUSPENSION_MS } from "../policies/accessPolicy";

export type UserStatus = "active" | "deactivated";

export interface UserProps {
  id: string;
  /** The login (REQ-400), stored normalized. */
  email: string;
  name: string | null;
  role: Role;
  status: UserStatus;
  passwordHash: string;
  passwordSalt: string;
  /** Permissions held on top of the role's, such as curation (REQ-402). */
  grants: Permission[];
  /** Failed logins in a row (REQ-414), and until when the login is suspended. */
  failedLogins: number;
  lockedUntil: string | null;
  createdAt: string;
}

/** What the API may show about a user: never the credential material. */
export interface PublicUser {
  id: string;
  email: string;
  name: string | null;
  displayName: string;
  role: Role;
  status: UserStatus;
  curator: boolean;
  permissions: Permission[];
}

/**
 * A person of the Usina with access to the Treasury (§6). Never deleted, because signatures reference
 * it (REQ-403): it is deactivated instead. Every change returns a new User; the store decides when to
 * persist it.
 */
export class User {
  constructor(private readonly props: UserProps) {}

  get id(): string { return this.props.id; }
  get email(): string { return this.props.email; }
  get name(): string | null { return this.props.name; }
  /** REQ-400: the name or, without one, the e-mail. */
  get displayName(): string { return this.props.name?.trim() || this.props.email; }
  get role(): Role { return this.props.role; }
  get status(): UserStatus { return this.props.status; }
  get isActive(): boolean { return this.props.status === "active"; }
  /** REQ-402: by the role (the administrator) or by a grant. */
  get isCurator(): boolean { return this.props.role === Role.ADMIN || this.props.grants.includes(Permission.PARTY_CURATE); }
  get passwordHash(): string { return this.props.passwordHash; }
  get passwordSalt(): string { return this.props.passwordSalt; }
  get grants(): Permission[] { return [...this.props.grants]; }
  get failedLogins(): number { return this.props.failedLogins; }
  get lockedUntil(): string | null { return this.props.lockedUntil; }
  get createdAt(): string { return this.props.createdAt; }

  /** A deactivated user can do nothing, whatever the role says. */
  get permissions(): Permission[] {
    if (!this.isActive) return [];
    return [...new Set([...permissionsFor(this.props.role), ...this.props.grants])];
  }

  can(permission: Permission): boolean {
    return this.permissions.includes(permission);
  }

  /** REQ-414. */
  isSuspended(nowMs: number): boolean {
    return this.props.lockedUntil !== null && Date.parse(this.props.lockedUntil) > nowMs;
  }

  /** One more failure; the fifth in a row suspends the login and starts a new count. */
  afterFailedLogin(nowMs: number): User {
    const failures = this.props.failedLogins + 1;
    if (failures >= LOGIN_MAX_FAILURES) {
      return this.with({ failedLogins: 0, lockedUntil: new Date(nowMs + LOGIN_SUSPENSION_MS).toISOString() });
    }
    return this.with({ failedLogins: failures });
  }

  afterSuccessfulLogin(): User {
    return this.with({ failedLogins: 0, lockedUntil: null });
  }

  withRole(role: Role): User {
    return this.with({ role });
  }

  withCuration(curator: boolean): User {
    const others = this.props.grants.filter((g) => g !== Permission.PARTY_CURATE);
    return this.with({ grants: curator ? [...others, Permission.PARTY_CURATE] : others });
  }

  deactivated(): User {
    return this.with({ status: "deactivated" });
  }

  toPublic(): PublicUser {
    return {
      id: this.id,
      email: this.email,
      name: this.name,
      displayName: this.displayName,
      role: this.role,
      status: this.status,
      curator: this.isCurator,
      permissions: this.permissions,
    };
  }

  toProps(): UserProps {
    return { ...this.props, grants: [...this.props.grants] };
  }

  private with(changes: Partial<UserProps>): User {
    return new User({ ...this.props, ...changes });
  }
}
