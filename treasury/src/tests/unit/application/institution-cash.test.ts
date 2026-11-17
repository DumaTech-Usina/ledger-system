import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { InstitutionBalancesPage } from "../../../core/application/dtos/LedgerReadModels";
import type { Clock } from "../../../core/application/ports/Clock";
import type { CandidateSubmissionPort, SubmissionOutcome } from "../../../core/application/ports/CandidateSubmissionPort";
import type { IdGenerator } from "../../../core/application/ports/IdGenerator";
import { InMemoryBankStatementStore, type BankStatementStore } from "../../../core/application/services/BankStatements";
import { CandidateMapper, planReissue } from "../../../core/application/services/CandidateMapper";
import { ApplyAnswersUseCase } from "../../../core/application/use-cases/ApplyAnswers";
import { InstitutionCashError, InstitutionCashUseCase } from "../../../core/application/use-cases/InstitutionCash";
import { StartIntentUseCase } from "../../../core/application/use-cases/StartIntent";
import { SubmitIntentUseCase } from "../../../core/application/use-cases/SubmitIntent";
import { SubmitRectificationUseCase } from "../../../core/application/use-cases/SubmitRectification";
import type { LedgerEventRef } from "../../../core/application/dtos/LedgerReadModels";
import { getScenario, listScenarios } from "../../../core/domain/scenarios/Scenario";
import { DialogEngine } from "../../../core/domain/services/DialogEngine";
import { INSTITUTION_SLOT, NOT_STATED, configureInstitutions, institutionsFrom } from "../../../core/domain/services/Institutions";
import type { Candidate } from "../../../core/domain/value-objects/Candidate";
import { InMemoryAuditLog } from "../../../infra/audit/InMemoryAuditLog";
import { InMemoryIntentRepository } from "../../../infra/persistence/InMemoryIntentRepository";
import { SqliteBankStatementStore } from "../../../infra/persistence/SqliteBankStatementStore";
import { PARTY, partyDirectory } from "../../fixtures/parties";

/**
 * §8.8 (E6) on the Treasury side: the institution asked in every money conversation, the opening balance
 * and the transfer recorded through intents, and the bank check — a control, never a fact.
 */

const TODAY = "2026-12-05T15:00:00.000Z";
const clock: Clock = { now: () => TODAY };
const INSTITUTIONS = institutionsFrom("bradesco=Bradesco,itau=Itaú,corretora=Corretora de investimentos");

const empty = (asOf: string): InstitutionBalancesPage => ({
  asOf,
  institutions: [],
  known: { total: {}, institutions: [] },
  unknown: { since: null, cashIn: {}, cashOut: {}, count: 0 },
});

/** Itaú opened at 10,000.00 on 30/11 and paid 500.00 since; Bradesco has movement but no opening. */
const book = (asOf: string): InstitutionBalancesPage => ({
  asOf,
  institutions: [
    {
      institution: "instituicao:bradesco",
      opening: null,
      cashIn: {},
      cashOut: { BRL: "40.00" },
      transfersIn: {},
      transfersOut: {},
      balance: null,
    },
    {
      institution: "instituicao:itau",
      opening: { amount: "10000.00", currency: "BRL", day: "2026-11-30", eventId: "evt-open" },
      cashIn: {},
      cashOut: asOf >= "2026-12-01" ? { BRL: "500.00" } : {},
      transfersIn: {},
      transfersOut: {},
      balance: { BRL: asOf >= "2026-12-01" ? "9500.00" : "10000.00" },
    },
  ],
  known: { total: { BRL: asOf >= "2026-12-01" ? "9500.00" : "10000.00" }, institutions: ["instituicao:itau"] },
  unknown: { since: "2026-11-30", cashIn: { BRL: "250.00" }, cashOut: {}, count: 1 },
});

function world(opts: { ledger?: (asOf?: string) => Promise<InstitutionBalancesPage>; statements?: BankStatementStore } = {}) {
  const submitted: Candidate[] = [];
  const submission: CandidateSubmissionPort = {
    async submit(candidate): Promise<SubmissionOutcome> {
      submitted.push(candidate);
      return { status: "accepted", ledgerReference: `evt-${submitted.length}` };
    },
  };
  const directory = partyDirectory();
  const repo = new InMemoryIntentRepository();
  const audit = new InMemoryAuditLog();
  let n = 0;
  const ids: IdGenerator = { next: () => `i-${++n}` };
  const asked: (string | undefined)[] = [];
  const useCase = new InstitutionCashUseCase({
    ledger: {
      institutionBalances: async (asOf?: string) => {
        asked.push(asOf);
        return (opts.ledger ?? (async (d?: string) => book(d ?? "2026-12-05")))(asOf);
      },
    },
    statements: opts.statements ?? new InMemoryBankStatementStore(),
    audit,
    clock,
    ids,
    startIntent: new StartIntentUseCase(repo, clock, ids, audit),
    applyAnswers: new ApplyAnswersUseCase(repo, clock, audit, directory),
    submit: new SubmitIntentUseCase(repo, new CandidateMapper(PARTY.USINA), submission, audit, clock, directory),
    institutions: INSTITUTIONS,
    users: { findById: async (id) => (id === "cfo" ? { displayName: "Carla CFO" } : null) },
  });
  return { useCase, submitted, audit, asked };
}

