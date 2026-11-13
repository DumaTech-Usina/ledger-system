import { useCallback, useEffect, useState } from "react";
import { authApi } from "@/features/auth/authApi";
import { SESSION_ENDED_EVENT } from "@/api/client";
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

  // FA-403: the session expired or was ended while the user worked. Back to the login; the section
  // the user was on lives in App's state, so the login returns to it.
  useEffect(() => {
    const onEnded = () => {
      setUser(null);
      setStatus("anonymous");
      setJustLoggedIn(false);
    };
    window.addEventListener(SESSION_ENDED_EVENT, onEnded);
    return () => window.removeEventListener(SESSION_ENDED_EVENT, onEnded);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { ok, data } = await authApi.login(email, password);
    if (ok && "user" in data) {
      setUser(data.user);
      setStatus("authenticated");
      setJustLoggedIn(true);
      return { ok: true as const };
    }
    // REQ-413: one message for every refusal, whatever the server's reason.
    return { ok: false as const };
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
    setStatus("anonymous");
    setJustLoggedIn(false);
  }, []);

  /** Re-reads the user: a role or curation change counts from the next request (REQ-404). */
  const refresh = useCallback(async () => {
    const { ok, data } = await authApi.me();
    if (ok && "user" in data) setUser(data.user);
  }, []);

  const clearJustLoggedIn = useCallback(() => setJustLoggedIn(false), []);

  return { status, user, login, logout, refresh, justLoggedIn, clearJustLoggedIn };
}
