import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryIntentRepository } from "../../infra/persistence/InMemoryIntentRepository";
import { InMemoryExternalSignalRepository } from "../../infra/persistence/InMemoryExternalSignalRepository";
import { InMemoryAuditLog } from "../../infra/audit/InMemoryAuditLog";
import { InMemoryConversationLog } from "../../infra/audit/InMemoryConversationLog";
import { CandidateMapper, planReissue } from "../../core/application/services/CandidateMapper";
import { StartIntentUseCase } from "../../core/application/use-cases/StartIntent";
import { ApplyAnswersUseCase } from "../../core/application/use-cases/ApplyAnswers";
import { SubmitIntentUseCase } from "../../core/application/use-cases/SubmitIntent";
import { RegisterExternalSignalUseCase } from "../../core/application/use-cases/RegisterExternalSignal";
import { ListExternalSignalsUseCase } from "../../core/application/use-cases/ListExternalSignals";
import { IntentStatus } from "../../core/domain/enums/IntentStatus";
import type { Candidate } from "../../core/domain/value-objects/Candidate";
import type { Clock } from "../../core/application/ports/Clock";
import type { IdGenerator } from "../../core/application/ports/IdGenerator";
import { PARTY, seededDirectory } from "../fixtures/parties";
import { PartyDirectory } from "../../core/application/services/PartyDirectory";
import { InMemoryPartyRepository } from "../../infra/persistence/InMemoryPartyRepository";
import { InMemoryIdentityLinkRepository } from "../../infra/persistence/InMemoryIdentityLinkRepository";
import { PartyIdentityState } from "../../core/domain/enums/PartyIdentityState";
import { GetPolicySituationUseCase } from "../../core/application/use-cases/GetPolicySituation";
import { PreviewIntentUseCase } from "../../core/application/use-cases/PreviewIntent";
import { PreviewNotices } from "../../core/application/services/PreviewNotices";
import { Intent } from "../../core/domain/entities/Intent";
import type { PositionLifecycle, PositionItem, PositionsPage } from "../../core/application/dtos/LedgerReadModels";
import type { LedgerReadPort } from "../../core/application/ports/LedgerReadPort";
import { positionsOnly } from "../../core/application/services/PositionsOnly";
import { algebra } from "../fixtures/algebra";
import { StartPositionActionUseCase } from "../../core/application/use-cases/StartPositionAction";
import { RegisterInsurerCreditUseCase } from "../../core/application/use-cases/RegisterInsurerCredit";
import { ListInsurerReceivablesUseCase } from "../../core/application/use-cases/ListInsurerReceivables";

/**
 * `docs/requisitos_refinados.md` §4.6 — the insurance system's signal, written before the code.
 *
 * Blocks A (REQ-260, REQ-261, REQ-265), B (REQ-267) and C (REQ-263, REQ-264, REQ-268, REQ-270,
 * REQ-271) are exercised for real. Blocks D and E stay as `it.todo` until their turn in §16.1.
 *
 * The example is the owner's: policy 5177202641312121285, Allianz, broker Halisson, net premium
 * 643,85, CT 20%, CR 60% → the usina's value 128,77, the broker's share 77,26, retained 51,51.
 */

const clock: Clock = { now: () => "2026-11-09T12:00:00.000Z" };
const POLICY = "5177202641312121285";

const ELIGIBILITY = {
  policyId: POLICY,
  policyNumber: POLICY,
  insurer: "Allianz",
  broker: "Halisson",
  netPremium: "643.85",
  ct: "20",
  cr: "60",
  usinaValue: "128.77",
  payout: "77.26",
  retained: "51.51",
  eligibleAt: "2026-10-21",
  signedBy: "Franklin",
};

const POLICY_REGISTERED = {
  policyId: POLICY,
  policyNumber: POLICY,
  insurer: "Allianz",
  broker: "Halisson",
  netPremium: "643.85",
  ct: "20",
  usinaValue: "128.77",
  registeredAt: "2026-10-01",
};

let intents: InMemoryIntentRepository;
let signals: InMemoryExternalSignalRepository;
let submitted: Candidate[];
let register: RegisterExternalSignalUseCase;
let list: ListExternalSignalsUseCase;
let applyAnswers: ApplyAnswersUseCase;
let submit: SubmitIntentUseCase;
let parties: InMemoryPartyRepository;
let links: InMemoryIdentityLinkRepository;

beforeEach(() => {
  intents = new InMemoryIntentRepository();
  signals = new InMemoryExternalSignalRepository();
  submitted = [];
  parties = seededDirectory().repo;
  links = new InMemoryIdentityLinkRepository();
  const directory = new PartyDirectory(parties, undefined, links);
  const log = new InMemoryConversationLog();
  let n = 0;
  const ids: IdGenerator = { next: () => `id-${++n}` };
  applyAnswers = new ApplyAnswersUseCase(intents, clock, log, directory);
  const startIntent = new StartIntentUseCase(intents, clock, ids, log);
  register = new RegisterExternalSignalUseCase(signals, intents, startIntent, applyAnswers, directory, parties, clock, ids);
  list = new ListExternalSignalsUseCase(signals, intents);
  submit = new SubmitIntentUseCase(
    intents,
    new CandidateMapper(PARTY.USINA),
    {
      submit: async (candidate: Candidate) => {
        submitted.push(candidate);
        return { status: "accepted", ledgerReference: `evt-${submitted.length}` };
      },
    },
    new InMemoryAuditLog(),
    clock,
    directory,
  );
});

