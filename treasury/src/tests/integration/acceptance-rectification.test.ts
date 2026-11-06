import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createServer, type Server } from "http";
import type { AddressInfo } from "net";
import { InMemoryIntentRepository } from "../../infra/persistence/InMemoryIntentRepository";
import { InMemoryAuditLog } from "../../infra/audit/InMemoryAuditLog";
import { HttpLedgerReadAdapter } from "../../infra/ledger-read/HttpLedgerReadAdapter";
import { HttpCandidateSubmissionAdapter } from "../../infra/submission/HttpCandidateSubmissionAdapter";
import { CandidateMapper, continuityObjectType, continuitySlot } from "../../core/application/services/CandidateMapper";
import { StartIntentUseCase } from "../../core/application/use-cases/StartIntent";
import { ApplyAnswersUseCase } from "../../core/application/use-cases/ApplyAnswers";
import { SubmitIntentUseCase } from "../../core/application/use-cases/SubmitIntent";
import { SubmitRectificationUseCase } from "../../core/application/use-cases/SubmitRectification";
import type { Candidate } from "../../core/domain/value-objects/Candidate";
import type { Clock } from "../../core/application/ports/Clock";
import type { IdGenerator } from "../../core/application/ports/IdGenerator";
import { PARTY, partyDirectory } from "../fixtures/parties";

/**
 * CA-521, CA-521b and REJ-524, with the document's own example: an advance keyed as 400,00 that was
 * really 450,00.
 *
 * The position is the Ledger's to compute, and the Ledger's suite proves it
 * (`ledger/src/tests/integration/business-flows/rectification-read.test.ts`: the corrected amount
 * counts, the wrong one stops, the history survives). What belongs to Treasury, and is proved here,
 * is what it asks the Ledger to record, in what order, and what it never asks.
 *
 * A second origination on a position whose origination was retracted is what the Ledger expects here:
 * run against the real Ledger, 400 → retract → 450 reads 0,00 in between and 450,00 at the end.
 */
const clock: Clock = { now: () => "2026-11-03T12:00:00.000Z" };

const ADVANCE = {
  id: "evt-400",
  eventType: "advance_payment",
  economicEffect: "cash_out",
  amount: "400.00",
  currency: "BRL",
  occurredAt: "2026-10-20T00:00:00.000Z",
  description: "Adiantamento",
  objects: [{ objectId: "intent:adv-400", objectType: "advance", relation: "originates" }],
  parties: [
    { partyId: PARTY.USINA, role: "payer", direction: "out", amount: "400.00" },
    { partyId: PARTY.BROKER, role: "beneficiary", direction: "neutral", amount: "400.00" },
  ],
  source: { system: "treasury", reference: "intent:adv-400" },
};

let ledger: Server;
let baseUrl: string;
let requests: string[] = [];
let submitted: Candidate[] = [];
let outcomes: unknown[] = [];
const events = new Map<string, unknown>([["evt-400", ADVANCE]]);

