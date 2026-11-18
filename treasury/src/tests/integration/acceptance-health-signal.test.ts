import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryIntentRepository } from "../../infra/persistence/InMemoryIntentRepository";
import { InMemoryExternalSignalRepository } from "../../infra/persistence/InMemoryExternalSignalRepository";
import { InMemoryAuditLog } from "../../infra/audit/InMemoryAuditLog";
import { InMemoryConversationLog } from "../../infra/audit/InMemoryConversationLog";
import { CandidateMapper } from "../../core/application/services/CandidateMapper";
import { StartIntentUseCase } from "../../core/application/use-cases/StartIntent";
import { ApplyAnswersUseCase } from "../../core/application/use-cases/ApplyAnswers";
import { SubmitIntentUseCase } from "../../core/application/use-cases/SubmitIntent";
import { RegisterExternalSignalUseCase } from "../../core/application/use-cases/RegisterExternalSignal";
import { ListExternalSignalsUseCase } from "../../core/application/use-cases/ListExternalSignals";
import { DismissProposedObligationUseCase } from "../../core/application/use-cases/DismissProposedObligation";
import { IntentStatus } from "../../core/domain/enums/IntentStatus";
import type { Candidate } from "../../core/domain/value-objects/Candidate";
import type { Clock } from "../../core/application/ports/Clock";
import type { IdGenerator } from "../../core/application/ports/IdGenerator";
import { PARTY, seededDirectory } from "../fixtures/parties";
import { PartyDirectory } from "../../core/application/services/PartyDirectory";
import { InMemoryPartyRepository } from "../../infra/persistence/InMemoryPartyRepository";
import { InMemoryIdentityLinkRepository } from "../../infra/persistence/InMemoryIdentityLinkRepository";
import { PartyIdentityState } from "../../core/domain/enums/PartyIdentityState";
import { HEALTH_REGISTRY } from "../../core/domain/services/HealthSignal";

/**
 * `docs/requisitos_refinados.md` §4.7 — the health system's signal (REQ-281–REQ-290).
 *
 * The example is the owner's: installment 3 of proposal 48213, nominal 100,00, the operator should
 * pay the usina 30,00 (not told yet), the health system discharged 25,00, the broker gets 20,00.
 */

const clock: Clock = { now: () => "2026-11-17T12:00:00.000Z" };

const INSTALLMENT = {
  proposalNumber: "48213",
  installment: "3",
  operator: "Unimed",
  operatorId: "77",
  nominalValue: "100.00",
  usinaValue: "25.00",
  broker: "Maria",
  brokerId: "123",
  brokerValue: "20.00",
  supervisor: "Carlos",
  supervisorId: "9",
  supervisorValue: "0",
  taxRate: "6.5",
  dischargedAt: "2026-11-05",
};

const PROPOSAL_CONTEXT = { objectId: "saude:proposta:48213", objectType: "proposal" };
const INSTALLMENT_CONTEXT = { objectId: "saude:proposta:48213:parcela:3", objectType: "installment" };

let intents: InMemoryIntentRepository;
let signals: InMemoryExternalSignalRepository;
let submitted: Candidate[];
let register: RegisterExternalSignalUseCase;
let list: ListExternalSignalsUseCase;
let dismiss: DismissProposedObligationUseCase;
let audit: InMemoryAuditLog;
let applyAnswers: ApplyAnswersUseCase;
let submit: SubmitIntentUseCase;
let startIntent: StartIntentUseCase;
let parties: InMemoryPartyRepository;

