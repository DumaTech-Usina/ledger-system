import type { Candidate } from "../../core/domain/value-objects/Candidate";
import type { CandidateSubmissionPort, SubmissionOutcome } from "../../core/application/ports/CandidateSubmissionPort";

/** Where the Ledger exposes the submit endpoint (relative to LEDGER_API_URL). */
const SUBMIT_PATH = "/api/intents/submit";

/**
 * Real submission adapter — POSTs the candidate to the Ledger's submit endpoint over HTTP.
 *
 * Flexibility: the base URL is configurable (LEDGER_API_URL), so the SAME build reaches the Ledger
 * whether it's on a Docker internal network (e.g. http://ledger:3000) or an external host — no code
 * change. Auth is a service token (Bearer); the candidate's sourceReference (intent:<id>) is sent as
 * the idempotency key so retries never double-post.
 *
 * Outcome mapping:
 *  - 200 { status: "accepted"|"rejected", ... }  → a business outcome (the Ledger disposed)
 *  - anything else (auth/transport/timeout)      → THROWS (not a rejection) so the intent stays
 *                                                   retryable rather than being marked rejected.
 *
 * INTERIM: sends the canonical candidate (contract option B). Moving to "business intent" (option A)
 * + party resolution is a later change behind this same port.
 */
export class HttpCandidateSubmissionAdapter implements CandidateSubmissionPort {
  constructor(
    private readonly baseUrl: string,
    private readonly serviceToken: string,
    private readonly timeoutMs = 5000,
  ) {}

  async submit(candidate: Candidate): Promise<SubmissionOutcome> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const headers: Record<string, string> = {
        "content-type": "application/json",
        "idempotency-key": candidate.sourceReference,
      };
      if (this.serviceToken) headers["authorization"] = `Bearer ${this.serviceToken}`;

      const res = await fetch(this.baseUrl + SUBMIT_PATH, {
        method: "POST",
        headers,
        body: JSON.stringify(candidate),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Ledger submit failed (HTTP ${res.status})`);
      }

      const body = (await res.json()) as { status?: string; ledgerReference?: string; reason?: string };
      if (body.status === "accepted") return { status: "accepted", ledgerReference: body.ledgerReference };
      if (body.status === "rejected") return { status: "rejected", reason: body.reason };
      throw new Error("Ledger submit returned an unrecognized outcome");
    } finally {
      clearTimeout(timer);
    }
  }
}
