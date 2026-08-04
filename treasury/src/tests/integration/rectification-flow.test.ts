import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "http";
import { AddressInfo } from "net";
import { InMemoryIntentRepository } from "../../infra/persistence/InMemoryIntentRepository";
import { InMemoryAuditLog } from "../../infra/audit/InMemoryAuditLog";
import { HttpLedgerReadAdapter } from "../../infra/ledger-read/HttpLedgerReadAdapter";
import { HttpCandidateSubmissionAdapter } from "../../infra/submission/HttpCandidateSubmissionAdapter";
import { CandidateMapper } from "../../core/application/services/CandidateMapper";
import { StartIntentUseCase } from "../../core/application/use-cases/StartIntent";
import { ApplyAnswersUseCase } from "../../core/application/use-cases/ApplyAnswers";
import { SubmitIntentUseCase } from "../../core/application/use-cases/SubmitIntent";
import { SubmitRectificationUseCase } from "../../core/application/use-cases/SubmitRectification";
import { IntentStatus } from "../../core/domain/enums/IntentStatus";
import type { Candidate } from "../../core/domain/value-objects/Candidate";
import type { Clock } from "../../core/application/ports/Clock";
import type { IdGenerator } from "../../core/application/ports/IdGenerator";
import { PARTY, partyDirectory } from "../fixtures/parties";

/**
 * Treasury produces a LEDGER_CORRECTION through the Ledger's public API.
 *
 * The operator points at the entry that never happened; everything else — the amount, the object it
 * moved, its kind — is read from the Ledger's own record of that entry (`GET /api/events/:id`). That
 * is the whole point of the design: a correction cannot disagree with what it corrects, because the
 * figures are never typed a second time.
 */

const clock: Clock = { now: () => "2026-08-05T00:00:00.000Z" };

/** The entry that was keyed as 250 and never happened. */
const WRONG_EVENT = {
  id: "evt-wrong",
  eventType: "advance_settlement",
  economicEffect: "cash_in",
  amount: "250.00",
  currency: "BRL",
  occurredAt: "2026-07-09T00:00:00.000Z",
  description: "Advance recovery",
  relatedEventId: "evt-advance",
  objects: [{ objectId: "intent:adv-1", objectType: "advance", relation: "settles" }],
};

let ledger: Server;
let baseUrl: string;
let submitted: Candidate[] = [];
let nextOutcome: { status: number; body: unknown } | null = null;

beforeAll(async () => {
  ledger = createServer((req, res) => {
    const path = decodeURIComponent((req.url || "").split("?")[0]);
    res.setHeader("content-type", "application/json");

    if (req.method === "GET" && path === "/api/events/evt-wrong") {
      res.end(JSON.stringify(WRONG_EVENT));
      return;
    }
    if (req.method === "GET" && path === "/api/events/evt-batch") {
      // An entry that only REFERENCES a contextual object: it moved no position.
      res.end(JSON.stringify({ ...WRONG_EVENT, id: "evt-batch", objects: [{ objectId: "batch-1", objectType: "settlement_batch", relation: "references" }] }));
      return;
    }
    if (req.method === "GET" && path === "/api/events/evt-payable") {
      res.end(JSON.stringify({ ...WRONG_EVENT, id: "evt-payable", objects: [{ objectId: "payable-1", objectType: "payable", relation: "settles" }] }));
      return;
    }
    if (req.method === "POST" && path === "/api/intents/submit") {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        submitted.push(JSON.parse(raw) as Candidate);
        const outcome = nextOutcome ?? { status: 200, body: { status: "accepted", ledgerReference: "evt-fix" } };
        res.statusCode = outcome.status;
        res.end(JSON.stringify(outcome.body));
      });
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "not found" }));
  });
  await new Promise<void>((resolve) => ledger.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(ledger.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => ledger.close(() => resolve())));

function wire() {
  const directory = partyDirectory();
  submitted = [];
  nextOutcome = null;
  const repo = new InMemoryIntentRepository();
  const audit = new InMemoryAuditLog();
  const mapper = new CandidateMapper(PARTY.USINA);
  let n = 0;
  const ids: IdGenerator = { next: () => `rect-${++n}` };
  const applyAnswers = new ApplyAnswersUseCase(repo, clock, audit, directory);
  const startIntent = new StartIntentUseCase(repo, clock, ids, audit);
  const submitIntent = new SubmitIntentUseCase(
    repo,
    mapper,
    new HttpCandidateSubmissionAdapter(baseUrl, ""),
    audit,
    clock,
    directory,
  );
  return {
    repo,
    rectify: new SubmitRectificationUseCase(
      new HttpLedgerReadAdapter(baseUrl),
      startIntent,
      applyAnswers,
      submitIntent,
      clock,
    ),
  };
}

