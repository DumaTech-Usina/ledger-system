import type { User } from "@/types/auth";
import type { PendingInvite } from "@/features/users/usersApi";

export type UserRow =
  | { kind: "user"; key: string; user: User }
  | { kind: "invite"; key: string; invite: PendingInvite };

/**
 * One list for people and pending invites (REQ-440): active people first, then pending invites, then
 * the deactivated — the ones that need nothing are at the bottom. An invite for the e-mail of an
 * active user cannot exist (REQ-421), so the two never describe the same person.
 */
export function userRows(users: User[], invites: PendingInvite[]): UserRow[] {
  const active = users.filter((u) => u.status === "active");
  const gone = users.filter((u) => u.status !== "active");
  return [
    ...active.map((user) => ({ kind: "user" as const, key: `u:${user.id}`, user })),
    ...invites.map((invite) => ({ kind: "invite" as const, key: `i:${invite.email}`, invite })),
    ...gone.map((user) => ({ kind: "user" as const, key: `u:${user.id}`, user })),
  ];
}

/** The server's refusal codes, worded; an unknown one falls back to the generic message. */
export function refusalMessage(errors: Record<string, string>, code: string | undefined): string {
  return (code && errors[code]) || errors.generic;
}
