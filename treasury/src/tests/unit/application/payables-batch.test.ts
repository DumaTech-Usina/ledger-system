import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { LedgerEventRef, PositionLifecycle } from "../../../core/application/dtos/LedgerReadModels";
import type { Clock } from "../../../core/application/ports/Clock";
import type { CandidateSubmissionPort, SubmissionOutcome } from "../../../core/application/ports/CandidateSubmissionPort";
import type { IdGenerator } from "../../../core/application/ports/IdGenerator";
import { CandidateMapper } from "../../../core/application/services/CandidateMapper";
import { PreparedBatchError, PreparedBatches } from "../../../core/application/services/PreparedBatches";
import { ApplyAnswersUseCase } from "../../../core/application/use-cases/ApplyAnswers";
import { PayablesBatchUseCase, settlingScenario } from "../../../core/application/use-cases/PayablesBatch";
import { StartIntentUseCase } from "../../../core/application/use-cases/StartIntent";
import { StartPositionActionUseCase } from "../../../core/application/use-cases/StartPositionAction";
import { SubmitIntentUseCase } from "../../../core/application/use-cases/SubmitIntent";
import type { Candidate } from "../../../core/domain/value-objects/Candidate";
import { InMemoryAuditLog } from "../../../infra/audit/InMemoryAuditLog";
import { InMemoryIntentRepository } from "../../../infra/persistence/InMemoryIntentRepository";
import { SqlitePreparedBatchStore } from "../../../infra/persistence/SqlitePreparedBatchStore";
import { PARTY, partyDirectory } from "../../fixtures/parties";

/**
 * §8.6 (E3): the day's payments in one batch, assembled on the agenda. The Ledger is a fake that knows
 * a few obligations and records what is submitted; everything between — the conversation, the
 * candidate, the contexts — is the real thing.
 */

const TODAY = "2026-11-13T15:00:00.000Z";
const clock: Clock = { now: () => TODAY };

/** An obligation the Ledger knows, opened by an event naming the Usina and its creditor. */
function obligation(objectId: string, objectType: string, open: string, creditors: string[] = [PARTY.ACME], currency = "BRL") {
  const lifecycle: PositionLifecycle = {
    objectId,
    objectType,
    status: "open",
    outcome: "pending",
    currency,
    totalOriginated: open,
    totalSettled: "0.00",
    openBalance: open,
    eventCount: 1,
    events: [
      {
        eventId: `evt-${objectId}`,
        eventType: "obligation_recognized",
        economicEffect: "non_cash",
        relation: "originates",
        amount: open,
        currency,
        occurredAt: "2026-11-01T03:00:00.000Z",
        recordedAt: "2026-11-01T03:00:00.000Z",
        description: null,
        relatedEventId: null,
        retracted: false,
      } as PositionLifecycle["events"][number],
    ],
    origin: null,
  };
  const event: LedgerEventRef = {
    eventId: `evt-${objectId}`,
    eventType: "obligation_recognized",
    economicEffect: "non_cash",
    amount: open,
    currency,
    occurredAt: "2026-11-01T03:00:00.000Z",
    description: null,
    relatedEventId: null,
    objects: [{ objectId, objectType, relation: "originates" }],
    parties: [PARTY.USINA, ...creditors].map((partyId) => ({ partyId, role: "payee", direction: "neutral", amount: null })),
    source: { system: "treasury", reference: `intent:${objectId}` },
  };
  return { lifecycle, event };
}

