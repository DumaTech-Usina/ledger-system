import { apiGet, apiPost } from "@/api/client";
import type { Role, User } from "@/types/auth";

export interface PendingInvite {
  email: string;
  role: Role;
  expiresAt: string;
  invitedBy: string;
  invitedAt: string;
}

export interface UserListing {
  users: User[];
  invites: PendingInvite[];
}

export interface IssuedInvite {
  link: string;
  /** False while no e-mail sender is configured: the link is shown to whoever invited (REQ-436). */
  delivered: boolean;
  expiresAt: string;
}

export interface AccessRefusal {
  error: string;
}

const user = (id: string) => `/api/users/${encodeURIComponent(id)}`;

/** The users screen (REQ-440). Every act is refused by the server to anyone but an administrator. */
export const usersApi = {
  list: () => apiGet<UserListing | AccessRefusal>("/api/users"),
  invite: (email: string, role: Role) => apiPost<IssuedInvite | AccessRefusal>("/api/users/invites", { email, role }),
  deactivate: (id: string) => apiPost<{ ok: true } | AccessRefusal>(`${user(id)}/deactivate`, {}),
  changeRole: (id: string, role: Role) => apiPost<{ ok: true } | AccessRefusal>(`${user(id)}/role`, { role }),
  setCuration: (id: string, curator: boolean) =>
    apiPost<{ ok: true } | AccessRefusal>(`${user(id)}/curation`, { curator }),
};
