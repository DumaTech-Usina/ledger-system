import { apiGet, apiPost } from "@/api/client";
import type { User } from "@/types/auth";

interface UserEnvelope {
  user: User;
}

interface ApiErrorBody {
  error: string;
}

export const authApi = {
  me: () => apiGet<UserEnvelope | ApiErrorBody>("/api/auth/me"),
  login: (email: string, password: string) =>
    apiPost<UserEnvelope | ApiErrorBody>("/api/auth/login", { email, password }),
  logout: () => apiPost<{ ok: true }>("/api/auth/logout", {}),
  /** REQ-422: public — the person has no session yet. */
  acceptInvite: (token: string, password: string, name: string) =>
    apiPost<{ ok: true } | ApiErrorBody>("/api/auth/invites/accept", { token, password, name: name.trim() || null }),
};

/** The query parameter an invite link carries (`/?convite=<token>`). */
export const INVITE_PARAM = "convite";

export function inviteTokenFrom(search: string): string | null {
  const token = new URLSearchParams(search).get(INVITE_PARAM);
  return token && token.trim() ? token : null;
}

/** Removes the token from the address bar once used: a secret should not linger in the history. */
export function forgetInviteToken(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete(INVITE_PARAM);
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}
