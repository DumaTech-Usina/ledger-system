import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryIntentRepository } from "../../infra/persistence/InMemoryIntentRepository";
import { InMemoryExternalSignalRepository } from "../../infra/persistence/InMemoryExternalSignalRepository";
import { InMemoryConversationLog } from "../../infra/audit/InMemoryConversationLog";
import { InMemoryAuditLog } from "../../infra/audit/InMemoryAuditLog";
import { StartIntentUseCase } from "../../core/application/use-cases/StartIntent";
import { ApplyAnswersUseCase } from "../../core/application/use-cases/ApplyAnswers";
import { SubmitIntentUseCase } from "../../core/application/use-cases/SubmitIntent";
import { RegisterExternalSignalUseCase } from "../../core/application/use-cases/RegisterExternalSignal";
import { ReceiveSignalMessageUseCase } from "../../core/application/use-cases/ReceiveSignalMessage";
import { PublishInsuranceEligibilityUseCase } from "../../core/application/use-cases/PublishInsuranceEligibility";
import { CandidateMapper } from "../../core/application/services/CandidateMapper";
import {
  SIGNAL_ROUTE,
  buildEligibilityMessage,
  parseSignalMessage,
} from "../../core/application/messaging/insuranceSignalMessage";
import { eligibilityFieldsFrom } from "../../infra/insurance/insuranceMapping";
import type { InsuranceSourcePort } from "../../core/application/ports/InsuranceSourcePort";
import type { Candidate } from "../../core/domain/value-objects/Candidate";
import type { Clock } from "../../core/application/ports/Clock";
import type { IdGenerator } from "../../core/application/ports/IdGenerator";
import { PARTY, seededDirectory } from "../fixtures/parties";

/**
 * The insurance system's integration (round 15): a producer reads the insurance API and publishes one
 * message per eligible policy; a consumer registers it as a signal, authored by the system. The JSON
 * below is the real shape read from the insurance API on 2026-11-09, with the client's data left out.
 */

const clock: Clock = { now: () => "2026-11-09T22:00:00.000Z" };

const ELIGIBLE = {
  policyNumber: "5177202641312121285",
  broker: "Halisson",
  client: "NOME DO CLIENTE",
  netPremium: "643.85",
  workedCommission: "20",
  payoutRate: "60",
  ctu: null,
  usinaValue: "128.77",
  eligibleAt: "2026-10-21T19:36:27.952Z",
  retained: "51.51",
  payout: "77.26",
  signedBy: "cbbd1a09-c0ca-4dee-8145-a908e9352b3e",
  policyId: "c1f2d949-0466-47c3-994b-b0e1b3d68191",
  renewalDate: "2027-09-17",
};
const POLICY = {
  id: ELIGIBLE.policyId,
  policyNumber: ELIGIBLE.policyNumber,
  proposalId: "25bc266e-a591-4ca3-827f-4ed241b5d6c9",
  brokerId: "355ab279-b7ce-4443-8b71-96903db570ac",
  clientId: "caf39ea5",
  premium: "643.85",
  coverageStart: "2026-09-17",
  registeredAt: "2026-10-16T17:52:05.628Z",
  document: "000.000.000-00",
};
const PROPOSAL = { id: POLICY.proposalId, insurerId: "ALLIANZ", productId: "Auto", clientId: "caf39ea5" };

const FIELDS = {
  policyId: ELIGIBLE.policyId,
  policyNumber: ELIGIBLE.policyNumber,
  insurer: "ALLIANZ",
  insurerId: "ALLIANZ",
  broker: "Halisson",
  brokerId: POLICY.brokerId,
  product: "Auto",
  netPremium: "643.85",
  ct: "20",
  cr: "60",
  usinaValue: "128.77",
  payout: "77.26",
  retained: "51.51",
  eligibleAt: "2026-10-21",
  policyDate: "2026-10-16",
  signedBy: ELIGIBLE.signedBy,
};

describe("Mapeamento da API do sistema de seguro", () => {
  it("monta os campos do sinal a partir do demonstrativo, da apólice e da proposta", () => {
    expect(eligibilityFieldsFrom(ELIGIBLE, POLICY, PROPOSAL)).toEqual(FIELDS);
  });

  it("nunca leva o cliente nem documento", () => {
    const fields = eligibilityFieldsFrom(ELIGIBLE, POLICY, PROPOSAL);
    expect(JSON.stringify(fields)).not.toMatch(/CLIENTE|caf39ea5|000\.000/);
  });

  it("a data da elegibilidade é o dia em São Paulo, não em UTC", () => {
    const late = eligibilityFieldsFrom({ ...ELIGIBLE, eligibleAt: "2026-10-22T01:30:00.000Z" }, POLICY, PROPOSAL);
    expect(late.eligibleAt).toBe("2026-10-21");
  });

  it("CTU presente vai junto; ausente fica de fora", () => {
    expect(eligibilityFieldsFrom({ ...ELIGIBLE, ctu: "80" }, POLICY, PROPOSAL).ctu).toBe("80");
    expect("ctu" in eligibilityFieldsFrom(ELIGIBLE, POLICY, PROPOSAL)).toBe(false);
  });
});

