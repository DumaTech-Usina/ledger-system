import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "http";
import { AddressInfo } from "net";
import { HttpCandidateSubmissionAdapter } from "../../infra/submission/HttpCandidateSubmissionAdapter";
import type { Candidate } from "../../core/domain/value-objects/Candidate";
import { PARTY } from "../fixtures/parties";

const candidate = (over: Partial<Candidate> = {}): Candidate => ({
  sourceReference: "intent:abc",
  eventType: "charge_created",
  economicEffect: "cash_in",
  occurredAt: "2026-07-09T00:00:00.000Z",
  amount: "1500.00",
  currency: "BRL",
  description: undefined,
  parties: [{ partyId: PARTY.USINA, role: "payee", direction: "in", amount: "1500.00" }],
  objects: [{ objectId: "intent:abc", objectType: "charge", relation: "originates" }],
  reason: { type: "charge", description: "x", confidence: "high", requiresFollowup: false },
  reporter: { reporterType: "user", reporterId: "user-cfo", channel: "web" },
  ...over,
});

// Fake Ledger submit endpoint. Records what it received; decides the outcome from the body.
let server: Server;
let baseUrl: string;
let received: { auth?: string; idem?: string; body?: any } = {};

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      received = { auth: req.headers["authorization"] as string, idem: req.headers["idempotency-key"] as string, body: JSON.parse(raw || "{}") };
      res.setHeader("content-type", "application/json");
      if (req.url === "/api/intents/submit") {
        if (received.auth !== "Bearer secret-token") { res.statusCode = 401; res.end(JSON.stringify({ error: "unauthorized" })); return; }
        if ((received.body.description ?? "").includes("reject")) { res.end(JSON.stringify({ status: "rejected", reason: "not allowed" })); return; }
        res.end(JSON.stringify({ status: "accepted", ledgerReference: "evt_real_1" }));
      } else { res.statusCode = 404; res.end("{}"); }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe("HttpCandidateSubmissionAdapter", () => {
  it("posts the candidate with the token + idempotency key and maps an acceptance", async () => {
    const adapter = new HttpCandidateSubmissionAdapter(baseUrl, "secret-token");
    const outcome = await adapter.submit(candidate());
    expect(outcome).toEqual({ status: "accepted", ledgerReference: "evt_real_1" });
    expect(received.auth).toBe("Bearer secret-token");
    expect(received.idem).toBe("intent:abc"); // idempotency key = sourceReference
    expect(received.body.eventType).toBe("charge_created");
  });

  it("maps a business rejection to a rejected outcome", async () => {
    const adapter = new HttpCandidateSubmissionAdapter(baseUrl, "secret-token");
    const outcome = await adapter.submit(candidate({ description: "please reject" }));
    expect(outcome.status).toBe("rejected");
    expect(outcome.reason).toBe("not allowed");
  });

  it("throws (not rejects) on an auth failure, so the intent stays retryable", async () => {
    const adapter = new HttpCandidateSubmissionAdapter(baseUrl, "wrong-token");
    await expect(adapter.submit(candidate())).rejects.toThrow(/HTTP 401/);
  });

  it("throws when the Ledger is unreachable", async () => {
    const adapter = new HttpCandidateSubmissionAdapter("http://127.0.0.1:59998", "secret-token", 1000);
    await expect(adapter.submit(candidate())).rejects.toThrow();
  });
});
