import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createServer, type Server } from "http";
import type { AddressInfo } from "net";
import { InMemoryIntentRepository } from "../../infra/persistence/InMemoryIntentRepository";
import { InMemoryAuditLog } from "../../infra/audit/InMemoryAuditLog";
import { HttpLedgerReadAdapter } from "../../infra/ledger-read/HttpLedgerReadAdapter";
import { HttpCandidateSubmissionAdapter } from "../../infra/submission/HttpCandidateSubmissionAdapter";
import {
  CandidateMapper,
  continuityObjectType,
  inheritsCounterparty,
  planReissue,
  producibleTuples,
} from "../../core/application/services/CandidateMapper";
import { Intent } from "../../core/domain/entities/Intent";
import { IntentStatus } from "../../core/domain/enums/IntentStatus";
import { getScenario } from "../../core/domain/scenarios/Scenario";
import { DialogEngine } from "../../core/domain/services/DialogEngine";
import { StartIntentUseCase } from "../../core/application/use-cases/StartIntent";
import { ApplyAnswersUseCase } from "../../core/application/use-cases/ApplyAnswers";
import { SubmitIntentUseCase } from "../../core/application/use-cases/SubmitIntent";
import { SubmitRectificationUseCase } from "../../core/application/use-cases/SubmitRectification";
import type { Candidate } from "../../core/domain/value-objects/Candidate";
import type { Clock } from "../../core/application/ports/Clock";
import type { IdGenerator } from "../../core/application/ports/IdGenerator";
import { PARTY, partyDirectory } from "../fixtures/parties";

/**
 * The part of `docs/requisitos_refinados.md` §4.5, §8.3 and REQ-525 that belongs to Treasury, written
 * before the code. The arithmetic is the Ledger's, in
 * `ledger/src/tests/integration/business-flows/composite-operations-acceptance.test.ts`.
 *
 * `pending` runs the test and expects it to fail, so the suite stays green and the test turns red
 * the moment the rule exists: that is the cue to replace it with `it`. ACCEPTANCE_STRICT=1 shows
 * each failure and its reason. `it.todo` marks criteria for a flow that has no interface to exercise
 * yet; they become real tests when that interface is defined (order in §16).
 */

const clock: Clock = { now: () => "2026-11-06T12:00:00.000Z" };

const DIRECT_PAYMENT = {
  id: "evt-direct",
  eventType: "direct_payment_acknowledged",
  economicEffect: "non_cash",
  amount: "300.00",
  currency: "BRL",
  occurredAt: "2026-10-20T00:00:00.000Z",
  description: "Pagamento direto ao corretor",
  objects: [
    { objectId: "position:receivable", objectType: "commission_receivable", relation: "settles" },
    { objectId: "position:entitlement", objectType: "commission_entitlement", relation: "settles" },
    { objectId: "proposal:x", objectType: "proposal", relation: "references" },
  ],
  parties: [{ partyId: PARTY.BROKER, role: "beneficiary", direction: "neutral" }],
  source: { system: "treasury", reference: "intent:direct" },
};

let ledger: Server;
let baseUrl: string;
let submitted: Candidate[] = [];

