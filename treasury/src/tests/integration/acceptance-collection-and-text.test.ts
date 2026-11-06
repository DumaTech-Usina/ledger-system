import { describe, it, expect } from "vitest";
import { InMemoryIntentRepository } from "../../infra/persistence/InMemoryIntentRepository";
import { InMemoryAuditLog } from "../../infra/audit/InMemoryAuditLog";
import { StubSlotExtractionAdapter } from "../../infra/nlp/StubSlotExtractionAdapter";
import { StartIntentUseCase } from "../../core/application/use-cases/StartIntent";
import { ApplyAnswersUseCase } from "../../core/application/use-cases/ApplyAnswers";
import { PreviewIntentUseCase } from "../../core/application/use-cases/PreviewIntent";
import { SubmitIntentUseCase } from "../../core/application/use-cases/SubmitIntent";
import { InterpretUtteranceUseCase } from "../../core/application/use-cases/InterpretUtterance";
import { CandidateMapper } from "../../core/application/services/CandidateMapper";
import { toInstantISO } from "../../core/application/utils/instant";
import { IntentStatus } from "../../core/domain/enums/IntentStatus";
import type { Candidate } from "../../core/domain/value-objects/Candidate";
import type { SlotExtractionPort, SlotProposal } from "../../core/application/ports/SlotExtractionPort";
import type { Clock } from "../../core/application/ports/Clock";
import type { IdGenerator } from "../../core/application/ports/IdGenerator";
import { PARTY, partyDirectory } from "../fixtures/parties";

/**
 * Acceptance criteria of `requisitos_refinados.md` §14 that describe what the system already does
 * and that had no test of their own. Named by criterion, so the document and the suite can be read
 * against each other.
 */
const clock: Clock = { now: () => "2026-11-03T12:00:00.000Z" };

function wire(extractor: SlotExtractionPort = new StubSlotExtractionAdapter()) {
  const directory = partyDirectory();
  const repo = new InMemoryIntentRepository();
  const audit = new InMemoryAuditLog();
  const mapper = new CandidateMapper(PARTY.USINA);
  let n = 0;
  const ids: IdGenerator = { next: () => `intent-${++n}` };
  const submitted: Candidate[] = [];
  const apply = new ApplyAnswersUseCase(repo, clock, audit, directory);
  return {
    repo,
    apply,
    submitted,
    start: new StartIntentUseCase(repo, clock, ids, audit),
    preview: new PreviewIntentUseCase(repo, mapper, directory),
    interpret: new InterpretUtteranceUseCase(repo, extractor, apply, audit, clock, ids, directory),
    submit: new SubmitIntentUseCase(
      repo,
      mapper,
      {
        submit: async (candidate: Candidate) => {
          submitted.push(candidate);
          return { status: "accepted" as const, ledgerReference: "evt-1" };
        },
      },
      audit,
      clock,
      directory,
    ),
  };
}

const payroll = (amount: string) => [
  { key: "payee", value: PARTY.ACME },
  { key: "amount", value: amount },
  { key: "currency", value: "BRL" },
  { key: "occurredAt", value: "2026-11-03" },
];

const proposing = (slots: SlotProposal[]): SlotExtractionPort => ({ extract: async () => ({ slots }) });

describe("CA-210 — coleta guiada", () => {
  it("multa sem nenhuma resposta: a primeira pergunta é quem recebe", async () => {
    const { start } = wire();
    const { state } = await start.execute({ scenarioId: "register_penalty", userId: "cfo" });

    expect(state.kind).toBe("question");
    expect(state.kind === "question" && state.slot.key).toBe("payee");
  });
});

describe("CA-223 — valor maior que zero e sem teto", () => {
  it.each(["0.01", "1000000000.00"])("%s é aceito e chega ao candidato sem alteração", async (amount) => {
    const { start, apply, preview } = wire();
    const { intentId } = await start.execute({ scenarioId: "register_payroll", userId: "cfo" });

    const result = await apply.execute({ intentId, answers: payroll(amount) });

    expect(result.rejected).toEqual([]);
    expect(result.state.kind).toBe("ready");
    expect((await preview.execute(intentId)).candidate.amount).toBe(amount);
  });
});

describe("CA-227 — o vencimento pode ser futuro", () => {
  const obligation = [
    { key: "kind", value: "service" },
    { key: "payee", value: PARTY.ACME },
    { key: "amount", value: "800.00" },
    { key: "currency", value: "BRL" },
    { key: "occurredAt", value: "2026-11-03" },
  ];

  it("reconhecimento em 03/11/2026 com vencimento em 10/12/2026 é aceito", async () => {
    const { start, apply, preview } = wire();
    const { intentId } = await start.execute({ scenarioId: "register_obligation_recognition", userId: "cfo" });

    const result = await apply.execute({
      intentId,
      answers: [...obligation, { key: "dueAt", value: "2026-12-10" }],
    });

    expect(result.rejected).toEqual([]);
    expect(result.state.kind).toBe("ready");
    expect((await preview.execute(intentId)).candidate.dueAt).toBe(toInstantISO("2026-12-10"));
  });

  it("§4.1: vencimento vazio deixa a obrigação sem vencimento conhecido, nunca vencendo hoje", async () => {
    const { start, apply, preview } = wire();
    const { intentId } = await start.execute({ scenarioId: "register_obligation_recognition", userId: "cfo" });

    await apply.execute({ intentId, answers: obligation });

    expect((await preview.execute(intentId)).candidate).not.toHaveProperty("dueAt");
  });
});

