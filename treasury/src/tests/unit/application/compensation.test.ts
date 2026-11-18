import { describe, it, expect } from "vitest";
import type { LedgerEventRef, PositionLifecycle } from "../../../core/application/dtos/LedgerReadModels";
import type { Clock } from "../../../core/application/ports/Clock";
import type { CandidateSubmissionPort, SubmissionOutcome } from "../../../core/application/ports/CandidateSubmissionPort";
import type { IdGenerator } from "../../../core/application/ports/IdGenerator";
import { CandidateMapper, producibleTuples } from "../../../core/application/services/CandidateMapper";
import { ApplyAnswersUseCase } from "../../../core/application/use-cases/ApplyAnswers";
import { CompensationError, CompensationUseCase } from "../../../core/application/use-cases/Compensation";
import { settlingScenario } from "../../../core/application/use-cases/PayablesBatch";
import { StartIntentUseCase } from "../../../core/application/use-cases/StartIntent";
import { StartPositionActionUseCase } from "../../../core/application/use-cases/StartPositionAction";
import { SubmitIntentUseCase } from "../../../core/application/use-cases/SubmitIntent";
import { listScenarios } from "../../../core/domain/scenarios/Scenario";
import type { Candidate } from "../../../core/domain/value-objects/Candidate";
import { InMemoryAuditLog } from "../../../infra/audit/InMemoryAuditLog";
import { InMemoryIntentRepository } from "../../../infra/persistence/InMemoryIntentRepository";
import { PARTY, partyDirectory } from "../../fixtures/parties";

/**
 * §8.11 (REQ-693): the compensation of one pair, chosen on the party's page. The Ledger is a fake that
 * knows a few positions and records what is submitted; everything between — the conversation, the
 * candidate, the contexts — is the real thing. The arithmetic is the Ledger's, in
 * `ledger/src/tests/integration/business-flows/composite-operations-acceptance.test.ts`.
 */

const clock: Clock = { now: () => "2026-11-18T15:00:00.000Z" };
/** An identity linked to the broker (REQ-332): the same party for the compensation. */
const BROKER_LINKED = "prov-broker";

/** A position the Ledger knows, opened by an event naming the Usina and `party`, citing `contexts`. */
function position(
  objectId: string,
  objectType: string,
  open: string,
  party: string = PARTY.BROKER,
  contexts: { objectId: string; objectType: string }[] = [],
) {
  const eventId = `evt-${objectId}`;
  const lifecycle: PositionLifecycle = {
    objectId,
    objectType,
    status: "open",
    outcome: "pending",
    currency: "BRL",
    totalOriginated: open,
    totalSettled: "0.00",
    openBalance: open,
    eventCount: 1,
    events: [
      {
        eventId,
        eventType: objectType === "commission_payable" ? "obligation_recognized" : "advance_payment",
        economicEffect: objectType === "commission_payable" ? "non_cash" : "cash_out",
        relation: "originates",
        amount: open,
        currency: "BRL",
        occurredAt: "2026-10-01T03:00:00.000Z",
        recordedAt: "2026-10-01T03:00:00.000Z",
        description: null,
        relatedEventId: null,
        retracted: false,
      } as PositionLifecycle["events"][number],
    ],
    origin: {
      eventId,
      relatedObjects: contexts.map((c) => ({ ...c, relation: "references" })),
    } as unknown as PositionLifecycle["origin"],
  };
  const event: LedgerEventRef = {
    eventId,
    eventType: lifecycle.events[0].eventType,
    economicEffect: lifecycle.events[0].economicEffect,
    amount: open,
    currency: "BRL",
    occurredAt: "2026-10-01T03:00:00.000Z",
    description: null,
    relatedEventId: null,
    objects: [{ objectId, objectType, relation: "originates" }, ...contexts.map((c) => ({ ...c, relation: "references" }))],
    parties: [PARTY.USINA, party].map((partyId) => ({ partyId, role: "payee", direction: "neutral", amount: null })),
    source: { system: "treasury", reference: `intent:${objectId}` },
  };
  return { lifecycle, event };
}

