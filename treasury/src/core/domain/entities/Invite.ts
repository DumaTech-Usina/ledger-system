import type { Role } from "../enums/Role";

/**
 * pending  — waiting to be accepted;
 * accepted — used: it created a user (REQ-422);
 * replaced — a newer invite to the same e-mail took its place (REQ-421).
 * An expired invite stays "pending": expiry is read from the clock, never stored (REQ-420).
 */
export type InviteStatus = "pending" | "accepted" | "replaced";

/** A one-time link to finish joining the Treasury (§6.3). Only the token's hash is ever kept (REQ-416). */
export interface Invite {
  id: string;
  email: string;
  role: Role;
  tokenHash: string;
  /** Who invited: a user id, or the server command for the first administrator (REQ-405). */
  invitedBy: string;
  invitedAt: string;
  expiresAt: string;
  status: InviteStatus;
}

export const isInviteUsable = (invite: Invite, nowMs: number): boolean =>
  invite.status === "pending" && Date.parse(invite.expiresAt) > nowMs;