beforeEach(() => {
  intents = new InMemoryIntentRepository();
  signals = new InMemoryExternalSignalRepository();
  submitted = [];
  parties = seededDirectory().repo;
  const directory = new PartyDirectory(parties, undefined, new InMemoryIdentityLinkRepository());
  const log = new InMemoryConversationLog();
  let n = 0;
  const ids: IdGenerator = { next: () => `id-${++n}` };
  audit = new InMemoryAuditLog();
  applyAnswers = new ApplyAnswersUseCase(intents, clock, log, directory);
  startIntent = new StartIntentUseCase(intents, clock, ids, log);
  register = new RegisterExternalSignalUseCase(signals, intents, startIntent, applyAnswers, directory, parties, clock, ids);
  list = new ListExternalSignalsUseCase(signals, intents);
  dismiss = new DismissProposedObligationUseCase(intents, audit, clock);
  submit = new SubmitIntentUseCase(
    intents,
    new CandidateMapper(PARTY.USINA),
    {
      submit: async (candidate: Candidate) => {
        submitted.push(candidate);
        return { status: "accepted", ledgerReference: `evt-${submitted.length}` };
      },
    },
    audit,
    clock,
    directory,
  );
});

const proposalOf = (result: Awaited<ReturnType<RegisterExternalSignalUseCase["execute"]>>, fact: string) =>
  result.proposals.find((p) => p.fact === fact)!;

describe("REQ-281, REQ-282 — o sinal da saúde é o mesmo conceito do seguro, por parcela", () => {
  it("guarda o que veio, por parcela, sem enviar nada ao Ledger", async () => {
    const result = await register.execute({ kind: "installment", fields: INSTALLMENT, userId: "verificador" });

    expect(result.signal).toMatchObject({
      system: "health",
      kind: "installment",
      recordId: "48213:3",
      fields: INSTALLMENT,
      recordedBy: "verificador",
    });
    expect(submitted).toHaveLength(0);
  });

  it("REQ-290: a taxa de tributo fica no sinal como base e não propõe nenhum fato de imposto", async () => {
    const result = await register.execute({ kind: "installment", fields: INSTALLMENT, userId: "cfo" });

    expect(result.signal.fields.taxRate).toBe("6.5");
    expect(result.proposals.map((p) => p.fact).sort()).toEqual(["commission_expected", "commission_obligation", "supervisor_obligation"]);
  });

  it("REJ-282, Q-057: baixado zero, parcela zero e campo fora da lista são recusados, e nada fica guardado", async () => {
    await expect(register.execute({ kind: "installment", fields: { ...INSTALLMENT, usinaValue: "0.00" }, userId: "cfo" })).rejects.toThrow(/usinaValue/);
    await expect(register.execute({ kind: "installment", fields: { ...INSTALLMENT, installment: "0" }, userId: "cfo" })).rejects.toThrow(/Q-057/);
    await expect(register.execute({ kind: "installment", fields: { ...INSTALLMENT, clientName: "Fulano" }, userId: "cfo" })).rejects.toThrow(/clientName/);
    const { brokerValue: _, ...withoutBroker } = INSTALLMENT;
    await expect(register.execute({ kind: "installment", fields: withoutBroker, userId: "cfo" })).rejects.toThrow(/brokerValue/);

    expect(await signals.list()).toHaveLength(0);
    expect(await intents.findByOriginReference("saude:proposta:48213:parcela:3:prevista")).toHaveLength(0);
  });
});