beforeAll(async () => {
  ledger = createServer((req, res) => {
    const path = decodeURIComponent((req.url || "").split("?")[0]);
    requests.push(`${req.method} ${path}`);
    res.setHeader("content-type", "application/json");

    const event = req.method === "GET" ? events.get(path.replace("/api/events/", "")) : undefined;
    if (event) {
      res.end(JSON.stringify(event));
      return;
    }
    if (req.method === "POST" && path === "/api/intents/submit") {
      let raw = "";
      req.on("data", (chunk) => (raw += chunk));
      req.on("end", () => {
        submitted.push(JSON.parse(raw) as Candidate);
        res.end(JSON.stringify(outcomes.shift() ?? { status: "accepted", ledgerReference: `evt-${submitted.length}` }));
      });
      return;
    }
    res.statusCode = 404;
    res.end("{}");
  });
  await new Promise<void>((resolve) => ledger.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(ledger.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => ledger.close(() => resolve())));

beforeEach(() => {
  requests = [];
  submitted = [];
  outcomes = [];
});

function rectification() {
  const directory = partyDirectory();
  const repo = new InMemoryIntentRepository();
  const audit = new InMemoryAuditLog();
  let n = 0;
  const ids: IdGenerator = { next: () => `rect-${++n}` };
  const applyAnswers = new ApplyAnswersUseCase(repo, clock, audit, directory);
  const startIntent = new StartIntentUseCase(repo, clock, ids, audit);
  const submitIntent = new SubmitIntentUseCase(
    repo,
    new CandidateMapper(PARTY.USINA),
    new HttpCandidateSubmissionAdapter(baseUrl, ""),
    audit,
    clock,
    directory,
  );
  return new SubmitRectificationUseCase(
    new HttpLedgerReadAdapter(baseUrl),
    startIntent,
    applyAnswers,
    submitIntent,
    clock,
    PARTY.USINA,
  );
}

/** The ordinary path: an operator registering an advance, with no rectification anywhere near it. */
async function startAdvance(answers: Record<string, string>) {
  const directory = partyDirectory();
  const repo = new InMemoryIntentRepository();
  const audit = new InMemoryAuditLog();
  const ids: IdGenerator = { next: () => "plain" };
  const { intentId } = await new StartIntentUseCase(repo, clock, ids, audit).execute({
    scenarioId: "register_advance",
    userId: "cfo",
  });
  const { state } = await new ApplyAnswersUseCase(repo, clock, audit, directory).execute({
    intentId,
    answers: Object.entries(answers).map(([key, value]) => ({ key, value })),
  });
  const intent = (await repo.findById(intentId))!;
  return { intentId, state, candidate: new CandidateMapper(PARTY.USINA).build(intent, undefined as never) };
}

describe("CA-521 — adiantamento de 400,00 retificado para 450,00", () => {
  it("retira os 400,00 da posição e depois registra os 450,00", async () => {
    const result = await rectification().execute({
      targetEventId: "evt-400",
      userId: "cfo",
      corrected: { amount: "450.00" },
    });

    expect(result.retraction?.status).toBe("accepted");
    expect(result.reissue?.status).toBe("accepted");
    expect(submitted.map((c) => [c.eventType, c.amount])).toEqual([
      ["ledger_correction", "400.00"],
      ["advance_payment", "450.00"],
    ]);
    expect(submitted[0].objects[0]).toMatchObject({ objectId: "intent:adv-400", relation: "retracts" });
    expect(submitted[1].objects[0].relation).toBe("originates");
  });

  it("a reemissão fica na mesma posição da retirada, e não em uma nova", async () => {
    await rectification().execute({
      targetEventId: "evt-400",
      userId: "cfo",
      corrected: { amount: "450.00" },
    });

    expect(submitted[1].objects[0].objectId).toBe("intent:adv-400");
  });

  it.each([
    ["empréstimo", "loan_origination", "loan"],
    ["comissão prevista", "commission_expected", "commission_receivable"],
  ])("vale também para %s", async (_label, eventType, objectType) => {
    events.set("evt-other", {
      ...ADVANCE,
      id: "evt-other",
      eventType,
      economicEffect: eventType === "loan_origination" ? "cash_out" : "non_cash",
      objects: [{ objectId: "position:other", objectType, relation: "originates" }],
    });

    const result = await rectification().execute({
      targetEventId: "evt-other",
      userId: "cfo",
      corrected: { amount: "450.00" },
    });

    expect(result.reissue?.status).toBe("accepted");
    expect(submitted[1].eventType).toBe(eventType);
    expect(submitted[1].objects[0].objectId).toBe("position:other");
  });

  it("registrar um adiantamento novo continua abrindo uma posição nova, sem perguntar qual", async () => {
    const answers = { payee: PARTY.BROKER, amount: "450.00", currency: "BRL", occurredAt: "2026-11-03" };
    const started = await startAdvance(answers);

    expect(started.state.kind).toBe("ready");
    expect(started.candidate.objects[0].objectId).toBe(`intent:${started.intentId}`);
    expect(continuityObjectType("register_advance")).toBeUndefined();
    expect(continuitySlot("register_advance")).toBeUndefined();
  });
});

describe("CA-521b — o mesmo caso, interrompido depois da retirada", () => {
  it("a retirada fica de pé, a reemissão não, e a posição nunca é contada em dobro", async () => {
    outcomes = [
      { status: "accepted", ledgerReference: "evt-retraction" },
      {
        status: "rejected",
        reason: "unavailable",
        rejections: [{ code: "TUPLE_INVALID", category: "internal", detail: "refused" }],
      },
    ];

    const result = await rectification().execute({
      targetEventId: "evt-400",
      userId: "cfo",
      corrected: { amount: "450.00" },
    });

    expect(result.retraction?.status).toBe("accepted");
    expect(result.reissue?.status).toBe("rejected");
    // A retirada já declarou que uma sequência é esperada: é o que torna a interrupção visível.
    expect(submitted[0].reason.requiresFollowup).toBe(true);
  });

  it("se a retirada é recusada, a reemissão nem é tentada: nunca 850,00", async () => {
    outcomes = [
      {
        status: "rejected",
        reason: "unavailable",
        rejections: [{ code: "TUPLE_INVALID", category: "internal", detail: "refused" }],
      },
    ];

    const result = await rectification().execute({
      targetEventId: "evt-400",
      userId: "cfo",
      corrected: { amount: "450.00" },
    });

    expect(result.reissue).toBeUndefined();
    expect(submitted).toHaveLength(1);
  });
});

describe("REJ-524 — a retificação não apaga nem reescreve o original", () => {
  it("o Treasury só lê o original e acrescenta fatos que o citam", async () => {
    await rectification().execute({
      targetEventId: "evt-400",
      userId: "cfo",
      corrected: { amount: "450.00" },
    });

    expect(submitted[0].relatedEventId).toBe("evt-400");
    expect(new Set(requests)).toEqual(new Set(["GET /api/events/evt-400", "POST /api/intents/submit"]));
  });
});
