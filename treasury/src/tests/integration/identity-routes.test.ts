import { describe, it, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import { createServer, type Server } from "http";
import type { AddressInfo } from "net";
import { conversationRoutes } from "../../presentation/web/api/routes/conversationRoutes";
import { InMemoryIntentRepository } from "../../infra/persistence/InMemoryIntentRepository";
import { InMemoryAuditLog } from "../../infra/audit/InMemoryAuditLog";
import { StubCandidateSubmissionAdapter } from "../../infra/submission/StubCandidateSubmissionAdapter";
import { StubSlotExtractionAdapter } from "../../infra/nlp/StubSlotExtractionAdapter";
import { CandidateMapper } from "../../core/application/services/CandidateMapper";
import { PartyDirectory } from "../../core/application/services/PartyDirectory";
import { StartIntentUseCase } from "../../core/application/use-cases/StartIntent";
import { AdvanceDialogUseCase } from "../../core/application/use-cases/AdvanceDialog";
import { ApplyAnswersUseCase } from "../../core/application/use-cases/ApplyAnswers";
import { InterpretUtteranceUseCase } from "../../core/application/use-cases/InterpretUtterance";
import { PreviewIntentUseCase } from "../../core/application/use-cases/PreviewIntent";
import { SubmitIntentUseCase } from "../../core/application/use-cases/SubmitIntent";
import { SubmitRectificationUseCase } from "../../core/application/use-cases/SubmitRectification";
import { DecideIdentityUseCase } from "../../core/application/use-cases/DecideIdentity";
import { RecordPartyAttributeUseCase } from "../../core/application/use-cases/RecordPartyAttribute";
import { ListIncompletePartiesUseCase } from "../../core/application/use-cases/ListIncompleteParties";
import { StubLedgerReadAdapter } from "../../infra/ledger-read/StubLedgerReadAdapter";
import { Role } from "../../core/domain/enums/Role";
import { PartyAttributeKey } from "../../core/domain/value-objects/PartyAttribute";
import type { Clock } from "../../core/application/ports/Clock";
import type { IdGenerator } from "../../core/application/ports/IdGenerator";
import { PARTY, PARTY_DISPLAY_NAMES, seededDirectory } from "../fixtures/parties";

const clock: Clock = { now: () => "2026-08-03T00:00:00.000Z" };

/**
 * Exercises the HTTP surface the Fase 6/7 features are actually reached through: body parsing, the
 * kind guard, the 422 mapping and the authenticated user reaching the decision. The use cases have
 * their own tests; what is verified here is the wiring between them and the wire.
 */
function harness() {
  const { directory, repo: parties } = seededDirectory();
  const intents = new InMemoryIntentRepository();
  const audit = new InMemoryAuditLog();
  const mapper = new CandidateMapper(PARTY.USINA);
  let n = 0;
  const ids: IdGenerator = { next: () => `0000-${++n}` };

  const applyAnswers = new ApplyAnswersUseCase(intents, clock, audit, directory);
  const startIntent = new StartIntentUseCase(intents, clock, ids, audit);
  const submitIntent = new SubmitIntentUseCase(
    intents,
    mapper,
    new StubCandidateSubmissionAdapter(),
    audit,
    clock,
    directory,
  );

  const app = express();
  app.use(express.json());
  // Stand in for attachUser: these routes only ever read `req.user.id`.
  app.use((req, _res, next) => {
    (req as express.Request & { user: unknown }).user = {
      id: "user-cfo",
      username: "cfo",
      displayName: "CFO",
      role: Role.FINANCE_MANAGER,
    };
    next();
  });
  app.use(
    "/api/conversation",
    conversationRoutes(
      startIntent,
      new AdvanceDialogUseCase(intents, clock, audit, directory),
      applyAnswers,
      new InterpretUtteranceUseCase(
        intents,
        new StubSlotExtractionAdapter(),
        applyAnswers,
        audit,
        clock,
        ids,
        directory,
      ),
      new PreviewIntentUseCase(intents, mapper, directory),
      submitIntent,
      new SubmitRectificationUseCase(
        new StubLedgerReadAdapter() as never,
        startIntent,
        applyAnswers,
        submitIntent,
        clock,
      ),
      new DecideIdentityUseCase(intents, parties, clock, ids, audit),
      new RecordPartyAttributeUseCase(parties, clock, audit),
      new ListIncompletePartiesUseCase(directory),
    ),
  );
  return { app, parties, directory };
}

let server: Server;
let base: string;
let ctx: ReturnType<typeof harness>;

async function listen(h: ReturnType<typeof harness>) {
  ctx = h;
  server = createServer(h.app);
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/conversation`;
}

const post = (path: string, body: unknown) =>
  fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const get = (path: string) => fetch(`${base}${path}`);

/** fetch types Response.json() as unknown; these tests assert on shapes they already know. */
async function json(res: Response): Promise<any> {
  return res.json();
}

async function startIntentOver(scenarioId: string): Promise<string> {
  const res = await post("/start", { scenarioId });
  return (await json(res)).intentId;
}

beforeEach(async () => {
  await listen(harness());
});

afterEach(() => new Promise<void>((r) => server.close(() => r())));

describe("POST /:intentId/identity", () => {
  it("mints a party and fills the slot", async () => {
    const intentId = await startIntentOver("register_payment");
    const res = await post(`/${intentId}/identity`, {
      slot: "payee",
      kind: "create",
      mention: "Fornecedor Novo",
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.decision.partyId).toMatch(/^party-/);
    expect(body.decision.decidedBy).toBe("user-cfo"); // the authenticated user, not the body
    expect(body.state.kind).toBe("question");
  });

  it("rejects an unrecognised kind with 422 before reaching the use case", async () => {
    const intentId = await startIntentOver("register_payment");
    const res = await post(`/${intentId}/identity`, { slot: "payee", kind: "whatever" });

    expect(res.status).toBe(422);
    expect((await json(res)).error).toMatch(/create.*unidentifiable/i);
    expect(await ctx.parties.findAll()).toHaveLength(6); // the fixture's parties, nothing minted
  });

  it("maps a refused decision to 422 rather than a 500", async () => {
    const intentId = await startIntentOver("register_payment");
    const res = await post(`/${intentId}/identity`, {
      slot: "payee",
      kind: "unidentifiable",
      justification: "não sei",
    });

    expect(res.status).toBe(422);
    expect((await json(res)).error).toMatch(/does not admit/i);
  });

  it("maps a missing justification to 422", async () => {
    const intentId = await startIntentOver("register_commission_received");
    const res = await post(`/${intentId}/identity`, { slot: "payer", kind: "unidentifiable" });

    expect(res.status).toBe(422);
    expect((await json(res)).error).toMatch(/justification/i);
  });

  it("accepts the exception where the scenario admits it", async () => {
    const intentId = await startIntentOver("register_commission_received");
    const res = await post(`/${intentId}/identity`, {
      slot: "payer",
      kind: "unidentifiable",
      justification: "Remetente não informado pelo banco.",
    });

    expect(res.status).toBe(200);
    expect((await json(res)).decision.kind).toBe("unidentifiable");
  });

  it("handles an empty body without crashing", async () => {
    const intentId = await startIntentOver("register_payment");
    const res = await fetch(`${base}/${intentId}/identity`, {
      method: "POST",
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBe(422);
  });
});

describe("POST /:intentId/answer — the barrier over the wire", () => {
  it("returns 200 with the identity outcome and does NOT fill the slot", async () => {
    const intentId = await startIntentOver("register_payment");
    const res = await post(`/${intentId}/answer`, { key: "payee", value: "Fornecedor Qualquer" });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.identity.resolution.kind).toBe("new");
    expect(body.state.slot.key).toBe("payee"); // still asking
  });

  it("fills the slot when the mention resolves", async () => {
    const intentId = await startIntentOver("register_payment");
    const res = await post(`/${intentId}/answer`, {
      key: "payee",
      value: PARTY_DISPLAY_NAMES[PARTY.ACME],
    });

    const body = await json(res);
    expect(body.identity.resolution.partyId).toBe(PARTY.ACME);
    expect(body.state.slot.key).not.toBe("payee");
  });
});

describe("GET /:intentId/preview", () => {
  it("carries display names and the enrichment suggestion", async () => {
    const intentId = await startIntentOver("register_payment");
    const created = await json(await post(`/${intentId}/identity`, { slot: "payee", kind: "create", mention: "Padaria do Zé" }));
    for (const [key, value] of [["amount", "2500.00"], ["currency", "BRL"], ["occurredAt", "2026-08-03"]]) {
      await post(`/${intentId}/answer`, { key, value });
    }

    const body = await json(await get(`/${intentId}/preview`));
    expect(body.partyNames[created.decision.partyId]).toBe("Padaria do Zé");
    expect(body.enrichment.attribute).toBe(PartyAttributeKey.DOCUMENT);
  });
});

describe("POST /:intentId/enrich", () => {
  it("records an answer", async () => {
    const intentId = await startIntentOver("register_payment");
    const created = await json(await post(`/${intentId}/identity`, { slot: "payee", kind: "create", mention: "Padaria do Zé" }));

    const res = await post(`/${intentId}/enrich`, {
      partyId: created.decision.partyId,
      key: PartyAttributeKey.DOCUMENT,
      value: "12345678000199",
    });

    expect(res.status).toBe(200);
    const party = await ctx.parties.findById(created.decision.partyId);
    expect(party?.attributes[PartyAttributeKey.DOCUMENT]?.value).toBe("12345678000199");
    expect(party?.attributes[PartyAttributeKey.DOCUMENT]?.capturedBy).toBe("user-cfo");
  });

  it("records a blank answer as declined", async () => {
    const intentId = await startIntentOver("register_payment");
    const created = await json(await post(`/${intentId}/identity`, { slot: "payee", kind: "create", mention: "Padaria do Zé" }));

    await post(`/${intentId}/enrich`, {
      partyId: created.decision.partyId,
      key: PartyAttributeKey.DOCUMENT,
      value: "",
    });

    const party = await ctx.parties.findById(created.decision.partyId);
    expect(party?.attributes[PartyAttributeKey.DOCUMENT]?.state).toBe("declined");
  });

  it("maps an attribute the conversation does not ask for to 422", async () => {
    const intentId = await startIntentOver("register_payment");
    const res = await post(`/${intentId}/enrich`, {
      partyId: PARTY.ACME,
      key: "notes",
      value: "x",
    });

    expect(res.status).toBe(422);
    expect((await json(res)).error).toMatch(/not an attribute/i);
  });

  it("maps an unknown party to 422", async () => {
    const intentId = await startIntentOver("register_payment");
    const res = await post(`/${intentId}/enrich`, {
      partyId: "party-nao-existe",
      key: PartyAttributeKey.DOCUMENT,
      value: "1",
    });

    expect(res.status).toBe(422);
  });
});

describe("GET /parties/incomplete", () => {
  it("computes the backlog and reflects an enrichment immediately", async () => {
    const before = await json(await get("/parties/incomplete"));
    expect(before.length).toBe(6); // every fixture party starts with both gaps open
    expect(before[0].missing).toContain(PartyAttributeKey.DOCUMENT);

    const intentId = await startIntentOver("register_payment");
    await post(`/${intentId}/enrich`, {
      partyId: PARTY.ACME,
      key: PartyAttributeKey.DOCUMENT,
      value: "1",
    });
    await post(`/${intentId}/enrich`, { partyId: PARTY.ACME, key: PartyAttributeKey.TYPE, value: "client" });

    const after = await json(await get("/parties/incomplete"));
    expect(after.map((c: { partyId: string }) => c.partyId)).not.toContain(PARTY.ACME);
  });
});