describe("REQ-674 — a instituição em toda conversa que move dinheiro", () => {
  const cash = [
    "register_payment", "register_payroll", "register_infrastructure", "register_service_fee", "register_tax", "register_penalty",
    "register_incentive", "register_advance", "register_loan", "register_commission_received", "register_advance_settlement",
    "register_loan_repayment", "register_commission_payment",
  ];

  it("CA-674: every cash conversation asks it, with the configured institutions and an explicit 'não informada'", () => {
    for (const id of cash) {
      const slot = getScenario(id)!.slots.find((s) => s.key === "institution");
      expect(slot, id).toBeDefined();
      expect(slot!.required).toBe(true);
      expect(slot!.choices).toEqual(["bradesco", "itau", "corretora", NOT_STATED]);
      expect(slot!.choiceLabels).toMatchObject({ itau: "Itaú", [NOT_STATED]: "Não informada" });
    }
    // A fact that moves no money has no institution to ask about.
    for (const id of ["register_commission_accrual", "register_obligation_recognition", "register_waiver", "register_direct_payment"]) {
      expect(getScenario(id)!.slots.some((s) => s.key === "institution"), id).toBe(false);
    }
  });

  it("the conversation is not ready until it is answered — the system never fills it in", () => {
    const answers = { payee: PARTY.ACME, amount: "10.00", currency: "BRL", occurredAt: "2026-12-01" };
    expect(DialogEngine.nextState(getScenario("register_payment")!, answers)).toMatchObject({ kind: "question", slot: { key: "institution" } });
    expect(DialogEngine.nextState(getScenario("register_payment")!, { ...answers, institution: NOT_STATED }).kind).toBe("ready");
  });

  it("an institution is cited as a context; 'não informada' cites none", () => {
    const mapper = new CandidateMapper(PARTY.USINA);
    const intent = (institution: string) =>
      ({
        id: "x",
        scenarioId: "register_payment",
        userId: "cfo",
        answers: { payee: PARTY.ACME, amount: "10.00", currency: "BRL", occurredAt: "2026-12-01", institution },
        contexts: [],
      }) as never;
    const cited = mapper.build(intent("itau"), getScenario("register_payment")!).objects.filter((o) => o.objectType === "cash_account");
    expect(cited).toEqual([{ objectId: "instituicao:itau", objectType: "cash_account", relation: "references" }]);
    expect(mapper.build(intent(NOT_STATED), getScenario("register_payment")!).objects.some((o) => o.objectType === "cash_account")).toBe(false);
  });

  it("REQ-676: the list follows the configuration; a new institution is a new pair", () => {
    configureInstitutions(institutionsFrom("itau=Itaú,caixa=Caixa Econômica"));
    try {
      expect(INSTITUTION_SLOT.choices).toEqual(["itau", "caixa", NOT_STATED]);
      expect(INSTITUTION_SLOT.choiceLabels).toMatchObject({ caixa: "Caixa Econômica" });
    } finally {
      configureInstitutions(INSTITUTIONS);
    }
    expect(() => institutionsFrom("nao_informada=X")).toThrow();
    expect(() => institutionsFrom("itau=Itaú,itau=Outro")).toThrow(/twice/);
  });

  it("a correction reissues the money in the same institution, or in none stated", () => {
    const event = (objects: { objectId: string; objectType: string; relation: string }[]) => ({
      eventType: "payroll_payment",
      economicEffect: "cash_out",
      amount: "10.00",
      currency: "BRL",
      occurredAt: "2026-12-01T12:00:00.000Z",
      description: null,
      relatedEventId: null,
      objects: [{ objectId: "payroll:1", objectType: "payroll", relation: "settles" }, ...objects],
      parties: [{ partyId: PARTY.USINA, role: "payer", direction: "out", amount: "10.00" }, { partyId: PARTY.ACME, role: "payee", direction: "neutral", amount: null }],
    });
    const itau = planReissue(event([{ objectId: "instituicao:itau", objectType: "cash_account", relation: "references" }]), PARTY.USINA);
    expect(itau.reissuable && itau.answers).toContainEqual({ key: "institution", value: "itau" });
    expect(itau.reissuable && itau.contexts).toEqual([]);
    const none = planReissue(event([]), PARTY.USINA);
    expect(none.reissuable && none.answers).toContainEqual({ key: "institution", value: NOT_STATED });
  });

  it("the opening and the transfer are not offered in the conversation", () => {
    expect(listScenarios().map((s) => s.id)).not.toContain("register_opening_balance");
    expect(listScenarios().map((s) => s.id)).not.toContain("register_institution_transfer");
  });
});