describe("REQ-260 — o sinal externo é guardado e não vai ao Ledger", () => {
  it("CA-260: guarda o que veio, com a impressão digital, e não envia nada", async () => {
    const result = await register.execute({ kind: "eligibility", fields: ELIGIBILITY, userId: "cfo" });

    expect(result.signal).toMatchObject({
      system: "insurance",
      kind: "eligibility",
      recordId: POLICY,
      fields: ELIGIBILITY,
      receivedAt: clock.now(),
      recordedBy: "cfo",
    });
    expect(result.signal.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(submitted).toHaveLength(0);
    expect(await signals.list()).toHaveLength(1);
  });

  it("a mesma leitura tem a mesma impressão digital; outra leitura, outra", async () => {
    const a = await register.execute({ kind: "eligibility", fields: ELIGIBILITY, userId: "cfo" });
    const b = await register.execute({ kind: "eligibility", fields: { ...ELIGIBILITY }, userId: "gestora" });
    const c = await register.execute({ kind: "eligibility", fields: { ...ELIGIBILITY, cr: "65", payout: "83.70" }, userId: "cfo" });

    expect(b.signal.contentHash).toBe(a.signal.contentHash);
    expect(c.signal.contentHash).not.toBe(a.signal.contentHash);
  });

  it("um sinal incompleto ou mal escrito é recusado, e nada fica guardado", async () => {
    const { payout: _, ...withoutPayout } = ELIGIBILITY;

    await expect(register.execute({ kind: "eligibility", fields: withoutPayout, userId: "cfo" })).rejects.toThrow(/payout/);
    await expect(
      register.execute({ kind: "eligibility", fields: { ...ELIGIBILITY, payout: "77,26" }, userId: "cfo" }),
    ).rejects.toThrow(/payout/);
    await expect(
      register.execute({ kind: "eligibility", fields: { ...ELIGIBILITY, eligibleAt: "2026-12-01" }, userId: "cfo" }),
    ).rejects.toThrow();

    expect(await signals.list()).toHaveLength(0);
    expect(await intents.listByUser("cfo")).toHaveLength(0);
  });

  it("REJ-267: um campo que não é do controle financeiro, como o nome do cliente, é recusado", async () => {
    await expect(
      register.execute({
        kind: "eligibility",
        fields: { ...ELIGIBILITY, client: "JOSE WENDSON GOMES DE QUEIROZ COSTA" },
        userId: "cfo",
      }),
    ).rejects.toThrow(/client/);

    expect(await signals.list()).toHaveLength(0);
  });
});

describe("REQ-261 / REQ-262 — um fato proposto por acontecimento, só expectativas", () => {
  it("apólice registrada → comissão prevista proposta, pronta para envio", async () => {
    const { proposals } = await register.execute({ kind: "policy", fields: POLICY_REGISTERED, userId: "cfo" });

    expect(proposals).toHaveLength(1);
    const intent = (await intents.findById(proposals[0].intentId))!;
    expect(proposals[0]).toMatchObject({ fact: "commission_expected", sourceReference: `seguro:apolice:${POLICY}:prevista` });
    expect(intent.scenarioId).toBe("register_commission_accrual");
    expect(intent.answers).toMatchObject({ amount: "128.77", occurredAt: "2026-10-01" });
    expect(intent.status).toBe(IntentStatus.AWAITING_CONFIRMATION);
  });

  it("a data esperada vai junto quando o sinal a traz", async () => {
    const { proposals } = await register.execute({
      kind: "policy",
      fields: { ...POLICY_REGISTERED, expectedAt: "2026-12-15" },
      userId: "cfo",
    });

    expect((await intents.findById(proposals[0].intentId))!.answers.dueAt).toBe("2026-12-15");
  });

  it("elegibilidade → obrigação de comissão pelo repasse; o corretor ainda é perguntado (bloco B)", async () => {
    const { proposals } = await register.execute({ kind: "eligibility", fields: ELIGIBILITY, userId: "cfo" });

    expect(proposals.map((p) => p.fact)).toEqual(["commission_obligation", "commission_expected"]);
    expect(proposals[0]).toMatchObject({ fact: "commission_obligation", sourceReference: `seguro:apolice:${POLICY}:elegibilidade` });
    const intent = (await intents.findById(proposals[0].intentId))!;
    expect(intent.scenarioId).toBe("register_obligation_recognition");
    expect(intent.answers).toMatchObject({ kind: "commission", amount: "77.26", occurredAt: "2026-10-21" });
    expect(intent.answers.payee ?? "").toBe("");
    expect(intent.status).toBe(IntentStatus.GATHERING);
  });

  it("REJ-262: nenhum sinal propõe recebimento ou pagamento", async () => {
    const a = await register.execute({ kind: "policy", fields: POLICY_REGISTERED, userId: "cfo" });
    const b = await register.execute({ kind: "eligibility", fields: ELIGIBILITY, userId: "cfo" });

    const scenarios = await Promise.all(
      [...a.proposals, ...b.proposals].map(async (p) => (await intents.findById(p.intentId))!.scenarioId),
    );
    expect([...new Set(scenarios)].sort()).toEqual(["register_commission_accrual", "register_obligation_recognition"]);
  });

  it("CA-261 / CA-261b: confirmar um fato não confirma o outro; o autor é o usuário, com confiança média", async () => {
    const prevista = await register.execute({ kind: "policy", fields: POLICY_REGISTERED, userId: "cfo" });
    const elegivel = await register.execute({ kind: "eligibility", fields: ELIGIBILITY, userId: "cfo" });
    const obligationId = elegivel.proposals[0].intentId;

    await applyAnswers.execute({ intentId: obligationId, answers: [{ key: "payee", value: PARTY.BROKER }] });
    const result = await submit.execute(obligationId, "cfo");

    expect(result.intentStatus).toBe(IntentStatus.ACCEPTED);
    expect(submitted).toHaveLength(1);
    expect(submitted[0]).toMatchObject({
      sourceReference: `seguro:apolice:${POLICY}:elegibilidade`,
      eventType: "obligation_recognized",
      economicEffect: "non_cash",
      amount: "77.26",
      reason: { confidence: "medium" },
      reporter: { reporterType: "user", reporterId: "cfo" },
    });
    expect(submitted[0].objects[0]).toMatchObject({ objectType: "commission_payable", relation: "originates" });
    expect((await intents.findById(prevista.proposals[0].intentId))!.status).toBe(IntentStatus.AWAITING_CONFIRMATION);
  });

  it("o que o usuário registra fora do sinal continua com confiança alta e referência própria", async () => {
    const { intentId } = await new StartIntentUseCase(intents, clock, { next: () => "manual" }, new InMemoryConversationLog())
      .execute({ scenarioId: "register_commission_accrual", userId: "cfo" });
    await applyAnswers.execute({
      intentId,
      answers: [
        { key: "amount", value: "10.00" },
        { key: "occurredAt", value: "2026-11-01" },
      ],
    });
    await submit.execute(intentId, "cfo");

    expect(submitted[0]).toMatchObject({ sourceReference: "intent:manual", reason: { confidence: "high" } });
  });
});

describe("REQ-272 / REQ-273 — a elegibilidade também propõe a comissão esperada da seguradora", () => {
  const expectedOf = (r: { proposals: { fact: string; intentId: string; sourceReference: string; reused: boolean }[] }) =>
    r.proposals.find((p) => p.fact === "commission_expected")!;

  it("propõe a comissão prevista pelo valor da Usina, citando a apólice", async () => {
    const result = await register.execute({ kind: "eligibility", fields: ELIGIBILITY, userId: "cfo" });

    const proposal = expectedOf(result);
    expect(proposal.sourceReference).toBe(`seguro:apolice:${POLICY}:prevista`);
    const intent = (await intents.findById(proposal.intentId))!;
    expect(intent.scenarioId).toBe("register_commission_accrual");
    expect(intent.answers.amount).toBe("128.77");
  });

  it("REQ-272: a data da apólice, quando vista, é quando a expectativa surgiu", async () => {
    const result = await register.execute({ kind: "eligibility", fields: { ...ELIGIBILITY, policyDate: "2026-09-15" }, userId: "cfo" });

    expect((await intents.findById(expectedOf(result).intentId))!.answers.occurredAt).toBe("2026-09-15");
  });

  it("REJ-272: sem a data da apólice, a data é perguntada; nunca vira a data da elegibilidade", async () => {
    const result = await register.execute({ kind: "eligibility", fields: ELIGIBILITY, userId: "cfo" });

    const intent = (await intents.findById(expectedOf(result).intentId))!;
    expect(intent.answers.occurredAt ?? "").toBe("");
    expect(intent.status).toBe(IntentStatus.GATHERING);
  });

  it("a comissão prevista já proposta pela apólice não é proposta de novo", async () => {
    const first = await register.execute({ kind: "policy", fields: POLICY_REGISTERED, userId: "cfo" });
    const eligibility = await register.execute({ kind: "eligibility", fields: ELIGIBILITY, userId: "cfo" });

    expect(expectedOf(eligibility)).toMatchObject({ intentId: first.proposals[0].intentId, reused: true });
  });

  it("REQ-273: seguradora com o id cadastrado → é quem vai pagar a comissão prevista", async () => {
    const operator = (await parties.findById(PARTY.OPERATOR))!;
    await parties.save({ ...operator, externalIds: [{ system: "seguro:seguradora", value: "ins-1" }] });

    const result = await register.execute({
      kind: "eligibility",
      fields: { ...ELIGIBILITY, insurerId: "ins-1", policyDate: "2026-09-15" },
      userId: "cfo",
    });
    const proposal = expectedOf(result) as { intentId: string; party?: unknown };
    expect(proposal.party).toEqual({ outcome: "linked", partyId: PARTY.OPERATOR });

    await submit.execute(proposal.intentId, "cfo");
    expect(submitted[0].parties).toEqual([
      { partyId: PARTY.USINA, role: "beneficiary", direction: "neutral" },
      { partyId: PARTY.OPERATOR, role: "payer", direction: "neutral" },
    ]);
  });

  it("REQ-273: seguradora desconhecida → identidade provisória com o nome visto", async () => {
    const result = await register.execute({ kind: "eligibility", fields: { ...ELIGIBILITY, insurerId: "ins-9" }, userId: "cfo" });

    const party = (expectedOf(result) as { party?: { outcome: string; partyId?: string } }).party!;
    expect(party.outcome).toBe("provisional");
    expect(await parties.findById(party.partyId!)).toMatchObject({
      displayName: "Allianz",
      externalIds: [{ system: "seguro:seguradora", value: "ins-9" }],
    });
  });

  it("REJ-273: seguradora e corretor com o mesmo número são cadastros diferentes; um nunca vira o outro", async () => {
    const result = await register.execute({
      kind: "eligibility",
      fields: { ...ELIGIBILITY, insurerId: "123", brokerId: "123", policyDate: "2026-10-29" },
      userId: "cfo",
    });

    const outcome = (fact: string) =>
      (result.proposals.find((p) => p.fact === fact) as { party?: { outcome: string; partyId?: string } }).party!;
    const broker = outcome("commission_obligation");
    const insurer = outcome("commission_expected");
    expect(broker.outcome).toBe("provisional");
    expect(insurer.outcome).toBe("provisional");
    expect(insurer.partyId).not.toBe(broker.partyId);
    expect((await parties.findById(broker.partyId!))!.displayName).toBe("Halisson");
    expect((await parties.findById(insurer.partyId!))!.displayName).toBe("Allianz");
  });

  it("sem o id da seguradora, a comissão prevista segue sem quem paga, como antes", async () => {
    const result = await register.execute({ kind: "policy", fields: { ...POLICY_REGISTERED }, userId: "cfo" });

    expect((result.proposals[0] as { party?: unknown }).party).toEqual({ outcome: "not_informed" });
    await submit.execute(result.proposals[0].intentId, "cfo");
    expect(submitted[0].parties).toEqual([{ partyId: PARTY.USINA, role: "beneficiary", direction: "neutral" }]);
  });

  it("REQ-274: a comissão prevista registrada à mão aceita quem vai pagar, opcional", async () => {
    const { intentId } = await new StartIntentUseCase(intents, clock, { next: () => "manual" }, new InMemoryConversationLog())
      .execute({ scenarioId: "register_commission_accrual", userId: "cfo" });
    await applyAnswers.execute({
      intentId,
      answers: [
        { key: "amount", value: "10.00" },
        { key: "occurredAt", value: "2026-11-01" },
        { key: "payer", value: PARTY.OPERATOR },
      ],
    });
    await submit.execute(intentId, "cfo");

    expect(submitted[0].parties.map((p) => [p.partyId, p.role])).toEqual([
      [PARTY.USINA, "beneficiary"],
      [PARTY.OPERATOR, "payer"],
    ]);
  });

  it("REQ-274: registrar o recebimento a partir da comissão prevista já traz a seguradora como quem pagou", async () => {
    const PREVISTA = `seguro:apolice:${POLICY}:prevista`;
    const lifecycle = {
      lifecycle: async () => ({
        objectId: PREVISTA,
        objectType: "commission_receivable",
        status: "open",
        outcome: "pending",
        currency: "BRL",
        totalOriginated: "128.77",
        totalSettled: "0.00",
        openBalance: "128.77",
        eventCount: 1,
        events: [{ eventId: "evt-prevista", relation: "originates", retracted: false } as never],
        origin: null,
      }),
    };
    const events = {
      event: async () => ({
        parties: [
          { partyId: PARTY.USINA, role: "beneficiary", direction: "neutral", amount: null },
          { partyId: PARTY.OPERATOR, role: "payer", direction: "neutral", amount: null },
        ],
      }) as never,
    };
    const startIntent = new StartIntentUseCase(intents, clock, { next: () => "receipt" }, new InMemoryConversationLog());
    const result = await new StartPositionActionUseCase(lifecycle, events, startIntent, applyAnswers, PARTY.USINA).execute({
      objectId: PREVISTA,
      scenarioId: "register_commission_received",
      userId: "cfo",
    });

    expect(result.prefilled).toContain("payer");
    expect((await intents.findById(result.intentId))!.answers.payer).toBe(PARTY.OPERATOR);
  });
});

describe("REQ-265 — referência da origem e duplicidade", () => {
  it("CA-265: o mesmo sinal de novo não cria outra proposta; aponta para a que já existe", async () => {
    const first = await register.execute({ kind: "eligibility", fields: ELIGIBILITY, userId: "cfo" });
    const again = await register.execute({ kind: "eligibility", fields: ELIGIBILITY, userId: "gestora" });

    expect(again.proposals[0]).toMatchObject({ intentId: first.proposals[0].intentId, reused: true });
    expect(first.proposals[0].reused).toBe(false);
    expect(await signals.list()).toHaveLength(2);
  });

  it("depois de confirmado, uma nova leitura avisa que o fato já foi registrado", async () => {
    const first = await register.execute({ kind: "eligibility", fields: ELIGIBILITY, userId: "cfo" });
    const intentId = first.proposals[0].intentId;
    await applyAnswers.execute({ intentId, answers: [{ key: "payee", value: PARTY.BROKER }] });
    await submit.execute(intentId, "cfo");

    const again = await register.execute({ kind: "eligibility", fields: ELIGIBILITY, userId: "cfo" });

    expect(again.proposals[0]).toMatchObject({ intentId, reused: true, intentStatus: IntentStatus.ACCEPTED });
  });

  it("uma proposta recusada pelo Ledger não impede propor de novo", async () => {
    const first = await register.execute({ kind: "eligibility", fields: ELIGIBILITY, userId: "cfo" });
    const intentId = first.proposals[0].intentId;
    const stored = (await intents.findById(intentId))!;
    stored.markRejected("Duplicate source reference", clock.now());
    await intents.save(stored);

    const again = await register.execute({ kind: "eligibility", fields: ELIGIBILITY, userId: "cfo" });

    expect(again.proposals[0].reused).toBe(false);
    expect(again.proposals[0].intentId).not.toBe(intentId);
  });

  it("apólices diferentes não colidem", async () => {
    const a = await register.execute({ kind: "eligibility", fields: ELIGIBILITY, userId: "cfo" });
    const b = await register.execute({ kind: "eligibility", fields: { ...ELIGIBILITY, policyId: "999", policyNumber: "999" }, userId: "cfo" });

    expect(b.proposals[0].reused).toBe(false);
    expect(b.proposals[0].sourceReference).not.toBe(a.proposals[0].sourceReference);
  });
});

describe("Leitura dos sinais", () => {
  it("lista os sinais, o mais recente primeiro, com a situação atual de cada proposta", async () => {
    await register.execute({ kind: "policy", fields: POLICY_REGISTERED, userId: "cfo" });
    const elegivel = await register.execute({ kind: "eligibility", fields: ELIGIBILITY, userId: "cfo" });
    const intentId = elegivel.proposals[0].intentId;
    await applyAnswers.execute({ intentId, answers: [{ key: "payee", value: PARTY.BROKER }] });
    await submit.execute(intentId, "cfo");

    const all = await list.execute();

    expect(all.map((s) => s.kind)).toEqual(["eligibility", "policy"]);
    expect(all[0].proposals[0]).toMatchObject({ intentStatus: IntentStatus.ACCEPTED, ledgerReference: "evt-1" });
    expect(all[1].proposals[0]).toMatchObject({ intentStatus: IntentStatus.AWAITING_CONFIRMATION });
  });
});

describe("REQ-267 — partes e apólice (bloco B)", () => {
  const partyIdOf = (party: unknown): string | undefined =>
    party && typeof party === "object" && "partyId" in party ? (party as { partyId: string }).partyId : undefined;
  const CONTEXT = { objectId: `seguro:apolice:${POLICY}`, objectType: "contract", relation: "references" };

  async function giveBrokerExternalId(partyId: string, value: string) {
    const party = (await parties.findById(partyId))!;
    await parties.save({ ...party, externalIds: [...party.externalIds, { system: "seguro:corretor", value }] });
  }

  async function submitted0(kind: "policy" | "eligibility", fields: Record<string, string>) {
    const { proposals } = await register.execute({ kind, fields, userId: "cfo" });
    const intentId = proposals[0].intentId;
    if (kind === "eligibility" && !(await intents.findById(intentId))!.answers.payee) {
      await applyAnswers.execute({ intentId, answers: [{ key: "payee", value: PARTY.BROKER }] });
    }
    await submit.execute(intentId, "cfo");
    return submitted[submitted.length - 1];
  }

  it("CA-262: a obrigação cita a apólice como contexto contract, sem mover saldo", async () => {
    const candidate = await submitted0("eligibility", ELIGIBILITY);

    expect(candidate.objects).toEqual([
      { objectId: `seguro:apolice:${POLICY}:elegibilidade`, objectType: "commission_payable", relation: "originates" },
      CONTEXT,
    ]);
  });

  it("a comissão prevista cita a mesma apólice", async () => {
    const candidate = await submitted0("policy", POLICY_REGISTERED);

    expect(candidate.objects).toContainEqual(CONTEXT);
  });

  it("o que não veio de um sinal continua sem contexto", async () => {
    const { intentId } = await new StartIntentUseCase(intents, clock, { next: () => "manual" }, new InMemoryConversationLog())
      .execute({ scenarioId: "register_commission_accrual", userId: "cfo" });
    await applyAnswers.execute({ intentId, answers: [{ key: "amount", value: "10.00" }, { key: "occurredAt", value: "2026-11-01" }] });
    await submit.execute(intentId, "cfo");

    expect(submitted[0].objects.some((o) => o.relation === "references")).toBe(false);
  });

  it("CA-267: corretor com o id externo cadastrado → ligado, e a obrigação fica pronta para envio", async () => {
    await giveBrokerExternalId(PARTY.BROKER, "broker-77");

    const { proposals } = await register.execute({ kind: "eligibility", fields: { ...ELIGIBILITY, brokerId: "broker-77" }, userId: "cfo" });

    expect(proposals[0].party).toEqual({ outcome: "linked", partyId: PARTY.BROKER });
    const intent = (await intents.findById(proposals[0].intentId))!;
    expect(intent.answers.payee).toBe(PARTY.BROKER);
    expect(intent.status).toBe(IntentStatus.AWAITING_CONFIRMATION);
  });

  it("CA-267: id externo desconhecido → identidade provisória com o nome visto e o id externo", async () => {
    const { proposals } = await register.execute({ kind: "eligibility", fields: { ...ELIGIBILITY, brokerId: "broker-77" }, userId: "cfo" });

    const partyId = partyIdOf(proposals[0].party);
    expect(proposals[0].party?.outcome).toBe("provisional");
    expect(await parties.findById(partyId!)).toMatchObject({
      identityState: PartyIdentityState.PROVISIONAL,
      displayName: "Halisson",
      externalIds: [{ system: "seguro:corretor", value: "broker-77" }],
      createdBy: "cfo",
    });
    expect((await intents.findById(proposals[0].intentId))!.answers.payee).toBe(partyId);
  });

  it("o mesmo corretor desconhecido em outra apólice reaproveita a mesma provisória", async () => {
    const a = await register.execute({ kind: "eligibility", fields: { ...ELIGIBILITY, brokerId: "broker-77" }, userId: "cfo" });
    const b = await register.execute({
      kind: "eligibility",
      fields: { ...ELIGIBILITY, policyId: "999", policyNumber: "999", brokerId: "broker-77" },
      userId: "cfo",
    });

    expect(b.proposals[0].party).toEqual({ outcome: "linked", partyId: partyIdOf(a.proposals[0].party) });
    expect((await parties.findAll()).filter((p) => p.identityState === PartyIdentityState.PROVISIONAL)).toHaveLength(1);
  });

  it("depois que o curador liga a provisória, o próximo sinal já chega na parte cadastrada", async () => {
    const a = await register.execute({ kind: "eligibility", fields: { ...ELIGIBILITY, brokerId: "broker-77" }, userId: "cfo" });
    await links.append({
      id: "link-1",
      fromIdentifier: partyIdOf(a.proposals[0].party)!,
      toPartyId: PARTY.BROKER,
      linkedBy: "curator",
      linkedAt: clock.now(),
    });

    const b = await register.execute({
      kind: "eligibility",
      fields: { ...ELIGIBILITY, policyId: "999", policyNumber: "999", brokerId: "broker-77" },
      userId: "cfo",
    });

    expect(b.proposals[0].party).toEqual({ outcome: "linked", partyId: PARTY.BROKER });
    expect((await intents.findById(b.proposals[0].intentId))!.answers.payee).toBe(PARTY.BROKER);
  });

  it("REJ-267: um cadastrado com o mesmo nome, sem o id externo, não é ligado pelo nome", async () => {
    const broker = (await parties.findById(PARTY.BROKER))!;
    await parties.save({ ...broker, displayName: "Halisson" });

    const { proposals } = await register.execute({ kind: "eligibility", fields: { ...ELIGIBILITY, brokerId: "broker-77" }, userId: "cfo" });

    expect(proposals[0].party?.outcome).toBe("provisional");
    expect(partyIdOf(proposals[0].party)).not.toBe(PARTY.BROKER);
  });

  it("dois cadastrados com o mesmo id externo → dúvida: nada é escolhido e o corretor é perguntado", async () => {
    await giveBrokerExternalId(PARTY.BROKER, "broker-77");
    await giveBrokerExternalId(PARTY.OTHER, "broker-77");
    const before = (await parties.findAll()).length;

    const { proposals } = await register.execute({ kind: "eligibility", fields: { ...ELIGIBILITY, brokerId: "broker-77" }, userId: "cfo" });

    expect(proposals[0].party).toEqual({ outcome: "ambiguous", candidates: [PARTY.BROKER, PARTY.OTHER] });
    expect((await intents.findById(proposals[0].intentId))!.answers.payee ?? "").toBe("");
    expect((await parties.findAll()).length).toBe(before);
  });

  it("sem o id externo do corretor, ele é perguntado na conversa", async () => {
    const { proposals } = await register.execute({ kind: "eligibility", fields: ELIGIBILITY, userId: "cfo" });

    expect(proposals[0].party).toEqual({ outcome: "not_informed" });
  });

  it("um sinal recusado não deixa provisória para trás", async () => {
    await expect(
      register.execute({ kind: "eligibility", fields: { ...ELIGIBILITY, brokerId: "broker-77", payout: "abc" }, userId: "cfo" }),
    ).rejects.toThrow();

    expect((await parties.findAll()).some((p) => p.identityState === PartyIdentityState.PROVISIONAL)).toBe(false);
  });
});

describe("Bloco C — avisos e ligações recomendadas", () => {
  const PREVISTA = `seguro:apolice:${POLICY}:prevista`;
  const ELEGIBILIDADE = `seguro:apolice:${POLICY}:elegibilidade`;

  /** What the Ledger publishes for a position, reduced to what these rules read. */
  function position(
    objectId: string,
    objectType: string,
    originated: string,
    settled: string,
    opts: { dueAt?: string | null; payee?: string } = {},
  ): PositionLifecycle {
    const open = (Number(originated) - Number(settled)).toFixed(2);
    return {
      objectId,
      objectType,
      status: Number(settled) === 0 ? "open" : Number(open) === 0 ? "fully_settled" : "partially_settled",
      outcome: "pending",
      currency: "BRL",
      totalOriginated: originated,
      totalSettled: settled,
      openBalance: open,
      eventCount: 1,
      events: [
        {
          eventId: `evt-${objectId}`,
          eventType: objectType === "commission_receivable" ? "commission_expected" : "obligation_recognized",
          economicEffect: "non_cash",
          relation: "originates",
          amount: originated,
          currency: "BRL",
          occurredAt: "2026-10-21T03:00:00.000Z",
          recordedAt: "2026-11-09T12:00:00.000Z",
          description: null,
          relatedEventId: null,
          retracted: false,
          requiresFollowup: false,
          objects: [],
          source: null,
          parties: [],
          dueAt: opts.dueAt ?? null,
        },
      ],
      origin: opts.payee
        ? {
            eventId: `evt-${objectId}`,
            eventType: "obligation_recognized",
            occurredAt: "2026-10-21T03:00:00.000Z",
            source: { system: "treasury", reference: objectId },
            relatedObjects: [],
            parties: [
              { partyId: PARTY.USINA, role: "payer", direction: "neutral", amount: null },
              { partyId: opts.payee, role: "payee", direction: "neutral", amount: null },
            ],
          }
        : null,
    } as PositionLifecycle;
  }

  let book: Map<string, PositionLifecycle>;
  let open: PositionItem[];
  const lifecyclePort = { lifecycle: async (id: string) => book.get(id) ?? null };
  // The Ledger's listing, as the composition root hands it over: contexts already left out (DEC-035).
  const positionsPort = positionsOnly(
    {
      positions: async (params?: { partyId?: string | string[]; objectType?: string | string[] }): Promise<PositionsPage> => {
        const wanted = [params?.partyId ?? []].flat();
        const types = [params?.objectType ?? []].flat();
        const data = open.filter(
          (p) =>
            (wanted.length === 0 || (p.parties ?? []).some((id) => wanted.includes(id))) &&
            (types.length === 0 || types.includes(p.objectType)),
        );
        return { data, total: data.length, page: 1, limit: 50, totalPages: 1 };
      },
    } as unknown as LedgerReadPort,
    algebra().positionalObjectTypes(),
  );
  const advance = (openBalance: string): PositionItem => ({
    objectId: "adv-halisson",
    objectType: "advance",
    status: "open",
    outcome: "pending",
    currency: "BRL",
    totalOriginated: openBalance,
    openBalance,
    eventCount: 1,
    lastEventAt: null,
    originatedAt: "2026-09-01T03:00:00.000Z",
    createdAt: "2026-09-01T03:00:00.000Z",
    dueAt: null,
    parties: [PARTY.USINA, PARTY.BROKER],
  });

  const situation = () => new GetPolicySituationUseCase(lifecyclePort, signals).execute(POLICY);
  const codes = async () => (await situation()).notices.map((n) => n.code);

  function preview(scenarioId: string, answers: Record<string, string>) {
    const intent = Intent.rehydrate({
      id: "p-1",
      scenarioId,
      userId: "cfo",
      status: IntentStatus.AWAITING_CONFIRMATION,
      answers: { currency: "BRL", occurredAt: "2026-11-09", ...answers },
      createdAt: clock.now(),
      updatedAt: clock.now(),
    });
    void intents.save(intent);
    return new PreviewIntentUseCase(
      intents,
      new CandidateMapper(PARTY.USINA),
      seededDirectory().directory,
      new PreviewNotices(lifecyclePort, positionsPort),
    ).execute("p-1");
  }

  beforeEach(() => {
    book = new Map();
    open = [];
  });

  it("CA-263: elegibilidade sem recebimento → a seguradora diz que pagou, e o recebimento não foi visto", async () => {
    await register.execute({ kind: "eligibility", fields: ELIGIBILITY, userId: "cfo" });
    book.set(PREVISTA, position(PREVISTA, "commission_receivable", "128.77", "0.00", { dueAt: "2026-12-15T03:00:00.000Z" }));

    expect((await situation()).notices).toContainEqual({ code: "insurer_says_paid", claimed: "128.77", received: "0.00" });

    book.set(PREVISTA, position(PREVISTA, "commission_receivable", "128.77", "128.77", { dueAt: "2026-12-15T03:00:00.000Z" }));
    expect(await codes()).not.toContain("insurer_says_paid");
  });

  it("elegibilidade sem comissão prevista registrada → o recebimento não pode ser conferido", async () => {
    await register.execute({ kind: "eligibility", fields: ELIGIBILITY, userId: "cfo" });

    const s = await situation();
    expect(s.expected).toBeNull();
    expect(s.notices).toContainEqual({ code: "expected_not_recorded", claimed: "128.77" });
  });

  it("CA-264: o retido é a diferença entre os dois fatos, dita como diferença", async () => {
    book.set(PREVISTA, position(PREVISTA, "commission_receivable", "128.77", "0.00"));
    book.set(ELEGIBILIDADE, position(ELEGIBILIDADE, "commission_payable", "77.26", "0.00", { payee: PARTY.BROKER }));

    const s = await situation();
    expect(s.retained).toBe("51.51");
    expect(s.obligation).toMatchObject({ owed: "77.26", paid: "0.00", open: "77.26", payee: PARTY.BROKER });
  });

  it("REJ-264: com um dos dois fatos ausente, o retido é desconhecido, nunca zero nem o valor inteiro", async () => {
    book.set(ELEGIBILIDADE, position(ELEGIBILIDADE, "commission_payable", "77.26", "0.00", { payee: PARTY.BROKER }));

    expect((await situation()).retained).toBeNull();
  });

  it("CA-268b: a apólice oferece registrar o recebimento e pagar o repasse nas posições certas", async () => {
    book.set(PREVISTA, position(PREVISTA, "commission_receivable", "128.77", "0.00"));
    book.set(ELEGIBILIDADE, position(ELEGIBILIDADE, "commission_payable", "77.26", "0.00", { payee: PARTY.BROKER }));

    expect((await situation()).actions).toEqual([
      { kind: "receive", objectId: PREVISTA, scenarioId: "register_commission_received" },
      { kind: "pay", objectId: ELEGIBILIDADE, scenarioId: "register_commission_payment" },
    ]);

    book.set(PREVISTA, position(PREVISTA, "commission_receivable", "128.77", "128.77"));
    book.set(ELEGIBILIDADE, position(ELEGIBILIDADE, "commission_payable", "77.26", "77.26", { payee: PARTY.BROKER }));
    expect((await situation()).actions).toEqual([]);
  });

  it("CA-268: pagar o repasse sem recebimento registrado na apólice → aviso na prévia", async () => {
    book.set(PREVISTA, position(PREVISTA, "commission_receivable", "128.77", "0.00"));

    const result = await preview("register_commission_payment", { payee: PARTY.BROKER, amount: "77.26", objectRef: ELEGIBILIDADE });
    expect(result.notices).toContainEqual({ code: "payout_before_receipt", policyId: POLICY });

    book.set(PREVISTA, position(PREVISTA, "commission_receivable", "128.77", "128.77"));
    const after = await preview("register_commission_payment", { payee: PARTY.BROKER, amount: "77.26", objectRef: ELEGIBILIDADE });
    expect(after.notices.map((n) => n.code)).not.toContain("payout_before_receipt");
  });

  it("depois de pago sem recebimento, a apólice continua mostrando a incongruência", async () => {
    book.set(PREVISTA, position(PREVISTA, "commission_receivable", "128.77", "0.00"));
    book.set(ELEGIBILIDADE, position(ELEGIBILIDADE, "commission_payable", "77.26", "77.26", { payee: PARTY.BROKER }));

    expect((await situation()).notices).toContainEqual({ code: "payout_without_receipt", paid: "77.26" });
  });

  it("CA-270: a prévia da obrigação mostra o adiantamento aberto com o corretor, sem descontar nada", async () => {
    open = [advance("50.00")];

    const result = await preview("register_obligation_recognition", { kind: "commission", payee: PARTY.BROKER, amount: "77.26" });

    expect(result.candidate.amount).toBe("77.26");
    expect(result.notices).toContainEqual({
      code: "open_with_party",
      partyId: PARTY.BROKER,
      positions: [{ objectId: "adv-halisson", objectType: "advance", openBalance: "50.00" }],
    });
  });

  it("CA-270: no pagamento, a própria obrigação que está sendo paga não aparece como outra posição aberta", async () => {
    open = [
      advance("50.00"),
      { ...advance("77.26"), objectId: ELEGIBILIDADE, objectType: "commission_payable" },
      // The Ledger lists the policy itself beside positions; it moves no balance and is not "open".
      { ...advance("0.00"), objectId: `seguro:apolice:${POLICY}`, objectType: "contract" },
    ];

    const result = await preview("register_commission_payment", { payee: PARTY.BROKER, amount: "77.26", objectRef: ELEGIBILIDADE });
    const notice = result.notices.find((n) => n.code === "open_with_party");
    expect(notice && "positions" in notice ? notice.positions.map((p) => p.objectId) : []).toEqual(["adv-halisson"]);
  });

  it("nada aberto com a pessoa → nenhum aviso; outras operações não leem nada", async () => {
    expect((await preview("register_obligation_recognition", { kind: "commission", payee: PARTY.BROKER, amount: "77.26" })).notices).toEqual([]);
    expect((await preview("register_payroll", { payee: PARTY.ACME, amount: "10.00" })).notices).toEqual([]);
  });

  it("CA-271: comissão prevista sem data esperada → alerta de pendência; com data, nenhum", async () => {
    book.set(PREVISTA, position(PREVISTA, "commission_receivable", "128.77", "0.00"));
    expect(await codes()).toContain("expected_without_due_date");

    book.set(PREVISTA, position(PREVISTA, "commission_receivable", "128.77", "0.00", { dueAt: "2026-12-15T03:00:00.000Z" }));
    expect(await codes()).not.toContain("expected_without_due_date");
    expect((await situation()).expected?.dueAt).toBe("2026-12-15T03:00:00.000Z");
  });

  it("Ledger fora do ar → a prévia continua e diz que os avisos são desconhecidos", async () => {
    const down = { lifecycle: async () => { throw new Error("down"); } };
    await intents.save(
      Intent.rehydrate({
        id: "p-2",
        scenarioId: "register_commission_payment",
        userId: "cfo",
        status: IntentStatus.AWAITING_CONFIRMATION,
        answers: { currency: "BRL", occurredAt: "2026-11-09", payee: PARTY.BROKER, amount: "77.26", objectRef: ELEGIBILIDADE },
        createdAt: clock.now(),
        updatedAt: clock.now(),
      }),
    );

    const result = await new PreviewIntentUseCase(
      intents,
      new CandidateMapper(PARTY.USINA),
      seededDirectory().directory,
      new PreviewNotices(down, positionsPort),
    ).execute("p-2");

    expect(result.candidate.amount).toBe("77.26");
    expect(result.notices).toEqual([{ code: "notices_unavailable" }]);
  });

  it("apólice sem nada registrado → tudo desconhecido, sem avisos inventados", async () => {
    const s = await situation();
    expect(s).toMatchObject({ expected: null, obligation: null, retained: null, notices: [], actions: [] });
  });
});

describe("REQ-275 / REQ-276 — a apólice como fio da história", () => {
  const CONTEXT = { objectId: `seguro:apolice:${POLICY}`, objectType: "contract" };
  const PREVISTA = `seguro:apolice:${POLICY}:prevista`;

  /** A position whose standing origination cited `related` beside it. */
  function lifecycleWith(objectId: string, objectType: string, related: { objectId: string; objectType: string; relation: string }[]) {
    return {
      lifecycle: async () => ({
        objectId,
        objectType,
        status: "open",
        outcome: "pending",
        currency: "BRL",
        totalOriginated: "128.77",
        totalSettled: "0.00",
        openBalance: "128.77",
        eventCount: 1,
        events: [{ eventId: "evt-open", relation: "originates", retracted: false } as never],
        origin: {
          eventId: "evt-open",
          eventType: "commission_expected",
          occurredAt: "2026-10-29T03:00:00.000Z",
          source: null,
          relatedObjects: related,
          parties: [],
        },
      }),
    };
  }
  const noCounterparty = { event: async () => null };

  async function receiptFrom(related: { objectId: string; objectType: string; relation: string }[]) {
    const startIntent = new StartIntentUseCase(intents, clock, { next: () => "receipt" }, new InMemoryConversationLog());
    const { intentId } = await new StartPositionActionUseCase(
      lifecycleWith(PREVISTA, "commission_receivable", related),
      noCounterparty,
      startIntent,
      applyAnswers,
      PARTY.USINA,
    ).execute({ objectId: PREVISTA, scenarioId: "register_commission_received", userId: "cfo" });
    await applyAnswers.execute({
      intentId,
      answers: [
        { key: "payer", value: PARTY.OPERATOR },
        { key: "amount", value: "128.77" },
        { key: "occurredAt", value: "2026-11-08" },
      ],
    });
    await submit.execute(intentId, "cfo");
    return submitted[submitted.length - 1];
  }

  it("CA-275: o recebimento lançado a partir da comissão prevista também cita a apólice", async () => {
    const candidate = await receiptFrom([{ ...CONTEXT, relation: "references" }]);

    expect(candidate.objects).toEqual([
      { objectId: PREVISTA, objectType: "commission_receivable", relation: "settles" },
      { ...CONTEXT, relation: "references" },
    ]);
  });

  it("herda todos os contextos, e nenhuma outra posição", async () => {
    const candidate = await receiptFrom([
      { ...CONTEXT, relation: "references" },
      { objectId: "proposta-9", objectType: "proposal", relation: "references" },
      { objectId: "outra-posicao", objectType: "commission_entitlement", relation: "originates" },
    ]);

    expect(candidate.objects.filter((o) => o.relation === "references").map((o) => o.objectId)).toEqual([
      CONTEXT.objectId,
      "proposta-9",
    ]);
    expect(candidate.objects.some((o) => o.objectId === "outra-posicao")).toBe(false);
  });

  it("REQ-275: a reemissão de uma retificação cita os mesmos contextos do lançamento corrigido", () => {
    const plan = planReissue(
      {
        eventType: "commission_expected",
        economicEffect: "non_cash",
        amount: "128.77",
        currency: "BRL",
        occurredAt: "2026-09-15T03:00:00.000Z",
        description: null,
        relatedEventId: null,
        objects: [
          { objectId: PREVISTA, objectType: "commission_receivable", relation: "originates" },
          { ...CONTEXT, relation: "references" },
        ],
        parties: [{ partyId: PARTY.USINA, role: "beneficiary", direction: "neutral", amount: null }],
      },
      PARTY.USINA,
    );

    expect(plan.reissuable && plan.contexts).toEqual([CONTEXT]);
  });

  it("posição aberta sem contexto → a operação segue sem contexto, como antes", async () => {
    const candidate = await receiptFrom([]);

    expect(candidate.objects).toEqual([{ objectId: PREVISTA, objectType: "commission_receivable", relation: "settles" }]);
  });

  it("CA-276: a história da apólice conta o fluxo Allianz → Usina → Halisson, em ordem", async () => {
    await register.execute({ kind: "eligibility", fields: { ...ELIGIBILITY, eligibleAt: "2026-10-21" }, userId: "cfo" });
    const event = (
      eventId: string,
      eventType: string,
      economicEffect: string,
      amount: string,
      occurredAt: string,
      parties: { partyId: string; role: string }[],
      retracted = false,
    ) => ({
      eventId,
      eventType,
      economicEffect,
      relation: "references",
      amount,
      currency: "BRL",
      occurredAt,
      recordedAt: occurredAt,
      description: null,
      relatedEventId: null,
      retracted,
      requiresFollowup: false,
      objects: [],
      source: null,
      parties: parties.map((p) => ({ ...p, direction: "neutral", amount: null })),
    });
    const usina = { partyId: PARTY.USINA, role: "beneficiary" };
    const book = new Map<string, PositionLifecycle>([
      [
        CONTEXT.objectId,
        {
          objectId: CONTEXT.objectId,
          objectType: "contract",
          status: "open",
          outcome: "pending",
          currency: "BRL",
          totalOriginated: "0.00",
          totalSettled: "0.00",
          openBalance: "0.00",
          eventCount: 4,
          origin: null,
          events: [
            event("e3", "commission_received", "cash_in", "128.77", "2026-11-10T03:00:00.000Z", [usina, { partyId: PARTY.OPERATOR, role: "payer" }]),
            event("e1", "commission_expected", "non_cash", "128.77", "2026-09-15T03:00:00.000Z", [usina, { partyId: PARTY.OPERATOR, role: "payer" }]),
            event("e2", "obligation_recognized", "non_cash", "77.26", "2026-10-21T03:00:00.000Z", [{ partyId: PARTY.USINA, role: "payer" }, { partyId: PARTY.BROKER, role: "payee" }]),
            event("e4", "commission_split", "cash_out", "77.26", "2026-11-11T03:00:00.000Z", [{ partyId: PARTY.USINA, role: "payer" }, { partyId: PARTY.BROKER, role: "payee" }]),
            event("e5", "commission_split", "cash_out", "10.00", "2026-11-12T03:00:00.000Z", [{ partyId: PARTY.USINA, role: "payer" }, { partyId: PARTY.BROKER, role: "payee" }], true),
          ],
        } as PositionLifecycle,
      ],
    ]);

    const situation = await new GetPolicySituationUseCase(
      { lifecycle: async (id: string) => book.get(id) ?? null },
      signals,
      PARTY.USINA,
      seededDirectory().directory,
    ).execute(POLICY);

    expect(situation.history.map((h) => [h.kind, h.at.slice(0, 10)])).toEqual([
      ["expected", "2026-09-15"],
      ["obligation", "2026-10-21"],
      ["signal", "2026-11-09"],
      ["received", "2026-11-10"],
      ["paid", "2026-11-11"],
      ["paid", "2026-11-12"],
    ]);
    expect(situation.history[0]).toMatchObject({ amount: "128.77", from: PARTY.OPERATOR, to: PARTY.USINA, retracted: false });
    expect(situation.history[1]).toMatchObject({ amount: "77.26", from: PARTY.USINA, to: PARTY.BROKER });
    expect(situation.history[2]).toMatchObject({ signalKind: "eligibility", recordedBy: "cfo" });
    expect(situation.history[3]).toMatchObject({ from: PARTY.OPERATOR, to: PARTY.USINA });
    expect(situation.history[4]).toMatchObject({ from: PARTY.USINA, to: PARTY.BROKER, retracted: false });
    expect(situation.history[5]).toMatchObject({ retracted: true });
    expect(situation.partyNames).toMatchObject({ [PARTY.OPERATOR]: "Operadora A", [PARTY.BROKER]: "Corretor Parceiro" });
  });

  it("apólice que o Ledger não conhece → história só com os sinais, sem fatos inventados", async () => {
    await register.execute({ kind: "eligibility", fields: ELIGIBILITY, userId: "cfo" });

    const situation = await new GetPolicySituationUseCase({ lifecycle: async () => null }, signals).execute(POLICY);
    expect(situation.history.map((h) => h.kind)).toEqual(["signal"]);
  });
});

describe("Bloco D — crédito da seguradora em lote (REQ-269, REQ-277)", () => {
  const policyOf = (id: string) => `seguro:apolice:${id}`;
  const prevista = (id: string) => `${policyOf(id)}:prevista`;

  /** Open expected commissions the Allianz (PARTY.OPERATOR here) owes, as the Ledger would publish. */
  let open: Record<string, { originated: string; settled: string }>;
  const lifecycle = {
    lifecycle: async (objectId: string) => {
      const p = open[objectId];
      if (!p) return null;
      const balance = (Number(p.originated) - Number(p.settled)).toFixed(2);
      return {
        objectId,
        objectType: "commission_receivable",
        status: "open",
        outcome: "pending",
        currency: "BRL",
        totalOriginated: p.originated,
        totalSettled: p.settled,
        openBalance: balance,
        eventCount: 1,
        events: [{ eventId: `evt-${objectId}`, relation: "originates", retracted: false } as never],
        origin: {
          eventId: `evt-${objectId}`,
          eventType: "commission_expected",
          occurredAt: "2026-10-01T03:00:00.000Z",
          source: null,
          relatedObjects: [{ objectId: objectId.replace(/:prevista$/, ""), objectType: "contract", relation: "references" }],
          parties: [],
        },
      } as PositionLifecycle;
    },
  };
  const events = {
    event: async () =>
      ({
        parties: [
          { partyId: PARTY.USINA, role: "beneficiary", direction: "neutral", amount: null },
          { partyId: PARTY.OPERATOR, role: "payer", direction: "neutral", amount: null },
        ],
      }) as never,
  };

  let refuse: Set<string>;
  let sent: Candidate[];
  let credit: RegisterInsurerCreditUseCase;

  beforeEach(() => {
    open = {
      [prevista("5177")]: { originated: "128.77", settled: "0.00" },
      [prevista("8812")]: { originated: "2000.00", settled: "0.00" },
      [prevista("9034")]: { originated: "2171.23", settled: "0.00" },
    };
    refuse = new Set();
    sent = [];
    const directory = seededDirectory().directory;
    const log = new InMemoryConversationLog();
    let n = 0;
    const ids: IdGenerator = { next: () => `c-${++n}` };
    const startIntent = new StartIntentUseCase(intents, clock, ids, log);
    const apply = new ApplyAnswersUseCase(intents, clock, log, directory);
    const submitter = new SubmitIntentUseCase(
      intents,
      new CandidateMapper(PARTY.USINA),
      {
        submit: async (candidate: Candidate) => {
          sent.push(candidate);
          return refuse.has(candidate.amount)
            ? { status: "rejected", reason: "Refused", rejections: [{ code: "INTERNAL", category: "internal", message: "x" }] }
            : { status: "accepted", ledgerReference: `evt-${sent.length}` };
        },
      } as never,
      new InMemoryAuditLog(),
      clock,
      directory,
    );
    credit = new RegisterInsurerCreditUseCase(
      lifecycle,
      new StartPositionActionUseCase(lifecycle, events, startIntent, apply, PARTY.USINA),
      startIntent,
      apply,
      submitter,
      clock,
      ids,
    );
  });

  const allianz = (allocations: { objectId: string; amount: string }[], creditAmount = "3400.00") =>
    credit.execute({ payer: PARTY.OPERATOR, creditAmount, occurredAt: "2026-11-09", allocations, userId: "cfo" });

  it("CA-269: um recebimento por apólice, cada um citando a sua apólice e o mesmo lote", async () => {
    const result = await allianz([
      { objectId: prevista("5177"), amount: "128.77" },
      { objectId: prevista("8812"), amount: "1000.00" },
      { objectId: prevista("9034"), amount: "2171.23" },
    ], "3300.00");

    expect(result.batchId).toMatch(/^lote:/);
    expect(result.unattributed).toBe("0.00");
    expect(result.steps.map((s) => s.status)).toEqual(["accepted", "accepted", "accepted"]);
    expect(sent.map((c) => c.amount)).toEqual(["128.77", "1000.00", "2171.23"]);
    for (const [i, id] of ["5177", "8812", "9034"].entries()) {
      expect(sent[i]).toMatchObject({ eventType: "commission_received", relatedEventId: `evt-${prevista(id)}` });
      expect(sent[i].objects).toEqual([
        { objectId: prevista(id), objectType: "commission_receivable", relation: "settles" },
        { objectId: policyOf(id), objectType: "contract", relation: "references" },
        { objectId: result.batchId, objectType: "settlement_batch", relation: "references" },
      ]);
      expect(sent[i].parties).toContainEqual(expect.objectContaining({ partyId: PARTY.OPERATOR, role: "payer" }));
      expect(sent[i].reason.confidence).toBe("high");
    }
  });

  it("REQ-277: o que sobra do crédito vira um recebimento sem origem citando o lote", async () => {
    const result = await allianz([
      { objectId: prevista("5177"), amount: "128.77" },
      { objectId: prevista("8812"), amount: "1000.00" },
      { objectId: prevista("9034"), amount: "2171.23" },
    ]);

    expect(result.unattributed).toBe("100.00");
    const last = sent[sent.length - 1];
    expect(last).toMatchObject({ amount: "100.00", eventType: "commission_received", reason: { type: "unknown_origin", requiresFollowup: true } });
    expect(last.relatedEventId).toBeUndefined();
    expect(last.objects.filter((o) => o.relation === "references")).toEqual([
      { objectId: result.batchId, objectType: "settlement_batch", relation: "references" },
    ]);
    expect(result.steps[3]).toMatchObject({ objectId: null, amount: "100.00", status: "accepted" });
  });

  it("CA-269b: recebimento parcial — só o distribuído sai da comissão prevista", async () => {
    await allianz([{ objectId: prevista("8812"), amount: "1000.00" }], "1000.00");

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ amount: "1000.00" });
  });

  it("REJ-277: distribuir mais do que o crédito é recusado, e nada é enviado", async () => {
    await expect(allianz([{ objectId: prevista("8812"), amount: "2000.00" }], "1500.00")).rejects.toThrow(/crédito/);
    expect(sent).toHaveLength(0);
  });

  it("REJ-277b: distribuir mais do que o aberto numa comissão prevista é recusado, e nada é enviado", async () => {
    await expect(allianz([{ objectId: prevista("5177"), amount: "200.00" }])).rejects.toThrow(/aberto/);
    expect(sent).toHaveLength(0);
  });

  it("a mesma comissão prevista duas vezes, ou uma posição que não é comissão a receber, é recusada", async () => {
    await expect(
      allianz([
        { objectId: prevista("5177"), amount: "50.00" },
        { objectId: prevista("5177"), amount: "50.00" },
      ]),
    ).rejects.toThrow();
    await expect(allianz([{ objectId: "desconhecida", amount: "50.00" }])).rejects.toThrow();
    expect(sent).toHaveLength(0);
  });

  it("REQ-255: um recebimento recusado para o resto; o que foi aceito continua e o que faltou aparece", async () => {
    refuse.add("1000.00");

    const result = await allianz([
      { objectId: prevista("5177"), amount: "128.77" },
      { objectId: prevista("8812"), amount: "1000.00" },
      { objectId: prevista("9034"), amount: "2171.23" },
    ]);

    expect(result.steps.map((s) => s.status)).toEqual(["accepted", "rejected", "not_sent", "not_sent"]);
    expect(sent.map((c) => c.amount)).toEqual(["128.77", "1000.00"]);
  });

  it("uma data futura é recusada antes de enviar qualquer coisa", async () => {
    await expect(
      credit.execute({ payer: PARTY.OPERATOR, creditAmount: "100.00", occurredAt: "2026-12-01", allocations: [], userId: "cfo" }),
    ).rejects.toThrow();
    expect(sent).toHaveLength(0);
  });

  it("lista as comissões previstas abertas da seguradora, com a apólice de cada uma", async () => {
    const page = (data: PositionItem[]): PositionsPage => ({ data, total: data.length, page: 1, limit: 200, totalPages: 1 });
    let asked: Record<string, unknown> = {};
    const item = (objectId: string, open: string): PositionItem => ({
      objectId,
      objectType: "commission_receivable",
      status: "open",
      outcome: "pending",
      currency: "BRL",
      totalOriginated: open,
      openBalance: open,
      eventCount: 1,
      lastEventAt: null,
      originatedAt: "2026-10-01T03:00:00.000Z",
      createdAt: "2026-10-01T03:00:00.000Z",
      dueAt: null,
      parties: [PARTY.USINA, PARTY.OPERATOR],
    });
    const list = new ListInsurerReceivablesUseCase({
      positions: async (params) => {
        asked = { ...params };
        return page([item(prevista("5177"), "128.77"), item("intent:manual", "50.00")]);
      },
    });

    const result = await list.execute(PARTY.OPERATOR);

    expect(asked).toMatchObject({ partyId: PARTY.OPERATOR, objectType: "commission_receivable" });
    expect(result).toEqual([
      { objectId: prevista("5177"), policyId: "5177", openBalance: "128.77", dueAt: null },
      { objectId: "intent:manual", policyId: null, openBalance: "50.00", dueAt: null },
    ]);
  });
});

describe("Blocos seguintes de §4.6 (ordem em §16.1)", () => {
  it.todo("CA-266: nova leitura com valores diferentes mostra a diferença sem enviar nada (bloco E, adiado)");
});