describe("REQ-283 — três fatos propostos, citando a proposta e a parcela", () => {
  it("CA-283: expectativa, obrigação com o corretor e com o supervisor, cada uma com a sua referência", async () => {
    const result = await register.execute({ kind: "installment", fields: INSTALLMENT, userId: "cfo" });

    expect(result.proposals.map((p) => p.sourceReference)).toEqual([
      "saude:proposta:48213:parcela:3:prevista",
      "saude:proposta:48213:parcela:3:corretor",
      "saude:proposta:48213:parcela:3:supervisor",
    ]);
    for (const p of result.proposals) {
      const intent = (await intents.findById(p.intentId))!;
      expect(intent.contexts).toEqual([PROPOSAL_CONTEXT, INSTALLMENT_CONTEXT]);
      expect(intent.origin).toMatchObject({ signalId: result.signal.id, sourceReference: p.sourceReference, confidence: "medium" });
    }
  });

  it("a expectativa vai ao Ledger sem caixa, pelo baixado, citando a proposta e a parcela", async () => {
    const result = await register.execute({ kind: "installment", fields: INSTALLMENT, userId: "cfo" });
    const expected = proposalOf(result, "commission_expected");
    expect(expected.intentStatus).toBe(IntentStatus.AWAITING_CONFIRMATION);

    await submit.execute(expected.intentId, "cfo");

    expect(submitted[0]).toMatchObject({
      eventType: "commission_expected",
      amount: "25.00",
      sourceReference: "saude:proposta:48213:parcela:3:prevista",
    });
    expect(submitted[0].economicEffect).not.toBe("cash_in");
    expect(submitted[0].objects).toEqual([
      { objectId: "saude:proposta:48213:parcela:3:prevista", objectType: "commission_receivable", relation: "originates" },
      { ...PROPOSAL_CONTEXT, relation: "references" },
      { ...INSTALLMENT_CONTEXT, relation: "references" },
    ]);
  });

  it("a obrigação com o corretor vai pelo valor do sinal, ao corretor achado pelo id da saúde", async () => {
    const result = await register.execute({ kind: "installment", fields: INSTALLMENT, userId: "cfo" });
    const obligation = proposalOf(result, "commission_obligation");
    expect(obligation.party).toMatchObject({ outcome: "provisional" });

    await submit.execute(obligation.intentId, "cfo");

    expect(submitted[0]).toMatchObject({ eventType: "obligation_recognized", amount: "20.00" });
    expect(submitted[0].objects).toContainEqual({ ...INSTALLMENT_CONTEXT, relation: "references" });
  });

  it("CA-283b: a mesma parcela lida de novo reaproveita as propostas; pela integração, a mesma leitura nem é guardada", async () => {
    const first = await register.execute({ kind: "installment", fields: INSTALLMENT, userId: "cfo" });
    const again = await register.execute({ kind: "installment", fields: { ...INSTALLMENT }, userId: "verificador" });

    expect(again.proposals.every((p) => p.reused)).toBe(true);
    expect(again.proposals.map((p) => p.intentId)).toEqual(first.proposals.map((p) => p.intentId));

    // The integration re-reads on a schedule: a reading identical to the last one is not new knowledge.
    const repeated = await register.execute({ kind: "installment", fields: INSTALLMENT, userId: "", bySystem: true });
    expect(repeated.duplicate).toBe(true);
    const changed = await register.execute({ kind: "installment", fields: { ...INSTALLMENT, dueAt: "2026-11-10" }, userId: "", bySystem: true });
    expect(changed.duplicate).toBeUndefined();
    expect(changed.signal.recordedBy).toBe("system:saude");
    expect(changed.proposals.every((p) => p.reused)).toBe(true);
  });

  it("REJ-284: só a parcela comunicada é proposta; a parcela 4 é outra leitura, com outras propostas", async () => {
    const three = await register.execute({ kind: "installment", fields: INSTALLMENT, userId: "cfo" });
    const four = await register.execute({ kind: "installment", fields: { ...INSTALLMENT, installment: "4" }, userId: "cfo" });

    expect(three.proposals).toHaveLength(3);
    expect(four.proposals.every((p) => !p.reused)).toBe(true);
    expect(four.proposals[0].sourceReference).toBe("saude:proposta:48213:parcela:4:prevista");
  });

  it("sem supervisor na leitura, não há proposta para o supervisor", async () => {
    const { supervisor: _a, supervisorId: _b, supervisorValue: _c, ...withoutSupervisor } = INSTALLMENT;
    const result = await register.execute({ kind: "installment", fields: withoutSupervisor, userId: "cfo" });

    expect(result.proposals.map((p) => p.fact)).toEqual(["commission_expected", "commission_obligation"]);
  });
});

describe("REQ-285 — o valor da expectativa", () => {
  it("CA-285: sem o devido, a expectativa é aberta pelo baixado declarado", async () => {
    const result = await register.execute({ kind: "installment", fields: INSTALLMENT, userId: "cfo" });
    const intent = (await intents.findById(proposalOf(result, "commission_expected").intentId))!;

    expect(intent.answers.amount).toBe("25.00");
  });

  it("com o devido informado, a expectativa é aberta pelo devido e o baixado fica no sinal", async () => {
    const result = await register.execute({ kind: "installment", fields: { ...INSTALLMENT, owedValue: "30.00" }, userId: "cfo" });
    const intent = (await intents.findById(proposalOf(result, "commission_expected").intentId))!;

    expect(intent.answers.amount).toBe("30.00");
    expect(result.signal.fields.usinaValue).toBe("25.00");
  });
});