function world(opts: { refuse?: string[]; store?: SqlitePreparedBatchStore } = {}) {
  const book = new Map<string, ReturnType<typeof obligation>>();
  const add = (o: ReturnType<typeof obligation>) => book.set(o.lifecycle.objectId, o);
  add(obligation("cp-joao", "commission_payable", "300.00", [PARTY.BROKER]));
  add(obligation("bill-acme", "payable", "200.00", [PARTY.ACME]));
  add(obligation("tax-1", "tax", "120.00", [PARTY.AUTHORITY]));
  add(obligation("orphan", "payable", "50.00", []));
  add(obligation("shared", "payable", "50.00", [PARTY.ACME, PARTY.OTHER]));
  add(obligation("usd", "payable", "50.00", [PARTY.ACME], "USD"));

  const submitted: Candidate[] = [];
  const submission: CandidateSubmissionPort = {
    async submit(candidate): Promise<SubmissionOutcome> {
      submitted.push(candidate);
      const settles = candidate.objects.find((o) => o.relation === "settles")?.objectId ?? "";
      if (opts.refuse?.includes(settles)) return { status: "rejected", reason: "Settlement exceeds the outstanding balance" };
      return { status: "accepted", ledgerReference: `evt-paid-${submitted.length}` };
    },
  };
  const lifecycle = { lifecycle: async (id: string) => book.get(id)?.lifecycle ?? null };
  const events = { event: async (id: string) => [...book.values()].find((o) => o.event.eventId === id)?.event ?? null };

  const directory = partyDirectory();
  const repo = new InMemoryIntentRepository();
  const audit = new InMemoryAuditLog();
  let n = 0;
  const ids: IdGenerator = { next: () => `i-${++n}` };
  const startIntent = new StartIntentUseCase(repo, clock, ids, audit);
  const applyAnswers = new ApplyAnswersUseCase(repo, clock, audit, directory);
  const submit = new SubmitIntentUseCase(repo, new CandidateMapper(PARTY.USINA), submission, audit, clock, directory);
  const batches = new PreparedBatches(audit, clock, opts.store);
  const useCase = new PayablesBatchUseCase({
    batches,
    lifecycle,
    events,
    fromPosition: new StartPositionActionUseCase(lifecycle, events, startIntent, applyAnswers, PARTY.USINA),
    applyAnswers,
    submit,
    clock,
    usinaPartyId: PARTY.USINA,
    institutions: [
      { key: "itau", name: "Itaú" },
      { key: "bradesco", name: "Bradesco" },
    ],
    names: { displayNameOf: async (id) => (await directory.get(id))?.displayName ?? null },
  });
  return { useCase, submitted, audit, batches };
}

const paid = (batchId: string, over: Partial<{ debit: string; institution: string | null; occurredAt: string }> = {}) => ({
  batchId,
  occurredAt: "2026-11-13",
  institution: "itau" as string | null,
  debit: "500.00",
  by: "cfo",
  ...over,
});

describe("settlingScenario — derived from what Treasury produces, never a hand-kept list", () => {
  it("each kind the agenda shows has exactly one way to be paid", () => {
    expect(settlingScenario("commission_payable")).toBe("register_commission_payment");
    expect(settlingScenario("payable")).toBe("register_payment");
    expect(settlingScenario("tax")).toBe("register_tax");
    expect(settlingScenario("payroll")).toBe("register_payroll");
    expect(settlingScenario("service_fee")).toBe("register_service_fee");
    expect(settlingScenario("infrastructure_cost")).toBe("register_infrastructure");
    expect(settlingScenario("settlement_batch")).toBeNull();
  });
});