describe("Contrato produtor → consumidor", () => {
  it("o que o produtor monta, o consumidor aceita", () => {
    const message = buildEligibilityMessage(FIELDS, clock.now());
    const parsed = parseSignalMessage(JSON.stringify(message));

    expect(parsed).toEqual({ ok: true, message });
    expect(message).toMatchObject({
      type: "insurance.signal.observed",
      version: 1,
      source: "seguro",
      observedAt: clock.now(),
      signal: { kind: "eligibility", fields: FIELDS },
    });
    expect(message.messageId).toMatch(new RegExp(`^seguro:eligibility:${FIELDS.policyId}:[0-9a-f]{64}$`));
    expect(SIGNAL_ROUTE).toEqual({
      exchange: "treasury",
      routingKey: "signal.insurance",
      queue: "treasury.signals",
      deadLetterExchange: "treasury.dlx",
      deadLetterQueue: "treasury.signals.dead",
    });
  });

  it("a mesma leitura tem o mesmo messageId; uma leitura diferente, outro", () => {
    const a = buildEligibilityMessage(FIELDS, "2026-11-09T22:00:00.000Z");
    const b = buildEligibilityMessage({ ...FIELDS }, "2026-11-09T22:05:00.000Z");
    const c = buildEligibilityMessage({ ...FIELDS, payout: "83.70" }, "2026-11-09T22:05:00.000Z");

    expect(b.messageId).toBe(a.messageId);
    expect(c.messageId).not.toBe(a.messageId);
  });

  it.each([
    ["JSON inválido", "{nope"],
    ["tipo errado", JSON.stringify({ ...buildEligibilityMessage(FIELDS, clock.now()), type: "outro" })],
    ["versão desconhecida", JSON.stringify({ ...buildEligibilityMessage(FIELDS, clock.now()), version: 2 })],
    ["origem errada", JSON.stringify({ ...buildEligibilityMessage(FIELDS, clock.now()), source: "outro" })],
    ["sem messageId", JSON.stringify({ ...buildEligibilityMessage(FIELDS, clock.now()), messageId: "" })],
    ["tipo de sinal fora do combinado", JSON.stringify({ ...buildEligibilityMessage(FIELDS, clock.now()), signal: { kind: "policy", fields: FIELDS } })],
  ])("recusa %s", (_label, raw) => {
    expect(parseSignalMessage(raw).ok).toBe(false);
  });
});

