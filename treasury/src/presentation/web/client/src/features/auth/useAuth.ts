import { useCallback, useEffect, useState } from "react";
import { authApi } from "@/features/auth/authApi";
import type { User } from "@/types/auth";

type Status = "checking" | "authenticated" | "anonymous";

export function useAuth() {
  const [status, setStatus] = useState<Status>("checking");
  const [user, setUser] = useState<User | null>(null);
  // True only right after a fresh login submission — not when a session is restored from the
  // cookie on page load. Drives the one-time login intro.
  const [justLoggedIn, setJustLoggedIn] = useState(false);

  useEffect(() => {
    authApi.me().then(({ ok, data }) => {
      if (ok && "user" in data) {
        setUser(data.user);
        setStatus("authenticated");
      } else {
        setStatus("anonymous");
      }
    });
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const { ok, data } = await authApi.login(username, password);
    if (ok && "user" in data) {
      setUser(data.user);
      setStatus("authenticated");
      setJustLoggedIn(true);
      return { ok: true as const };
    }
    // Never surface the backend's raw error text here — login failures stay generic on purpose.
    return { ok: false as const };
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
    setStatus("anonymous");
    setJustLoggedIn(false);
  }, []);

  const clearJustLoggedIn = useCallback(() => setJustLoggedIn(false), []);

  return { status, user, login, logout, justLoggedIn, clearJustLoggedIn };
}