describe("REQ-651 — the batch is assembled on the agenda", () => {
  it("CA-651: two creditors in one batch, each line knowing who it pays", async () => {
    const { useCase } = world();
    const { batchId } = await useCase.prepare({ items: [{ objectId: "cp-joao", amount: "300.00" }, { objectId: "bill-acme", amount: "200.00" }], by: "cfo" });

    const { standing } = await useCase.list();
    expect(standing).toHaveLength(1);
    expect(standing[0].batchId).toBe(batchId);
    expect(standing[0].total).toBe("500.00");
    expect(standing[0].lines.map((l) => [l.objectId, l.payee?.partyId, l.objectType])).toEqual([
      ["cp-joao", PARTY.BROKER, "commission_payable"],
      ["bill-acme", PARTY.ACME, "payable"],
    ]);
  });

  it("CA-651b: never more than is open (Q-048, prevention)", async () => {
    const { useCase } = world();
    await expect(useCase.prepare({ items: [{ objectId: "tax-1", amount: "150.00" }], by: "cfo" })).rejects.toThrow("passa do que está em aberto");
  });

  it.each([
    ["an obligation with no known creditor", "orphan", "credor conhecido"],
    ["an obligation with more than one creditor", "shared", "mais de um credor"],
    ["an obligation in another currency", "usd", "USD"],
    ["something the Ledger does not know", "nope", "não está no Ledger"],
  ])("refuses %s: it is paid from its position", async (_label, objectId, message) => {
    const { useCase } = world();
    await expect(useCase.prepare({ items: [{ objectId, amount: "10.00" }], by: "cfo" })).rejects.toThrow(message);
  });

  it("REJ-239: an obligation already in a standing batch does not enter another", async () => {
    const { useCase } = world();
    await useCase.prepare({ items: [{ objectId: "tax-1", amount: "120.00" }], by: "cfo" });
    await expect(useCase.prepare({ items: [{ objectId: "tax-1", amount: "120.00" }], by: "cfo" })).rejects.toBeInstanceOf(PreparedBatchError);
  });

  it("REQ-652: preparing is audited, and sends nothing to the Ledger", async () => {
    const { useCase, submitted, audit } = world();
    const { batchId } = await useCase.prepare({ items: [{ objectId: "tax-1", amount: "120.00" }], by: "cfo" });
    expect(submitted).toHaveLength(0);
    expect((await audit.listByIntent(batchId)).map((e) => e.type)).toEqual(["prepared_batch_prepared"]);
  });
});

