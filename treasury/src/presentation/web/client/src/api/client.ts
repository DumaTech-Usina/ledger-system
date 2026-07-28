export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T;
}

async function toResult<T>(res: Response): Promise<ApiResult<T>> {
  const data = (await res.json()) as T;
  return { ok: res.ok, status: res.status, data };
}

export async function apiGet<T = unknown>(url: string): Promise<ApiResult<T>> {
  const res = await fetch(url, { credentials: "same-origin" });
  return toResult<T>(res);
}

export async function apiPost<T = unknown>(url: string, body: unknown): Promise<ApiResult<T>> {
  const res = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return toResult<T>(res);
}