beforeAll(async () => {
  ledger = createServer((req, res) => {
    const path = decodeURIComponent((req.url || "").split("?")[0]);
    res.setHeader("content-type", "application/json");
    if (req.method === "GET" && path === "/api/events/evt-direct") {
      res.end(JSON.stringify(DIRECT_PAYMENT));
      return;
    }
    if (req.method === "POST" && path === "/api/intents/submit") {
      let raw = "";
      req.on("data", (chunk) => (raw += chunk));
      req.on("end", () => {
        submitted.push(JSON.parse(raw) as Candidate);
        res.end(JSON.stringify({ status: "accepted", ledgerReference: `evt-${submitted.length}` }));
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
  submitted = [];
});

function rectification() {
  const directory = partyDirectory();
  const repo = new InMemoryIntentRepository();
  const audit = new InMemoryAuditLog();
  let n = 0;
  const ids: IdGenerator = { next: () => `rect-${++n}` };
  return new SubmitRectificationUseCase(
    new HttpLedgerReadAdapter(baseUrl),
    new StartIntentUseCase(repo, clock, ids, audit),
    new ApplyAnswersUseCase(repo, clock, audit, directory),
    new SubmitIntentUseCase(
      repo,
      new CandidateMapper(PARTY.USINA),
      new HttpCandidateSubmissionAdapter(baseUrl, ""),
      audit,
      clock,
      directory,
    ),
    clock,
    PARTY.USINA,
  );
}

describe("REQ-525 — a retirada cita todas as posições do lançamento", () => {
  it("a retirada continua sendo enviada e aceita para um lançamento de várias posições", async () => {
    const result = await rectification().execute({ targetEventId: "evt-direct", userId: "cfo" });

    expect(result.retraction?.status).toBe("accepted");
    expect(submitted).toHaveLength(1);
    expect(submitted[0].eventType).toBe("ledger_correction");
  });

  it("cita as duas posições, e nenhum contexto", async () => {
    await rectification().execute({ targetEventId: "evt-direct", userId: "cfo" });

    expect(submitted[0].objects.map((o) => [o.objectId, o.objectType, o.relation])).toEqual([
      ["position:receivable", "commission_receivable", "retracts"],
      ["position:entitlement", "commission_entitlement", "retracts"],
    ]);
  });
});

describe("REQ-253 — a obrigação de comissão no Treasury", () => {
  function candidate(scenarioId: string, intentId: string, answers: Record<string, string>) {
    const intent = Intent.rehydrate({
      id: intentId,
      scenarioId,
      userId: "cfo",
      status: IntentStatus.AWAITING_CONFIRMATION,
      answers,
      createdAt: "2026-11-06T12:00:00.000Z",
      updatedAt: "2026-11-06T12:00:00.000Z",
    });
    return new CandidateMapper(PARTY.USINA).build(intent, getScenario(scenarioId)!);
  }

  const owed = { payee: PARTY.BROKER, amount: "600.00", currency: "BRL", occurredAt: "2026-11-06" };

  it("abrir a obrigação não move caixa e nomeia quem deve e a quem", () => {
    const c = candidate("register_obligation_recognition", "open", { ...owed, kind: "commission" });

    expect(c.eventType).toBe("obligation_recognized");
    expect(c.economicEffect).toBe("non_cash");
    expect(c.objects).toEqual([{ objectId: "intent:open", objectType: "commission_payable", relation: "originates" }]);
    expect(c.parties.every((p) => p.direction === "neutral" && p.amount === undefined)).toBe(true);
    expect(c.parties.map((p) => p.partyId)).toEqual([PARTY.USINA, PARTY.BROKER]);
  });

  it("pagar quita a mesma posição, com a saída de caixa na Usina", () => {
    const c = candidate("register_commission_payment", "pay", { ...owed, objectRef: "intent:open" });

    expect(c.eventType).toBe("commission_split");
    expect(c.economicEffect).toBe("cash_out");
    expect(c.objects).toEqual([{ objectId: "intent:open", objectType: "commission_payable", relation: "settles" }]);
    expect(c.parties[0]).toMatchObject({ partyId: PARTY.USINA, direction: "out", amount: "600.00" });
  });

  it("o Treasury oferece pagar a partir da posição, sem perguntar de novo a quem", () => {
    expect(continuityObjectType("register_commission_payment")).toBe("commission_payable");
    expect(inheritsCounterparty("register_commission_payment")).toBe(true);
    expect(producibleTuples()).toContainEqual(
      expect.objectContaining({
        scenarioId: "register_obligation_recognition",
        objectType: "commission_payable",
        relation: "originates",
        variantChoice: "commission",
      }),
    );
  });

  it("uma obrigação lançada errada pode ser retirada e registrada de novo", () => {
    const plan = planReissue(
      {
        eventType: "obligation_recognized",
        economicEffect: "non_cash",
        amount: "600.00",
        currency: "BRL",
        occurredAt: "2026-11-06T12:00:00.000Z",
        description: null,
        relatedEventId: null,
        objects: [{ objectId: "position:cp", objectType: "commission_payable", relation: "originates" }],
        parties: [
          { partyId: PARTY.USINA, role: "payer", direction: "neutral", amount: null },
          { partyId: PARTY.BROKER, role: "payee", direction: "neutral", amount: null },
        ],
      },
      PARTY.USINA,
    );

    expect(plan).toMatchObject({ reissuable: true, scenarioId: "register_obligation_recognition" });
    expect(plan.reissuable && plan.answers).toContainEqual({ key: "kind", value: "commission" });
  });
});

describe("REQ-229 — as duas datas da comissão prevista", () => {
  const slot = (key: string) => getScenario("register_commission_accrual")!.slots.find((s) => s.key === key)!;
  const TODAY = "2026-11-06";

  it("a data esperada pode ser futura; a data em que surgiu, não", () => {
    expect(DialogEngine.validateAnswer(slot("dueAt"), "2026-12-15", TODAY)).toBeNull();
    expect(DialogEngine.validateAnswer(slot("occurredAt"), "2026-12-15", TODAY)).not.toBeNull();
  });

  it("a data esperada segue para o Ledger, e fica de fora quando não é informada", () => {
    const build = (dueAt?: string) =>
      new CandidateMapper(PARTY.USINA).build(
        Intent.rehydrate({
          id: "accrual",
          scenarioId: "register_commission_accrual",
          userId: "cfo",
          status: IntentStatus.AWAITING_CONFIRMATION,
          answers: { amount: "100.00", currency: "BRL", occurredAt: TODAY, ...(dueAt ? { dueAt } : {}) },
          createdAt: "2026-11-06T12:00:00.000Z",
          updatedAt: "2026-11-06T12:00:00.000Z",
        }),
        getScenario("register_commission_accrual")!,
      );

    expect(build("2026-12-15").dueAt).toBeDefined();
    expect(build().dueAt).toBeUndefined();
  });
});

describe("§4.4 — extrato, pagamento e anexo", () => {
  it.todo("CA-244 / REJ-244: gerar o extrato mostra o que está em aberto e não envia evento ao Ledger");
  it.todo("CA-246: lote de João e Maria vira dois eventos com o mesmo contexto de lote");
  it.todo("CA-247: o mesmo extrato bancário vale para os dois eventos, com hash guardado, e os eventos não mudam");
  it.todo("CA-247b / REJ-247: anexar registra quem anexou, quando e a qual fato");
  it.todo("CA-248: qualquer operador registra o pagamento, e a auditoria mostra quem foi");
});

describe("§10 — quem anotou e com que confiança", () => {
  it.todo("CA-805 / CA-805b: sinal externo confirmado tem o sistema como autor e o usuário na auditoria");
  it.todo("CA-806: conversa ou planilha grava confiança média, banco ou documento grava alta");
});

describe("§4.5 — operação composta no Treasury", () => {
  it.todo("CA-252: a compensação só oferece posições da mesma pessoa");
  it.todo("CA-255: plano interrompido mantém o primeiro fato e mostra que o segundo não foi enviado");
  it.todo("REJ-255: recusa de um fato do plano não desfaz nem impede o fato já enviado");
  it.todo("CA-256: com obrigação aberta, o usuário escolhe adiantamento mais compensação ou pagamento parcial");
});

describe("§8.3 — resultado na linguagem do usuário", () => {
  it.todo("CA-626: corretor com saldo negativo aparece com quanto trouxe e quanto custou, sem rótulo de qualidade");
  it.todo("REJ-627: o Treasury mostra os totais publicados pelo Ledger, sem somar por conta própria");
});