describe("REQ-653 — recording the payment", () => {
  async function prepared(w = world()) {
    const { batchId } = await w.useCase.prepare({
      items: [{ objectId: "cp-joao", amount: "300.00" }, { objectId: "bill-acme", amount: "200.00" }],
      by: "cfo",
    });
    return { ...w, batchId };
  }

  it("CA-653: one event per line, each settling its obligation, paying its creditor, citing the batch and the institution", async () => {
    const { useCase, submitted, batchId } = await prepared();
    const view = await useCase.pay(paid(batchId));

    expect(submitted).toHaveLength(2);
    for (const candidate of submitted) {
      expect(candidate.objects).toContainEqual({ objectId: `lote:${batchId}`, objectType: "settlement_batch", relation: "references" });
      expect(candidate.objects).toContainEqual({ objectId: "instituicao:itau", objectType: "cash_account", relation: "references" });
    }
    expect(submitted.map((c) => [c.objects.find((o) => o.relation === "settles")?.objectId, c.amount])).toEqual([
      ["cp-joao", "300.00"],
      ["bill-acme", "200.00"],
    ]);
    expect(submitted[0].parties.map((p) => p.partyId)).toContain(PARTY.BROKER);
    expect(submitted[1].parties.map((p) => p.partyId)).toContain(PARTY.ACME);
    expect(view.payment).toMatchObject({ state: "recorded", institution: "itau", debit: "500.00", recorded: "500.00", difference: "0.00" });
    expect(view.lines.map((l) => l.step?.status)).toEqual(["accepted", "accepted"]);
  });

  it("a paid batch is no longer standing, and shows among the recent ones", async () => {
    const { useCase, batchId } = await prepared();
    await useCase.pay(paid(batchId));
    const { standing, recent } = await useCase.list();
    expect(standing).toHaveLength(0);
    expect(recent.map((b) => b.batchId)).toEqual([batchId]);
  });

  it("CA-650b: institution \"not stated\" → the events cite none", async () => {
    const { useCase, submitted, batchId } = await prepared();
    await useCase.pay(paid(batchId, { institution: null }));
    expect(submitted.every((c) => !c.objects.some((o) => o.objectType === "cash_account"))).toBe(true);
  });

  it("the institution is never assumed: leaving it out is refused, and so is one not on the list", async () => {
    const { useCase, submitted, batchId } = await prepared();
    await expect(useCase.pay({ ...paid(batchId), institution: undefined as unknown as null })).rejects.toThrow("não informada");
    await expect(useCase.pay(paid(batchId, { institution: "santander" }))).rejects.toThrow("Instituição desconhecida");
    expect(submitted).toHaveLength(0);
  });

  it("CA-653b / REJ-653: a debit that does not match the batch sends nothing, and the batch stays standing", async () => {
    const { useCase, submitted, batchId } = await prepared();
    await expect(useCase.pay(paid(batchId, { debit: "510.00" }))).rejects.toThrow("não bate com a soma do lote");
    expect(submitted).toHaveLength(0);
    expect((await useCase.list()).standing.map((b) => b.batchId)).toEqual([batchId]);
  });

  it("a future date is refused before anything is sent", async () => {
    const { useCase, submitted, batchId } = await prepared();
    await expect(useCase.pay(paid(batchId, { occurredAt: "2026-11-20" }))).rejects.toThrow("Data do pagamento");
    expect(submitted).toHaveLength(0);
  });

  it("CA-653c / REQ-249: a refused line does not stop the others; the gap to the debit is exactly its amount", async () => {
    const w = world({ refuse: ["cp-joao"] });
    const { useCase, batchId } = await prepared(w);
    const view = await useCase.pay(paid(batchId));

    expect(w.submitted).toHaveLength(2);
    expect(view.lines.map((l) => l.step?.status)).toEqual(["rejected", "accepted"]);
    expect(view.lines[0].step?.reason).toContain("outstanding");
    expect(view.payment).toMatchObject({ recorded: "200.00", difference: "300.00" });
  });

  it("CA-654: a batch is paid once", async () => {
    const { useCase, submitted, batchId } = await prepared();
    await useCase.pay(paid(batchId));
    await expect(useCase.pay(paid(batchId))).rejects.toThrow("já");
    expect(submitted).toHaveLength(2);
  });

  it("CA-654: two payments of the same batch at once send it only once", async () => {
    const { useCase, submitted, batchId } = await prepared();
    const results = await Promise.allSettled([useCase.pay(paid(batchId)), useCase.pay(paid(batchId))]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(submitted).toHaveLength(2);
  });

  it("a paid batch is not discarded", async () => {
    const { useCase, batchId } = await prepared();
    await useCase.pay(paid(batchId));
    await expect(useCase.discard(batchId, "cfo")).rejects.toBeInstanceOf(PreparedBatchError);
  });
});

describe("REQ-652 — the prepared batch survives a restart (§17 R1)", () => {
  it("CA-652: prepared, the server restarts, and the batch is still standing with its lines; paid, it stays paid", async () => {
    const dir = mkdtempSync(join(tmpdir(), "batches-"));
    const file = join(dir, "treasury.db");
    try {
      const first = world({ store: new SqlitePreparedBatchStore(file) });
      const { batchId } = await first.useCase.prepare({ items: [{ objectId: "tax-1", amount: "120.00" }], by: "cfo" });

      const second = world({ store: new SqlitePreparedBatchStore(file) });
      const { standing } = await second.useCase.list();
      expect(standing.map((b) => [b.batchId, b.total, b.lines[0].payee?.partyId])).toEqual([[batchId, "120.00", PARTY.AUTHORITY]]);

      await second.useCase.pay(paid(batchId, { debit: "120.00" }));
      const third = world({ store: new SqlitePreparedBatchStore(file) });
      expect((await third.useCase.list()).standing).toHaveLength(0);
      await expect(third.useCase.pay(paid(batchId, { debit: "120.00" }))).rejects.toThrow("já");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