describe("REQ-286 — a obrigação nasce na comunicação, se o usuário confirmar", () => {
  it("REJ-286: o valor zerado sugere 'sem obrigação', mas não decide — a proposta espera o usuário", async () => {
    const result = await register.execute({ kind: "installment", fields: INSTALLMENT, userId: "cfo" });
    const supervisor = proposalOf(result, "supervisor_obligation");

    expect(supervisor.suggestion).toBe("no_obligation");
    expect(supervisor.intentStatus).toBe(IntentStatus.GATHERING);
    const intent = (await intents.findById(supervisor.intentId))!;
    expect(intent.answers.amount).toBeUndefined();
    expect(proposalOf(result, "commission_obligation").suggestion).toBeUndefined();
  });

  it("CA-286: o usuário declara 'sem obrigação' — nada vai ao Ledger, e a auditoria guarda quem e quando", async () => {
    const result = await register.execute({ kind: "installment", fields: INSTALLMENT, userId: "verificador" });
    const supervisor = proposalOf(result, "supervisor_obligation");

    const outcome = await dismiss.execute({ intentId: supervisor.intentId, userId: "cfo" });

    expect(outcome).toEqual({ intentId: supervisor.intentId, status: "dismissed", dismissedBy: "cfo", dismissedAt: clock.now() });
    expect(submitted).toHaveLength(0);
    expect(await audit.listByIntent(supervisor.intentId)).toEqual([
      expect.objectContaining({
        actor: { kind: "user", id: "cfo" },
        type: "proposal.dismissed",
        at: clock.now(),
        detail: "no_obligation:saude:proposta:48213:parcela:3:supervisor",
      }),
    ]);

    const [view] = (await list.page({ filter: "all", system: "health" })).signals;
    expect(view.proposals.find((p) => p.fact === "supervisor_obligation")).toMatchObject({
      intentStatus: IntentStatus.DISMISSED,
      dismissedBy: "cfo",
      dismissedAt: clock.now(),
    });
  });

  it("a lista diz quem registrou e quem decidiu pelo nome, quando o usuário é conhecido", async () => {
    const named = new ListExternalSignalsUseCase(signals, intents, {
      findById: async (id) => (id === "u-cfo" ? { displayName: "CFO da Usina" } : null),
    });
    const result = await register.execute({ kind: "installment", fields: INSTALLMENT, userId: "u-cfo" });
    await dismiss.execute({ intentId: proposalOf(result, "supervisor_obligation").intentId, userId: "u-cfo" });

    const [view] = (await named.page({ filter: "all" })).signals;
    expect(view.recordedByName).toBe("CFO da Usina");
    expect(view.proposals.find((p) => p.fact === "supervisor_obligation")).toMatchObject({ dismissedBy: "u-cfo", dismissedByName: "CFO da Usina" });
    expect(view.proposals.find((p) => p.fact === "commission_obligation")!.dismissedByName).toBeUndefined();
  });

  it("CA-286b: o corretor com 20,00 no sinal também pode não ter obrigação, se o usuário declarar", async () => {
    const result = await register.execute({ kind: "installment", fields: INSTALLMENT, userId: "cfo" });
    const broker = proposalOf(result, "commission_obligation");

    await dismiss.execute({ intentId: broker.intentId, userId: "cfo" });

    expect((await intents.findById(broker.intentId))!.status).toBe(IntentStatus.DISMISSED);
    expect(submitted).toHaveLength(0);
  });

  it("uma decisão tomada não é proposta de novo quando a mesma parcela é lida outra vez", async () => {
    const first = await register.execute({ kind: "installment", fields: INSTALLMENT, userId: "cfo" });
    await dismiss.execute({ intentId: proposalOf(first, "supervisor_obligation").intentId, userId: "cfo" });

    const again = await register.execute({ kind: "installment", fields: INSTALLMENT, userId: "cfo" });

    expect(proposalOf(again, "supervisor_obligation")).toMatchObject({ reused: true, intentStatus: IntentStatus.DISMISSED });
  });

  it("a proposta dispensada sai do que espera ação e do número do menu", async () => {
    const result = await register.execute({ kind: "installment", fields: INSTALLMENT, userId: "cfo" });
    expect(await list.countOpenProposals("health")).toBe(3);

    await dismiss.execute({ intentId: proposalOf(result, "supervisor_obligation").intentId, userId: "cfo" });

    expect(await list.countOpenProposals("health")).toBe(2);
  });

  it("só uma obrigação proposta por um sinal, ainda não enviada, pode ser dispensada", async () => {
    const result = await register.execute({ kind: "installment", fields: INSTALLMENT, userId: "cfo" });

    // The expected commission is not an obligation.
    await expect(dismiss.execute({ intentId: proposalOf(result, "commission_expected").intentId, userId: "cfo" })).rejects.toThrow(/obrigação proposta/);
    // A user's own conversation is not a proposal.
    const own = await startIntent.execute({ scenarioId: "register_obligation_recognition", userId: "cfo" });
    await expect(dismiss.execute({ intentId: own.intentId, userId: "cfo" })).rejects.toThrow(/obrigação proposta/);
    // Once sent and accepted, the fact stands: there is nothing left to dismiss.
    const broker = proposalOf(result, "commission_obligation");
    await submit.execute(broker.intentId, "cfo");
    await expect(dismiss.execute({ intentId: broker.intentId, userId: "cfo" })).rejects.toThrow();
    expect(await audit.listByIntent(broker.intentId)).not.toContainEqual(expect.objectContaining({ type: "proposal.dismissed" }));
  });
});