describe("REQ-670 — saldo de abertura", () => {
  it("CA-670: records the statement as an opening of one institution, through an intent", async () => {
    const { useCase, submitted } = world({ ledger: async (d) => empty(d ?? "2026-12-05") });
    const outcome = await useCase.registerOpening({ institution: "itau", amount: "10000.00", occurredAt: "2026-11-30", by: "cfo" });
    expect(outcome).toMatchObject({ status: "accepted", ledgerReference: "evt-1" });
    expect(submitted[0]).toMatchObject({
      eventType: "opening_balance",
      economicEffect: "cash_in",
      amount: "10000.00",
      parties: [{ partyId: PARTY.USINA, role: "payee", direction: "in", amount: "10000.00" }],
      objects: [{ objectId: "instituicao:itau", objectType: "cash_account", relation: "references" }],
      reason: { type: "opening_balance" },
      reporter: { reporterType: "user", reporterId: "cfo" },
    });
  });

  it("CA-670b: an overdrawn account opens as cash out — the sign rides on the effect", async () => {
    const { useCase, submitted } = world({ ledger: async (d) => empty(d ?? "2026-12-05") });
    await useCase.registerOpening({ institution: "bradesco", amount: "-1200.00", occurredAt: "2026-11-30", by: "cfo" });
    expect(submitted[0]).toMatchObject({
      economicEffect: "cash_out",
      amount: "1200.00",
      parties: [{ partyId: PARTY.USINA, role: "payer", direction: "out", amount: "1200.00" }],
    });
  });

  it("CA-670c: a second opening while one stands is refused, pointing to rectification", async () => {
    const { useCase, submitted } = world();
    await expect(useCase.registerOpening({ institution: "itau", amount: "1.00", occurredAt: "2026-11-30", by: "cfo" })).rejects.toThrow(/já está registrada.*retifique/);
    expect(submitted).toEqual([]);
  });

  it("refuses zero, a future date, an unknown institution — and, with the Ledger down, does not guess", async () => {
    const { useCase } = world({ ledger: async (d) => empty(d ?? "2026-12-05") });
    await expect(useCase.registerOpening({ institution: "itau", amount: "0.00", occurredAt: "2026-11-30", by: "cfo" })).rejects.toThrow(InstitutionCashError);
    await expect(useCase.registerOpening({ institution: "itau", amount: "1.00", occurredAt: "2026-12-06", by: "cfo" })).rejects.toThrow(/Data/);
    await expect(useCase.registerOpening({ institution: "santander", amount: "1.00", occurredAt: "2026-11-30", by: "cfo" })).rejects.toThrow(/desconhecida/);
    const down = world({ ledger: async () => { throw new Error("down"); } });
    await expect(down.useCase.registerOpening({ institution: "itau", amount: "1.00", occurredAt: "2026-11-30", by: "cfo" })).rejects.toThrow(/Ledger não respondeu/);
  });
});

describe("REQ-672 — transferência", () => {
  it("CA-672: one fact, balanced, naming where the money left and where it arrived", async () => {
    const { useCase, submitted } = world();
    await useCase.registerTransfer({ from: "bradesco", to: "corretora", amount: "3000.00", occurredAt: "2026-12-02", by: "cfo" });
    expect(submitted[0]).toMatchObject({
      eventType: "institution_transfer",
      economicEffect: "cash_internal",
      parties: [
        { partyId: PARTY.USINA, role: "payer", direction: "out", amount: "3000.00" },
        { partyId: PARTY.USINA, role: "payee", direction: "in", amount: "3000.00" },
      ],
      objects: [
        { objectId: "instituicao:bradesco", objectType: "cash_account", relation: "transfers_from" },
        { objectId: "instituicao:corretora", objectType: "cash_account", relation: "transfers_to" },
      ],
    });
  });

  it("CA-672b: the same institution on both ends is refused before anything is sent", async () => {
    const { useCase, submitted } = world();
    await expect(useCase.registerTransfer({ from: "itau", to: "itau", amount: "1.00", occurredAt: "2026-12-02", by: "cfo" })).rejects.toThrow(/diferentes/);
    await expect(useCase.registerTransfer({ from: "itau", to: "bradesco", amount: "0", occurredAt: "2026-12-02", by: "cfo" })).rejects.toThrow(/maior que zero/);
    expect(submitted).toEqual([]);
  });
});