describe("the payload Treasury produces for a rectification", () => {
  it("carries the ratified LEDGER_CORRECTION tuple", async () => {
    const { rectify } = wire();
    await rectify.execute({ targetEventId: "evt-wrong", userId: "cfo", description: "bank statement 08/2026" });

    expect(submitted).toHaveLength(1);
    const candidate = submitted[0];

    expect(candidate.eventType).toBe("ledger_correction");
    expect(candidate.economicEffect).toBe("non_cash");
    expect(candidate.reason.type).toBe("data_reconciliation");
    expect(candidate.reason.confidence).toBe("high"); // the Ledger contract demands it
    expect(candidate.reason.requiresFollowup).toBe(false);
  });

  it("names the corrected entry, and takes its figures from the Ledger's record — never retyped", async () => {
    const { rectify } = wire();
    await rectify.execute({ targetEventId: "evt-wrong", userId: "cfo" });
    const candidate = submitted[0];

    expect(candidate.relatedEventId).toBe("evt-wrong");
    expect(candidate.amount).toBe(WRONG_EVENT.amount);
    expect(candidate.currency).toBe(WRONG_EVENT.currency);
    expect(candidate.objects).toEqual([
      { objectId: "intent:adv-1", objectType: "advance", relation: "retracts" },
    ]);
  });

  it("carries a single neutral party and no counterparty — nothing moves", async () => {
    const { rectify } = wire();
    await rectify.execute({ targetEventId: "evt-wrong", userId: "cfo" });

    expect(submitted[0].parties).toEqual([
      { partyId: PARTY.USINA, role: "platform", direction: "neutral" },
    ]);
  });

  it("dates the correction when the error was established, not when the entry occurred", async () => {
    const { rectify } = wire();
    await rectify.execute({ targetEventId: "evt-wrong", userId: "cfo" });

    expect(submitted[0].occurredAt).toBe("2026-08-05T00:00:00.000Z");
    expect(submitted[0].occurredAt).not.toBe(WRONG_EVENT.occurredAt);
  });

  it("records what established the error when given", async () => {
    const { rectify } = wire();
    await rectify.execute({ targetEventId: "evt-wrong", userId: "cfo", description: "bank statement 08/2026" });

    expect(submitted[0].description).toBe("bank statement 08/2026");
  });

  it("the object kind follows the corrected entry — a loan entry rectifies a loan", async () => {
    const { rectify } = wire();
    // The same fake entry, re-shaped as a loan repayment by the fake Ledger.
    const original = WRONG_EVENT.objects;
    (WRONG_EVENT as { objects: unknown }).objects = [
      { objectId: "intent:loan-1", objectType: "loan", relation: "settles" },
    ];
    try {
      await rectify.execute({ targetEventId: "evt-wrong", userId: "cfo" });
      expect(submitted[0].objects[0]).toEqual({
        objectId: "intent:loan-1",
        objectType: "loan",
        relation: "retracts",
      });
    } finally {
      (WRONG_EVENT as { objects: unknown }).objects = original;
    }
  });
});

describe("the HTTP round trip", () => {
  it("an accepted rectification leaves the intent accepted, with the Ledger's reference", async () => {
    const { rectify, repo } = wire();
    const result = await rectify.execute({ targetEventId: "evt-wrong", userId: "cfo" });

    expect(result.status).toBe("accepted");
    expect(result.intentStatus).toBe(IntentStatus.ACCEPTED);
    expect(result.ledgerReference).toBe("evt-fix");

    const intent = await repo.findById(result.intentId);
    expect(intent?.status).toBe(IntentStatus.ACCEPTED);
    expect(intent?.scenarioId).toBe("register_rectification");
  });
});

describe("the errors the Ledger returns reach the caller as a contract", () => {
  it("an entry already rectified is terminal, not a correction loop", async () => {
    const { rectify } = wire();
    nextOutcome = {
      status: 200,
      body: {
        status: "rejected",
        reason: "already retracted",
        rejections: [{ code: "DUPLICATE", category: "duplicate", detail: "This entry was already recorded." }],
      },
    };

    const result = await rectify.execute({ targetEventId: "evt-wrong", userId: "cfo" });
    expect(result.intentStatus).toBe(IntentStatus.REJECTED);
    expect(result.rejections?.[0].category).toBe("duplicate");
  });

  it("a lineage rejection routes back to the slot that names the corrected entry", async () => {
    const { rectify } = wire();
    nextOutcome = {
      status: 200,
      body: {
        status: "rejected",
        reason: "origin not found",
        rejections: [{ code: "ORIGIN_NOT_FOUND", category: "lineage", field: "relatedEventId", detail: "The referenced originating entry could not be found." }],
      },
    };

    const result = await rectify.execute({ targetEventId: "evt-wrong", userId: "cfo" });
    expect(result.intentStatus).toBe(IntentStatus.AWAITING_CORRECTION);
    expect(result.correction?.slots).toEqual(["target"]);
  });
});

describe("what Treasury refuses to build", () => {
  it("an entry the Ledger does not know", async () => {
    const { rectify } = wire();
    await expect(rectify.execute({ targetEventId: "evt-ghost", userId: "cfo" })).rejects.toThrow(/Unknown entry/i);
    expect(submitted).toHaveLength(0);
  });

  it("an entry that moved no position — a reference is not something to rectify", async () => {
    const { rectify } = wire();
    await expect(rectify.execute({ targetEventId: "evt-batch", userId: "cfo" })).rejects.toThrow(/moved no position/i);
    expect(submitted).toHaveLength(0);
  });

  it("an object kind treasury does not map — it says so instead of guessing one", async () => {
    const { rectify } = wire();
    await expect(rectify.execute({ targetEventId: "evt-payable", userId: "cfo" })).rejects.toThrow(/not supported yet/i);
    expect(submitted).toHaveLength(0);
  });
});