function world(opts: { refuse?: boolean } = {}) {
  const book = new Map<string, ReturnType<typeof position>>();
  const add = (p: ReturnType<typeof position>) => book.set(p.lifecycle.objectId, p);
  add(position("adv-1", "advance", "500.00"));
  add(position("adv-linked", "advance", "500.00", BROKER_LINKED));
  add(position("loan-1", "loan", "1000.00"));
  add(position("cp-A", "commission_payable", "300.00", PARTY.BROKER, [{ objectId: "policy:A", objectType: "policy" }]));
  add(position("cp-B", "commission_payable", "400.00"));
  add(position("adv-other", "advance", "500.00", PARTY.OTHER));
  add(position("bill-1", "payable", "200.00", PARTY.ACME));

  const submitted: Candidate[] = [];
  const submission: CandidateSubmissionPort = {
    async submit(candidate): Promise<SubmissionOutcome> {
      submitted.push(candidate);
      if (opts.refuse) return { status: "rejected", reason: "Settlement exceeds the outstanding balance" };
      return { status: "accepted", ledgerReference: `evt-comp-${submitted.length}` };
    },
  };
  const lifecycle = { lifecycle: async (id: string) => book.get(id)?.lifecycle ?? null };
  const events = { event: async (id: string) => [...book.values()].find((p) => p.event.eventId === id)?.event ?? null };

  const directory = partyDirectory();
  const repo = new InMemoryIntentRepository();
  const audit = new InMemoryAuditLog();
  let n = 0;
  const ids: IdGenerator = { next: () => `i-${++n}` };
  const startIntent = new StartIntentUseCase(repo, clock, ids, audit);
  const applyAnswers = new ApplyAnswersUseCase(repo, clock, audit, directory);
  const submit = new SubmitIntentUseCase(repo, new CandidateMapper(PARTY.USINA), submission, audit, clock, directory);
  const useCase = new CompensationUseCase({
    lifecycle,
    events,
    directory: { identifiersOf: async (id) => (id === PARTY.BROKER ? [PARTY.BROKER, BROKER_LINKED] : [id]) },
    fromPosition: new StartPositionActionUseCase(lifecycle, events, startIntent, applyAnswers, PARTY.USINA),
    applyAnswers,
    submit,
    usinaPartyId: PARTY.USINA,
  });
  return { useCase, submitted, repo, book };
}

const pair = (over: Partial<Parameters<CompensationUseCase["execute"]>[0]> = {}) => ({
  partyId: PARTY.BROKER,
  receivableId: "adv-1",
  payableId: "cp-A",
  amount: "300.00",
  occurredAt: "2026-11-18",
  by: "cfo",
  ...over,
});