describe("REQ-673, REQ-675 — saldo por instituição e conferência", () => {
  it("CA-673: shows every configured institution; without an opening the balance is unknown, never zero", async () => {
    const result = await world().useCase.read();
    if (!result.available) throw new Error("unavailable");
    expect(result.institutions.map((i) => [i.key, i.name, i.balance])).toEqual([
      ["bradesco", "Bradesco", null],
      ["itau", "Itaú", "9500.00"],
      ["corretora", "Corretora de investimentos", null],
    ]);
    expect(result.institutions[0].cashOut).toBe("40.00");
    expect(result.known).toEqual({ total: "9500.00", institutions: ["Itaú"] });
    expect(result.unknown).toEqual({ since: "2026-11-30", cashIn: "250.00", cashOut: "0.00", count: 1 });
  });

  it("CA-675: the statement is compared with the book on the statement's own day", async () => {
    const { useCase, audit, asked } = world();
    await useCase.informStatement({ institution: "itau", day: "2026-12-03", amount: "9800.00", by: "cfo" });
    const result = await useCase.read();
    if (!result.available) throw new Error("unavailable");
    expect(asked).toContain("2026-12-03");
    expect(result.institutions.find((i) => i.key === "itau")!.statement).toMatchObject({
      day: "2026-12-03",
      amount: "9800.00",
      book: "9500.00",
      difference: "300.00",
      informedBy: "Carla CFO",
    });
    expect((await audit.listByIntent(`extrato:i-1`)).map((e) => e.type)).toEqual(["bank_statement_informed"]);
  });

  it("matches → no difference; overdrawn statements compare signed", async () => {
    const { useCase } = world();
    await useCase.informStatement({ institution: "itau", day: "2026-11-30", amount: "10000.00", by: "cfo" });
    let itau = (await useCase.read() as { institutions: { key: string; statement: unknown }[] }).institutions.find((i) => i.key === "itau")!;
    expect(itau.statement).toMatchObject({ book: "10000.00", difference: "0.00" });
    await useCase.informStatement({ institution: "itau", day: "2026-12-01", amount: "-100.00", by: "cfo" });
    itau = (await useCase.read() as { institutions: { key: string; statement: unknown }[] }).institutions.find((i) => i.key === "itau")!;
    expect(itau.statement).toMatchObject({ amount: "-100.00", book: "9500.00", difference: "-9600.00" });
  });

  it("REJ-673: without an opening there is nothing to compare — no invented difference", async () => {
    const { useCase } = world();
    await useCase.informStatement({ institution: "bradesco", day: "2026-12-03", amount: "500.00", by: "cfo" });
    const result = await useCase.read();
    if (!result.available) throw new Error("unavailable");
    expect(result.institutions.find((i) => i.key === "bradesco")!.statement).toMatchObject({ book: null, difference: null });
  });

  it("REJ-675: the statement goes to no Ledger; a future day or an unknown institution is refused", async () => {
    const { useCase, submitted } = world();
    await useCase.informStatement({ institution: "itau", day: "2026-12-05", amount: "1.00", by: "cfo" });
    expect(submitted).toEqual([]);
    await expect(useCase.informStatement({ institution: "itau", day: "2026-12-06", amount: "1.00", by: "cfo" })).rejects.toThrow(/futuro/);
    await expect(useCase.informStatement({ institution: "nubank", day: "2026-12-01", amount: "1.00", by: "cfo" })).rejects.toThrow(/desconhecida/);
  });

  it("CA-665-like: with the Ledger down, the balances are unavailable, never zero", async () => {
    expect(await world({ ledger: async () => { throw new Error("down"); } }).useCase.read()).toEqual({ available: false });
  });

  it("the statements survive a restart, and a newer one never rewrites an older one", async () => {
    const dir = mkdtempSync(join(tmpdir(), "statements-"));
    try {
      const file = join(dir, "ops.db");
      const first = world({ statements: new SqliteBankStatementStore(file) });
      await first.useCase.informStatement({ institution: "itau", day: "2026-12-01", amount: "9500.00", by: "cfo" });
      await first.useCase.informStatement({ institution: "itau", day: "2026-12-03", amount: "9800.00", by: "cfo" });
      const again = world({ statements: new SqliteBankStatementStore(file) });
      const history = await again.useCase.history("itau");
      expect(history.map((h) => [h.day, h.amount, h.difference])).toEqual([
        ["2026-12-03", "9800.00", "300.00"],
        ["2026-12-01", "9500.00", "0.00"],
      ]);
      const latest = await new SqliteBankStatementStore(file).latest();
      expect(latest.map((s) => s.day)).toEqual(["2026-12-03"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("REQ-670, REQ-672 — retificar uma abertura ou uma transferência", () => {
  const event = (over: Partial<LedgerEventRef>): LedgerEventRef => ({
    eventId: "evt-x",
    eventType: "opening_balance",
    economicEffect: "cash_out",
    amount: "1200.00",
    currency: "BRL",
    occurredAt: "2026-11-30T15:00:00.000Z",
    description: null,
    relatedEventId: null,
    objects: [{ objectId: "instituicao:corretora", objectType: "cash_account", relation: "references" }],
    parties: [{ partyId: PARTY.USINA, role: "payer", direction: "out", amount: "1200.00" }],
    source: { system: "treasury", reference: "intent:x" },
    ...over,
  });

  function rectifier(target: LedgerEventRef) {
    const submitted: Candidate[] = [];
    const directory = partyDirectory();
    const repo = new InMemoryIntentRepository();
    const audit = new InMemoryAuditLog();
    let n = 0;
    const ids: IdGenerator = { next: () => `r-${++n}` };
    const submission: CandidateSubmissionPort = {
      async submit(candidate): Promise<SubmissionOutcome> {
        submitted.push(candidate);
        return { status: "accepted", ledgerReference: `evt-${submitted.length}` };
      },
    };
    const rectify = new SubmitRectificationUseCase(
      { event: async (id: string) => (id === target.eventId ? target : null) },
      new StartIntentUseCase(repo, clock, ids, audit),
      new ApplyAnswersUseCase(repo, clock, audit, directory),
      new SubmitIntentUseCase(repo, new CandidateMapper(PARTY.USINA), submission, audit, clock, directory),
      clock,
      PARTY.USINA,
    );
    return { rectify, submitted };
  }

  it("an overdrawn opening typed wrong: withdrawn by naming the institution, reissued on the same side", async () => {
    const { rectify, submitted } = rectifier(event({}));
    const result = await rectify.execute({ targetEventId: "evt-x", userId: "cfo", corrected: { amount: "1500.00" } });
    expect(result).toMatchObject({ retraction: { intentStatus: "accepted" }, reissue: { intentStatus: "accepted" } });
    expect(submitted[0]).toMatchObject({
      eventType: "ledger_correction",
      relatedEventId: "evt-x",
      objects: [{ objectId: "instituicao:corretora", objectType: "cash_account", relation: "retracts" }],
    });
    expect(submitted[1]).toMatchObject({
      eventType: "opening_balance",
      economicEffect: "cash_out",
      amount: "1500.00",
      objects: [{ objectId: "instituicao:corretora", objectType: "cash_account", relation: "references" }],
    });
  });

  it("a transfer is withdrawn by naming both institutions, and reissued between the same two", async () => {
    const transfer = event({
      eventType: "institution_transfer",
      economicEffect: "cash_internal",
      amount: "3000.00",
      objects: [
        { objectId: "instituicao:bradesco", objectType: "cash_account", relation: "transfers_from" },
        { objectId: "instituicao:corretora", objectType: "cash_account", relation: "transfers_to" },
      ],
      parties: [
        { partyId: PARTY.USINA, role: "payer", direction: "out", amount: "3000.00" },
        { partyId: PARTY.USINA, role: "payee", direction: "in", amount: "3000.00" },
      ],
    });
    const { rectify, submitted } = rectifier(transfer);
    await rectify.execute({ targetEventId: "evt-x", userId: "cfo", corrected: { amount: "300.00" } });
    expect(submitted[0].objects).toEqual([
      { objectId: "instituicao:bradesco", objectType: "cash_account", relation: "retracts" },
      { objectId: "instituicao:corretora", objectType: "cash_account", relation: "retracts" },
    ]);
    expect(submitted[1]).toMatchObject({
      eventType: "institution_transfer",
      amount: "300.00",
      objects: [
        { objectId: "instituicao:bradesco", objectType: "cash_account", relation: "transfers_from" },
        { objectId: "instituicao:corretora", objectType: "cash_account", relation: "transfers_to" },
      ],
    });
  });
});

