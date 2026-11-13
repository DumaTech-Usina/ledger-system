export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T;
}

/**
 * Fired when the server answers 401 to a request made with a session: it expired or was ended
 * (REQ-412, REQ-403). The app goes back to the login and, after it, to the page it was on (FA-403).
 * The login itself and the session check are left out: a 401 there is the expected answer.
 */
export const SESSION_ENDED_EVENT = "treasury:session-ended";
const SESSION_PROBES = new Set(["/api/auth/login", "/api/auth/me", "/api/auth/invites/accept"]);

async function toResult<T>(url: string, res: Response): Promise<ApiResult<T>> {
  if (res.status === 401 && !SESSION_PROBES.has(url) && typeof window !== "undefined") {
    window.dispatchEvent(new Event(SESSION_ENDED_EVENT));
  }
  const data = (await res.json()) as T;
  return { ok: res.ok, status: res.status, data };
}

export async function apiGet<T = unknown>(url: string): Promise<ApiResult<T>> {
  const res = await fetch(url, { credentials: "same-origin" });
  return toResult<T>(url, res);
}

export async function apiPost<T = unknown>(url: string, body: unknown): Promise<ApiResult<T>> {
  const res = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return toResult<T>(url, res);
}