describe("REQ-693 — compensação de um par, pela página da parte", () => {
  it("CA-693: um evento, sem caixa, que quita o adiantamento e a obrigação pelo mesmo valor", async () => {
    const { useCase, submitted } = world();

    const result = await useCase.execute(pair({ description: "Acerto do adiantamento de outubro" }));

    expect(result).toMatchObject({ status: "accepted", ledgerReference: "evt-comp-1" });
    expect(submitted).toHaveLength(1);
    const [event] = submitted;
    expect(event).toMatchObject({ eventType: "compensation", economicEffect: "non_cash", amount: "300.00", currency: "BRL" });
    expect(event.reason.type).toBe("compensation");
    const settled = event.objects.filter((o) => o.relation === "settles").map((o) => [o.objectId, o.objectType]);
    expect(settled).toEqual(
      expect.arrayContaining([
        ["cp-A", "commission_payable"],
        ["adv-1", "advance"],
      ]),
    );
    expect(settled).toHaveLength(2);
    // No money moves: the party carries no amount, and no institution is cited (REQ-650).
    expect(event.parties).toEqual([expect.objectContaining({ partyId: PARTY.BROKER, direction: "neutral" })]);
    expect(event.parties[0]).not.toHaveProperty("amount");
    expect(event.objects.some((o) => o.objectType === "cash_account")).toBe(false);
  });

  it("REQ-275 / REQ-694: a compensação cita a apólice da obrigação, para o rastro do adiantamento", async () => {
    const { useCase, submitted } = world();

    await useCase.execute(pair());

    expect(submitted[0].objects).toContainEqual(expect.objectContaining({ objectId: "policy:A", relation: "references" }));
  });

  it("CA-693b: um valor acima do menor saldo do par é recusado antes do envio", async () => {
    const { useCase, submitted } = world();

    await expect(useCase.execute(pair({ amount: "350.00" }))).rejects.toThrow(/menor saldo em aberto do par \(300\.00\)/);
    await expect(useCase.execute(pair({ amount: "0.00" }))).rejects.toBeInstanceOf(CompensationError);
    expect(submitted).toHaveLength(0);
  });

  it("compensação parcial: deixa o resto aberto (o valor é do usuário, REQ-257)", async () => {
    const { useCase, submitted } = world();

    await useCase.execute(pair({ amount: "100.00" }));

    expect(submitted[0].amount).toBe("100.00");
  });

  it("empréstimo também compensa contra a obrigação de comissão (DEC-025)", async () => {
    const { useCase, submitted } = world();

    await useCase.execute(pair({ receivableId: "loan-1", payableId: "cp-B", amount: "400.00" }));

    expect(submitted[0].objects).toContainEqual(expect.objectContaining({ objectId: "loan-1", objectType: "loan", relation: "settles" }));
  });

  it("REJ-693: os dois lados do mesmo tipo, ou um tipo fora da compensação, são recusados", async () => {
    const { useCase, submitted } = world();

    await expect(useCase.execute(pair({ receivableId: "cp-B" }))).rejects.toThrow(/adiantamento ou empréstimo/);
    await expect(useCase.execute(pair({ payableId: "adv-1", receivableId: "loan-1" }))).rejects.toThrow(/obrigação de comissão/);
    await expect(useCase.execute(pair({ payableId: "bill-1" }))).rejects.toThrow(/obrigação de comissão/);
    expect(submitted).toHaveLength(0);
  });

  it("CA-252 / REJ-693: só entre posições da mesma parte; identidades ligadas contam como a mesma", async () => {
    const { useCase, submitted } = world();

    await expect(useCase.execute(pair({ receivableId: "adv-other" }))).rejects.toThrow(/mesma parte/);
    expect(submitted).toHaveLength(0);

    await useCase.execute(pair({ receivableId: "adv-linked" }));
    expect(submitted).toHaveLength(1);
  });

  it("uma posição já quitada, ou de saldo desconhecido, é recusada com o motivo certo", async () => {
    const { useCase, submitted, book } = world();
    book.get("cp-A")!.lifecycle.openBalance = "0.00";
    book.get("cp-B")!.lifecycle.openBalance = null;

    await expect(useCase.execute(pair())).rejects.toThrow(/cp-A já está quitada/);
    await expect(useCase.execute(pair({ payableId: "cp-B" }))).rejects.toThrow(/cp-B não tem saldo em aberto conhecido/);
    expect(submitted).toHaveLength(0);
  });

  it("uma posição que o Ledger não conhece é recusada, sem envio", async () => {
    const { useCase, submitted } = world();

    await expect(useCase.execute(pair({ receivableId: "adv-x" }))).rejects.toThrow(/não está no Ledger/);
    expect(submitted).toHaveLength(0);
  });

  it("a recusa do Ledger volta como recusa, com o motivo, e a intenção fica registrada", async () => {
    const { useCase, repo } = world({ refuse: true });

    const result = await useCase.execute(pair());

    expect(result.status).not.toBe("accepted");
    expect(result.reason).toMatch(/exceeds/);
    expect(await repo.findById(result.intentId)).not.toBeNull();
  });
});

describe("a compensação não aparece onde não cabe", () => {
  it("não é oferecida como ação de uma posição, nem na conversa (o par é escolhido na página da parte)", () => {
    expect(producibleTuples().some((t) => t.scenarioId === "register_compensation")).toBe(false);
    expect(listScenarios().some((s) => s.id === "register_compensation")).toBe(false);
  });

  it("não tira do lote o pagamento da obrigação de comissão", () => {
    expect(settlingScenario("commission_payable")).toBe("register_commission_payment");
  });
});
