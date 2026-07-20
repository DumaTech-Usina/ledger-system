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
  login: (username: string, password: string) =>
    apiPost<UserEnvelope | ApiErrorBody>("/api/auth/login", { username, password }),
  logout: () => apiPost<{ ok: true }>("/api/auth/logout", {}),
};