describe("REQ-288 — partes pelo id do sistema de saúde, cada uma no seu cadastro", () => {
  it("o mesmo número de corretor e de operadora não se confundem", async () => {
    await parties.save({
      partyId: "party-unimed",
      identityState: PartyIdentityState.IDENTIFIED,
      displayName: "Unimed",
      aliases: [],
      externalIds: [{ system: HEALTH_REGISTRY.operator, value: "123" }],
      attributes: {},
      createdBy: "cfo",
      createdAt: clock.now(),
    });

    const result = await register.execute({ kind: "installment", fields: { ...INSTALLMENT, operatorId: "123", brokerId: "123" }, userId: "cfo" });

    expect(proposalOf(result, "commission_expected").party).toEqual({ outcome: "linked", partyId: "party-unimed" });
    expect(proposalOf(result, "commission_obligation").party).toMatchObject({ outcome: "provisional" });
    const broker = (await intents.findById(proposalOf(result, "commission_obligation").intentId))!;
    const provisional = (await parties.findById(String(broker.answers.payee)))!;
    expect(provisional.externalIds).toEqual([{ system: HEALTH_REGISTRY.broker, value: "123" }]);
  });
});

describe("REQ-281 — cada sistema tem a sua lista e o seu número no menu", () => {
  it("a lista e a contagem de um sistema não trazem o outro", async () => {
    await register.execute({ kind: "installment", fields: INSTALLMENT, userId: "cfo" });
    await register.execute({
      kind: "eligibility",
      fields: { policyId: "5177", usinaValue: "128.77", payout: "77.26", eligibleAt: "2026-10-21", policyDate: "2026-10-01" },
      userId: "cfo",
    });

    expect((await list.page({ system: "health" })).signals.map((s) => s.kind)).toEqual(["installment"]);
    expect((await list.page({ system: "insurance" })).signals.map((s) => s.kind)).toEqual(["eligibility"]);
    expect((await list.page({})).signals).toHaveLength(2);
    expect(await list.countOpenProposals("health")).toBe(3);
    expect(await list.countOpenProposals("insurance")).toBe(2);
  });
});
