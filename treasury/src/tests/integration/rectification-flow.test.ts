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

/**
 * The entry that was keyed as 250 and never happened.
 *
 * Shaped as `serializeEvent` publishes it, parties and source included. Those two are not used by
 * the correction today, but the fake must not answer with less than the real Ledger does — a mirror
 * that drifts is how a DTO stops being a mirror.
 */
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
  parties: [
    { partyId: PARTY.USINA, role: "payee", direction: "in", amount: "250.00" },
    { partyId: PARTY.BROKER, role: "beneficiary", direction: "neutral", amount: "250.00" },
  ],
  source: { system: "integration", reference: "intent:abc-123" },
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
    if (req.method === "GET" && path === "/api/events/evt-legacy-party") {
      // The counterparty is free text from before the Directory existed.
      res.end(JSON.stringify({
        ...WRONG_EVENT,
        id: "evt-legacy-party",
        parties: [
          { partyId: PARTY.USINA, role: "payee", direction: "in", amount: "250.00" },
          { partyId: "Zeta Distribuidora S/A", role: "beneficiary", direction: "neutral", amount: "250.00" },
        ],
      }));
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
      PARTY.USINA,
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
    const { retraction } = await rectify.execute({ targetEventId: "evt-wrong", userId: "cfo" });

    expect(retraction!.status).toBe("accepted");
    expect(retraction!.intentStatus).toBe(IntentStatus.ACCEPTED);
    expect(retraction!.ledgerReference).toBe("evt-fix");

    const intent = await repo.findById(retraction!.intentId);
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

    const { retraction } = await rectify.execute({ targetEventId: "evt-wrong", userId: "cfo" });
    expect(retraction!.intentStatus).toBe(IntentStatus.REJECTED);
    expect(retraction!.rejections?.[0].category).toBe("duplicate");
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

    const { retraction } = await rectify.execute({ targetEventId: "evt-wrong", userId: "cfo" });
    expect(retraction!.intentStatus).toBe(IntentStatus.AWAITING_CORRECTION);
    expect(retraction!.correction?.slots).toEqual(["target"]);
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

/**
 * Restating an entry — the correction that says what the figure REALLY was.
 *
 * The Ledger has no relation that restates an amount (`ADJUSTS` closes a position rather than
 * reopening its baseline), so the faithful sequence is two events: withdraw the entry, then record
 * the true one on the same position. Nothing is rewritten; the wrong figure stays in the chain,
 * marked retracted, and stops counting.
 */
describe("restating an entry — withdraw, then record what actually happened", () => {
  it("emits both events, withdrawal first", async () => {
    const { rectify } = wire();
    const result = await rectify.execute({
      targetEventId: "evt-wrong",
      userId: "cfo",
      description: "bank statement 08/2026",
      corrected: { amount: "450.00" },
    });

    expect(result.retraction!.status).toBe("accepted");
    expect(result.reissue!.status).toBe("accepted");
    expect(submitted).toHaveLength(2);

    // The order is a safety decision: a failure after the first leaves the book understating, which
    // is visible, rather than double-counting, which is a false number nobody notices.
    expect(submitted[0].eventType).toBe("ledger_correction");
    expect(submitted[1].eventType).toBe("advance_settlement");
  });

  it("the withdrawal restates the figure as recorded; the new figure belongs to the entry replacing it", async () => {
    const { rectify } = wire();
    await rectify.execute({ targetEventId: "evt-wrong", userId: "cfo", corrected: { amount: "450.00" } });

    expect(submitted[0].amount).toBe("250.00"); // what is being withdrawn
    expect(submitted[1].amount).toBe("450.00"); // what actually happened
  });

  it("both events land on the same position — that is what makes them one correction", async () => {
    const { rectify } = wire();
    await rectify.execute({ targetEventId: "evt-wrong", userId: "cfo", corrected: { amount: "450.00" } });

    expect(submitted[0].objects[0].objectId).toBe("intent:adv-1");
    expect(submitted[1].objects[0].objectId).toBe("intent:adv-1");
    expect(submitted[1].objects[0].relation).toBe("settles");
  });

  it("the reissue carries over everything the correction may not change", async () => {
    const { rectify } = wire();
    await rectify.execute({ targetEventId: "evt-wrong", userId: "cfo", corrected: { amount: "450.00" } });

    const reissue = submitted[1];
    // Counterparty above all: changing who took part changes WHICH fact it is, not how it was measured.
    expect(reissue.parties.some((p) => p.partyId === PARTY.BROKER)).toBe(true);
    expect(reissue.relatedEventId).toBe("evt-advance"); // lineage preserved
    expect(reissue.currency).toBe("BRL");
    // Untouched by the correction, so carried over from the record rather than moved silently.
    expect(reissue.occurredAt).toBe("2026-07-09T00:00:00.000Z");
  });

  it("the withdrawal declares that a sequel is expected, so an interrupted correction is recognisable", async () => {
    const { rectify } = wire();
    await rectify.execute({ targetEventId: "evt-wrong", userId: "cfo", corrected: { amount: "450.00" } });

    expect(submitted[0].reason.requiresFollowup).toBe(true);
  });

  it("a plain withdrawal declares no sequel", async () => {
    const { rectify } = wire();
    await rectify.execute({ targetEventId: "evt-wrong", userId: "cfo" });

    expect(submitted).toHaveLength(1);
    expect(submitted[0].reason.requiresFollowup).toBe(false);
  });

  it("a correction may restate the date as well", async () => {
    const { rectify } = wire();
    await rectify.execute({
      targetEventId: "evt-wrong",
      userId: "cfo",
      corrected: { occurredAt: "2026-07-15T00:00:00.000Z" },
    });

    expect(submitted[1].occurredAt).toBe("2026-07-15T00:00:00.000Z");
    expect(submitted[1].amount).toBe("250.00"); // untouched
  });

  it("when the withdrawal is refused, no corrected entry is attempted", async () => {
    const { rectify } = wire();
    nextOutcome = {
      status: 200,
      body: { status: "rejected", reason: "already retracted", rejections: [{ code: "DUPLICATE", category: "duplicate", detail: "x" }] },
    };

    const result = await rectify.execute({ targetEventId: "evt-wrong", userId: "cfo", corrected: { amount: "450.00" } });

    expect(result.reissue).toBeUndefined();
    expect(submitted).toHaveLength(1);
  });
});

describe("restating an entry — when the record alone is not enough", () => {
  it("says the correction is half done rather than submitting something incomplete", async () => {
    const { rectify } = wire();
    // A legacy entry whose counterparty is free text the Directory never knew. The PARTY answer is
    // deliberately not recorded — an unresolvable mention is asked about, never invented — so the
    // corrected entry cannot be described from the record alone.
    const result = await rectify.execute({
      targetEventId: "evt-legacy-party",
      userId: "cfo",
      corrected: { amount: "450.00" },
    });

    expect(result.retraction!.status).toBe("accepted");
    expect(result.reissue).toBeUndefined();
    expect(result.reissueIncomplete).toEqual({ missingSlot: "payer" });
    // The withdrawal stands and declared a sequel, so the position will surface the unfinished work.
    expect(submitted).toHaveLength(1);
    expect(submitted[0].reason.requiresFollowup).toBe(true);
  });
});