describe("Consumidor", () => {
  let signals: InMemoryExternalSignalRepository;
  let intents: InMemoryIntentRepository;
  let receive: ReceiveSignalMessageUseCase;
  let register: RegisterExternalSignalUseCase;

  beforeEach(() => {
    signals = new InMemoryExternalSignalRepository();
    intents = new InMemoryIntentRepository();
    const { directory, repo } = seededDirectory();
    const log = new InMemoryConversationLog();
    let n = 0;
    const ids: IdGenerator = { next: () => `id-${++n}` };
    const apply = new ApplyAnswersUseCase(intents, clock, log, directory);
    register = new RegisterExternalSignalUseCase(signals, intents, new StartIntentUseCase(intents, clock, ids, log), apply, directory, repo, clock, ids);
    receive = new ReceiveSignalMessageUseCase(register);
  });

  const raw = (fields: Record<string, string> = FIELDS) => JSON.stringify(buildEligibilityMessage(fields, clock.now()));

  it("mensagem válida → sinal registrado, de autoria do sistema, com as duas propostas", async () => {
    const outcome = await receive.execute(raw());

    expect(outcome).toMatchObject({ outcome: "registered" });
    const [signal] = await signals.list();
    expect(signal.toJSON()).toMatchObject({ recordedBy: "system:seguro", fields: FIELDS });
    expect(signal.toJSON().proposals.map((p) => p.fact)).toEqual(["commission_obligation", "commission_expected"]);
  });

  it("a mesma leitura de novo → nada é gravado", async () => {
    await receive.execute(raw());
    const again = await receive.execute(raw());

    expect(again).toMatchObject({ outcome: "duplicate" });
    expect(await signals.list()).toHaveLength(1);
  });

  it("leitura diferente da mesma apólice → novo sinal, propostas reaproveitadas", async () => {
    await receive.execute(raw());
    const changed = await receive.execute(raw({ ...FIELDS, retained: "51.50" }));

    expect(changed).toMatchObject({ outcome: "registered" });
    const latest = (await signals.list())[0].toJSON();
    expect(latest.proposals.every((p) => p.reused)).toBe(true);
  });

  it("envelope inválido → recusada, com o motivo, e nada gravado", async () => {
    const outcome = await receive.execute("{nope");

    expect(outcome.outcome).toBe("invalid");
    expect(await signals.list()).toHaveLength(0);
  });

  it("campos que o sinal não aceita → recusada (o cliente nunca entra)", async () => {
    const outcome = await receive.execute(raw({ ...FIELDS, client: "NOME DO CLIENTE" }));

    expect(outcome).toMatchObject({ outcome: "invalid" });
    expect(await signals.list()).toHaveLength(0);
  });

  it("REQ-805: o fato proposto pelo sistema sai com o sistema como autor; quem confirmou fica na auditoria", async () => {
    await receive.execute(raw());
    const [signal] = await signals.list();
    const obligation = signal.toJSON().proposals.find((p) => p.fact === "commission_obligation")!;
    const sent: Candidate[] = [];
    const audit = new InMemoryAuditLog();
    const apply = new ApplyAnswersUseCase(intents, clock, new InMemoryConversationLog(), seededDirectory().directory);
    await apply.execute({ intentId: obligation.intentId, answers: [{ key: "payee", value: PARTY.BROKER }] });

    await new SubmitIntentUseCase(
      intents,
      new CandidateMapper(PARTY.USINA),
      { submit: async (c: Candidate) => (sent.push(c), { status: "accepted", ledgerReference: "evt-1" }) },
      audit,
      clock,
      seededDirectory().directory,
    ).execute(obligation.intentId, "user-cfo");

    expect(sent[0]).toMatchObject({
      reporter: { reporterType: "system", reporterId: "seguro" },
      reason: { confidence: "medium" },
    });
    expect((await audit.listByIntent(obligation.intentId)).some((r) => r.actor.id === "user-cfo")).toBe(true);
  });

  it("o formulário continua de autoria de quem preencheu", async () => {
    const result = await register.execute({ kind: "eligibility", fields: FIELDS, userId: "cfo" });

    expect(result.signal.recordedBy).toBe("cfo");
  });
});

describe("Produtor", () => {
  function source(items: Record<string, unknown>[], pages = 1): InsuranceSourcePort & { calls: string[] } {
    const calls: string[] = [];
    return {
      calls,
      eligible: async (page: number) => {
        calls.push(`eligible:${page}`);
        return { items: page <= pages ? items : [], total: items.length * pages, page, size: items.length };
      },
      policy: async (id: string) => (calls.push(`policy:${id}`), { ...POLICY, id }),
      proposal: async (id: string) => (calls.push(`proposal:${id}`), PROPOSAL),
    };
  }

  it("publica uma mensagem por apólice elegível, na rota combinada", async () => {
    const published: { routingKey: string; message: unknown }[] = [];
    const publisher = { publish: async (routingKey: string, message: unknown) => void published.push({ routingKey, message }) };

    const result = await new PublishInsuranceEligibilityUseCase(source([ELIGIBLE]), publisher, clock, eligibilityFieldsFrom).execute();

    expect(result).toEqual({ published: 1, skipped: [] });
    expect(published).toHaveLength(1);
    expect(published[0].routingKey).toBe("signal.insurance");
    expect(parseSignalMessage(JSON.stringify(published[0].message))).toMatchObject({ ok: true });
  });

  it("percorre todas as páginas", async () => {
    const src = source([ELIGIBLE], 2);
    const published: unknown[] = [];

    await new PublishInsuranceEligibilityUseCase(src, { publish: async (_k: string, m: unknown) => void published.push(m) }, clock, eligibilityFieldsFrom).execute();

    expect(src.calls.filter((c) => c.startsWith("eligible"))).toEqual(["eligible:1", "eligible:2", "eligible:3"]);
    expect(published).toHaveLength(2);
  });

  it("um item que não forma um sinal válido não é publicado, e é reportado", async () => {
    const published: unknown[] = [];

    const result = await new PublishInsuranceEligibilityUseCase(
      source([{ ...ELIGIBLE, payout: null }]),
      { publish: async (_k: string, m: unknown) => void published.push(m) },
      clock,
      eligibilityFieldsFrom,
    ).execute();

    expect(published).toHaveLength(0);
    expect(result.skipped[0]).toMatchObject({ policyId: ELIGIBLE.policyId });
  });
});