describe("REJ-228 — a convenção brasileira não chega ao Ledger", () => {
  it.each(["1.500,00", "1500,00", "R$ 1500.00"])("a resposta %s é recusada e não é registrada", async (amount) => {
    const { start, apply, repo } = wire();
    const { intentId } = await start.execute({ scenarioId: "register_payroll", userId: "cfo" });

    const result = await apply.execute({ intentId, answers: [{ key: "amount", value: amount }] });

    expect(result.rejected.map((r) => r.key)).toEqual(["amount"]);
    expect((await repo.findById(intentId))?.answers.amount).toBeUndefined();
  });

  it("um valor dito no formato brasileiro sai no formato do Ledger, até o envio", async () => {
    const { start, apply, interpret, submit, submitted } = wire();
    const { intentId } = await start.execute({ scenarioId: "register_payroll", userId: "cfo" });

    await interpret.execute({ intentId, utterance: "paguei R$ 1.500,00" });
    await apply.execute({
      intentId,
      answers: [
        { key: "payee", value: PARTY.ACME },
        { key: "currency", value: "BRL" },
        { key: "occurredAt", value: "2026-11-03" },
      ],
    });
    await submit.execute(intentId);

    expect(submitted[0].amount).toBe("1500.00");
    expect(JSON.stringify(submitted[0])).not.toMatch(/R\$|\d,\d/);
  });
});

describe("REJ-213 — sem chegar a pronta para envio, nada é enviado", () => {
  it("o envio é recusado e nada chega ao Ledger", async () => {
    const { start, apply, submit, submitted, repo } = wire();
    const { intentId } = await start.execute({ scenarioId: "register_payroll", userId: "cfo" });
    await apply.execute({ intentId, answers: [{ key: "amount", value: "1500.00" }] });

    await expect(submit.execute(intentId)).rejects.toThrow(/not ready/i);

    expect(submitted).toHaveLength(0);
    expect((await repo.findById(intentId))?.status).toBe(IntentStatus.GATHERING);
  });
});

describe("CA-701 — texto livre", () => {
  it("a frase do critério vira adiantamento de 2.000,00 em 10/07/2026, e pergunta quem recebe", async () => {
    const { interpret, repo } = wire();

    const res = await interpret.execute({
      utterance: "conceder um adiantamento de 2000,00 em 2026-07-10",
      userId: "cfo",
    });

    expect(res.scenarioId).toBe("register_advance");
    const intent = await repo.findById(res.intentId!);
    expect(intent?.answers.amount).toBe("2000.00");
    expect(intent?.answers.occurredAt).toBe("2026-07-10");
    expect(res.state?.kind === "question" && res.state.slot.key).toBe("payee");
  });
});

describe("CA-703 — limiar de confiança", () => {
  async function interpretAt(confidence: number) {
    const { start, interpret, repo } = wire(
      proposing([
        { key: "payee", value: PARTY.ACME, confidence: 0.9 },
        { key: "amount", value: "2000.00", confidence },
      ]),
    );
    const { intentId } = await start.execute({ scenarioId: "register_payment", userId: "cfo" });
    const res = await interpret.execute({ intentId, utterance: "..." });
    return { res, answers: (await repo.findById(intentId))!.answers };
  }

  it("0,49 não é aplicada, e o campo é perguntado pela coleta guiada", async () => {
    const { res, answers } = await interpretAt(0.49);

    expect(answers.amount).toBeUndefined();
    expect(res.lowConfidence.map((p) => p.key)).toEqual(["amount"]);
    expect(res.state?.kind === "question" && res.state.slot.key).toBe("amount");
  });

  it("0,50 é validada e registrada", async () => {
    const { res, answers } = await interpretAt(0.5);

    expect(answers.amount).toBe("2000.00");
    expect(res.lowConfidence).toEqual([]);
  });

  it("0,50 ainda passa pela validação: um valor inválido não é registrado", async () => {
    const { start, interpret, repo } = wire(proposing([{ key: "amount", value: "abc", confidence: 0.5 }]));
    const { intentId } = await start.execute({ scenarioId: "register_payment", userId: "cfo" });

    const res = await interpret.execute({ intentId, utterance: "..." });

    expect(res.rejected.map((r) => r.key)).toEqual(["amount"]);
    expect((await repo.findById(intentId))?.answers.amount).toBeUndefined();
  });
});
