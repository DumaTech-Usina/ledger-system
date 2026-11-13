import { User } from "../../domain/entities/User";
import { isInviteUsable, type Invite } from "../../domain/entities/Invite";
import { Role, isRole } from "../../domain/enums/Role";
import { Permission } from "../../domain/enums/Permission";
import { INVITE_TTL_MS, isEmail, normalizeEmail, passwordProblem } from "../../domain/policies/accessPolicy";
import type { UserRepository } from "../repositories/UserRepository";
import type { InviteRepository } from "../repositories/InviteRepository";
import type { SessionStore } from "../ports/SessionStore";
import type { AccessLog } from "../ports/AccessLog";
import type { PasswordHasher } from "../ports/PasswordHasher";
import type { SecretGenerator } from "../ports/SecretGenerator";
import type { AccessMailer } from "../ports/AccessMailer";
import type { Clock } from "../ports/Clock";
import type { IdGenerator } from "../ports/IdGenerator";

export type AccessErrorCode =
  | "forbidden"
  | "not_found"
  | "invalid_email"
  | "invalid_role"
  | "invalid_password"
  | "invalid_invite"
  | "active_user"
  | "last_admin"
  | "admin_exists";

/** A refusal of §6, with a code the presentation turns into a status and a message. */
export class AccessError extends Error {
  constructor(readonly code: AccessErrorCode, message: string = code) {
    super(message);
    this.name = "AccessError";
  }
}

export interface IssuedInvite {
  link: string;
  /** False while no e-mail sender is configured: the link goes to whoever invited (REQ-436). */
  delivered: boolean;
  expiresAt: string;
}

export interface UserListing {
  users: ReturnType<User["toPublic"]>[];
  invites: { email: string; role: Role; expiresAt: string; invitedBy: string; invitedAt: string }[];
}

interface Deps {
  users: UserRepository;
  invites: InviteRepository;
  sessions: SessionStore;
  log: AccessLog;
  hasher: PasswordHasher;
  secrets: SecretGenerator;
  mailer: AccessMailer;
  clock: Clock;
  ids: IdGenerator;
  /** Where the Treasury is reached, for the links (`<base>/?convite=<token>`). */
  publicBaseUrl: string;
}

const FIRST_ADMIN_COMMAND = "command:first-admin";
const CREATE_USER_COMMAND = "command:create-user";

/**
 * User management (§6.1, §6.3, §6.7). The administrator check lives here too, not only on the route:
 * whatever path reaches these methods, a non-administrator is refused (REQ-401, REQ-430).
 */
export class UserAdministrationService {
  constructor(private readonly deps: Deps) {}

  async list(actor: User): Promise<UserListing> {
    this.assertAdmin(actor);
    const now = this.nowMs();
    const pending = (await this.deps.invites.listPending()).filter((i) => isInviteUsable(i, now));
    return {
      users: (await this.deps.users.list()).map((u) => u.toPublic()),
      invites: pending.map((i) => ({
        email: i.email,
        role: i.role,
        expiresAt: i.expiresAt,
        invitedBy: i.invitedBy,
        invitedAt: i.invitedAt,
      })),
    };
  }

  /** REQ-420, REQ-421. Inviting again is how an invite is resent: the previous one stops working. */
  async invite(actor: User, email: string, role: unknown): Promise<IssuedInvite> {
    this.assertAdmin(actor);
    return this.issueInvite(actor.id, email, role);
  }

  /**
   * REQ-405: the first administrator, from a server command. Refused once an active administrator
   * exists — from then on, administrators are invited by administrators.
   */
  async issueFirstAdminInvite(email: string): Promise<IssuedInvite> {
    const users = await this.deps.users.list();
    if (users.some((u) => u.isActive && u.role === Role.ADMIN)) {
      throw new AccessError("admin_exists", "Já existe um administrador ativo; convide pelo Treasury.");
    }
    return this.issueInvite(FIRST_ADMIN_COMMAND, email, Role.ADMIN);
  }

  /** REQ-422. Every unusable link gets the same refusal, whatever the reason (EX-403). */
  async acceptInvite(token: string, password: string, name?: string | null): Promise<User> {
    const invite = token ? await this.deps.invites.findByTokenHash(this.deps.secrets.hash(token)) : null;
    if (!invite || !isInviteUsable(invite, this.nowMs())) throw new AccessError("invalid_invite");
    if (await this.deps.users.findActiveByEmail(invite.email)) throw new AccessError("invalid_invite");
    this.assertPassword(password);

    const user = this.newUser(invite.email, password, invite.role, name);
    await this.deps.users.save(user);
    await this.deps.invites.save({ ...invite, status: "accepted" });
    await this.record("invite_accepted", user.id, user.id, invite.email, null, invite.role);
    return user;
  }

  /** REQ-403: never deleted; every session ends now; no reactivation. */
  async deactivate(actor: User, userId: string): Promise<void> {
    this.assertAdmin(actor);
    const target = await this.activeTarget(userId);
    await this.assertNotLastAdmin(target, "deactivate");
    await this.deps.users.save(target.deactivated());
    await this.deps.sessions.destroyAllFor(target.id);
    await this.record("deactivated", actor.id, target.id, target.email, "active", "deactivated");
  }

