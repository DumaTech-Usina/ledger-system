import type { EligiblePage, InsuranceSourcePort } from "../../core/application/ports/InsuranceSourcePort";

/**
 * The insurance system's API, read-only. It authenticates with a session cookie (`POST /auth/login`);
 * a 401 logs in once more and retries, since the session may expire between two passes.
 */
export class HttpInsuranceApiClient implements InsuranceSourcePort {
  private cookie = "";

  constructor(
    private readonly baseUrl: string,
    private readonly email: string,
    private readonly password: string,
    private readonly timeoutMs = 10_000,
  ) {}

  eligible(page: number): Promise<EligiblePage> {
    return this.get<EligiblePage>(`/payouts/eligible?page=${page}`);
  }

  policy(policyId: string): Promise<Record<string, unknown>> {
    return this.get(`/policies/${encodeURIComponent(policyId)}`);
  }

  proposal(proposalId: string): Promise<Record<string, unknown>> {
    return this.get(`/proposals/${encodeURIComponent(proposalId)}`);
  }

  private async get<T>(path: string, retried = false): Promise<T> {
    if (!this.cookie) await this.login();
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: { cookie: this.cookie },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (res.status === 401 && !retried) {
      this.cookie = "";
      return this.get<T>(path, true);
    }
    if (!res.ok) throw new Error(`Insurance API ${path}: HTTP ${res.status}`);
    return (await res.json()) as T;
  }

  private async login(): Promise<void> {
    if (!this.email || !this.password) throw new Error("INSURANCE_API_EMAIL and INSURANCE_API_PASSWORD are required.");
    const res = await fetch(`${this.baseUrl}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: this.email, password: this.password }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new Error(`Insurance API login: HTTP ${res.status}`);
    const cookies = res.headers.getSetCookie?.() ?? [res.headers.get("set-cookie") ?? ""];
    this.cookie = cookies.map((c) => c.split(";")[0]).filter(Boolean).join("; ");
    if (!this.cookie) throw new Error("Insurance API login: no session cookie returned.");
  }
}