  /** REQ-404: recorded with before and after; counts from the user's next request. */
  async changeRole(actor: User, userId: string, role: unknown): Promise<void> {
    this.assertAdmin(actor);
    if (!isRole(role)) throw new AccessError("invalid_role");
    const target = await this.activeTarget(userId);
    if (target.role === role) return;
    if (role !== Role.ADMIN) await this.assertNotLastAdmin(target, "demote");
    await this.deps.users.save(target.withRole(role));
    await this.record("role_changed", actor.id, target.id, target.email, target.role, role);
  }

  /** REQ-402: the administrator grants and withdraws curation, recorded like a role change. */
  async setCuration(actor: User, userId: string, curator: boolean): Promise<void> {
    this.assertAdmin(actor);
    const target = await this.activeTarget(userId);
    if (target.isCurator === curator) return;
    await this.deps.users.save(target.withCuration(curator));
    await this.record("curation_changed", actor.id, target.id, target.email, target.isCurator ? "yes" : "no", curator ? "yes" : "no");
  }

  /** REQ-407: the development-only command. The production refusal lives with the command itself. */
  async createUserByCommand(email: string, password: string, role: unknown, name?: string | null): Promise<User> {
    if (!isRole(role)) throw new AccessError("invalid_role");
    const normalized = this.assertEmail(email);
    if (await this.deps.users.findActiveByEmail(normalized)) throw new AccessError("active_user");
    this.assertPassword(password);
    const user = this.newUser(normalized, password, role, name);
    await this.deps.users.save(user);
    await this.record("user_created_by_command", CREATE_USER_COMMAND, user.id, normalized, null, role);
    return user;
  }

  private async issueInvite(actorId: string, email: string, role: unknown): Promise<IssuedInvite> {
    if (!isRole(role)) throw new AccessError("invalid_role");
    const normalized = this.assertEmail(email);
    if (await this.deps.users.findActiveByEmail(normalized)) throw new AccessError("active_user");

    const now = this.nowMs();
    for (const previous of await this.deps.invites.listPending()) {
      if (previous.email === normalized) await this.deps.invites.save({ ...previous, status: "replaced" });
    }
    const token = this.deps.secrets.newToken();
    const invite: Invite = {
      id: this.deps.ids.next(),
      email: normalized,
      role,
      tokenHash: this.deps.secrets.hash(token),
      invitedBy: actorId,
      invitedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + INVITE_TTL_MS).toISOString(),
      status: "pending",
    };
    await this.deps.invites.save(invite);
    await this.record("invited", actorId, null, normalized, null, role);

    const link = `${this.deps.publicBaseUrl.replace(/\/+$/, "")}/?convite=${encodeURIComponent(token)}`;
    const delivered = await this.deps.mailer.sendInvite({ to: normalized, link, expiresAt: invite.expiresAt });
    return { link, delivered, expiresAt: invite.expiresAt };
  }

  private newUser(email: string, password: string, role: Role, name?: string | null): User {
    const { hash, salt } = this.deps.hasher.hash(password);
    return new User({
      id: this.deps.ids.next(),
      email,
      name: name?.trim() ? name.trim() : null,
      role,
      status: "active",
      passwordHash: hash,
      passwordSalt: salt,
      grants: [],
      failedLogins: 0,
      lockedUntil: null,
      createdAt: this.deps.clock.now(),
    });
  }

  private assertAdmin(actor: User): void {
    if (!actor.can(Permission.USER_MANAGE)) throw new AccessError("forbidden");
  }

  private assertEmail(email: string): string {
    const normalized = normalizeEmail(String(email ?? ""));
    if (!isEmail(normalized)) throw new AccessError("invalid_email");
    return normalized;
  }

  private assertPassword(password: string): void {
    const problem = passwordProblem(String(password ?? ""));
    if (problem) throw new AccessError("invalid_password", problem);
  }

  private async activeTarget(userId: string): Promise<User> {
    const target = await this.deps.users.findById(userId);
    if (!target?.isActive) throw new AccessError("not_found");
    return target;
  }

  /** REQ-406: the Treasury is never left without an active administrator. */
  private async assertNotLastAdmin(target: User, _change: "deactivate" | "demote"): Promise<void> {
    if (target.role !== Role.ADMIN) return;
    const admins = (await this.deps.users.list()).filter((u) => u.isActive && u.role === Role.ADMIN);
    if (admins.length <= 1) throw new AccessError("last_admin");
  }

  private async record(
    kind: Parameters<AccessLog["append"]>[0]["kind"],
    actorId: string,
    targetUserId: string | null,
    email: string | null,
    before: string | null,
    after: string | null,
  ): Promise<void> {
    await this.deps.log.append({ at: this.deps.clock.now(), kind, actorId, targetUserId, email, before, after });
  }

  private nowMs(): number {
    return Date.parse(this.deps.clock.now());
  }
}
