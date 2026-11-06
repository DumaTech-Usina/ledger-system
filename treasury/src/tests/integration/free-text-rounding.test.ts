import { describe, it, expect } from "vitest";
import { InMemoryIntentRepository } from "../../infra/persistence/InMemoryIntentRepository";
import { InMemoryAuditLog } from "../../infra/audit/InMemoryAuditLog";
import { StubSlotExtractionAdapter } from "../../infra/nlp/StubSlotExtractionAdapter";
import { StartIntentUseCase } from "../../core/application/use-cases/StartIntent";
import { ApplyAnswersUseCase } from "../../core/application/use-cases/ApplyAnswers";
import { AdvanceDialogUseCase } from "../../core/application/use-cases/AdvanceDialog";
import { InterpretUtteranceUseCase } from "../../core/application/use-cases/InterpretUtterance";
import { getScenario } from "../../core/domain/scenarios/Scenario";
import type { Clock } from "../../core/application/ports/Clock";
import type { IdGenerator } from "../../core/application/ports/IdGenerator";
import { partyDirectory } from "../fixtures/parties";

/** REQ-221: an amount that did not pass through the mask is refused, and the user decides. */
const clock: Clock = { now: () => "2026-11-03T12:00:00.000Z" };

async function wire() {
  const directory = partyDirectory();
  const repo = new InMemoryIntentRepository();
  const audit = new InMemoryAuditLog();
  let n = 0;
  const ids: IdGenerator = { next: () => `intent-${++n}` };
  const apply = new ApplyAnswersUseCase(repo, clock, audit, directory);
  const start = new StartIntentUseCase(repo, clock, ids, audit);
  const { intentId } = await start.execute({ scenarioId: "register_service_fee", userId: "cfo" });
  return {
    repo,
    apply,
    intentId,
    advance: new AdvanceDialogUseCase(repo, clock, audit, directory),
    interpret: new InterpretUtteranceUseCase(
      repo,
      new StubSlotExtractionAdapter(),
      apply,
      audit,
      clock,
      ids,
      directory,
    ),
  };
}

const amountOf = async (w: Awaited<ReturnType<typeof wire>>) =>
  (await w.repo.findById(w.intentId))?.answers.amount;

describe("CA-221 — texto livre com valor de 3 casas", () => {
  it("REJ-220: é recusado, com a sugestão, e nada é registrado", async () => {
    const w = await wire();

    const res = await w.interpret.execute({ intentId: w.intentId, utterance: "paguei 10,125 de taxa" });

    expect(res.accepted).not.toContain("amount");
    expect(res.rejected).toEqual([expect.objectContaining({ key: "amount", suggestedValue: "10.12" })]);
    expect(await amountOf(w)).toBeUndefined();
  });

  it("REJ-221: 10,126 sugere 10,13, e nunca vira 10,12 em silêncio", async () => {
    const w = await wire();

    const res = await w.interpret.execute({ intentId: w.intentId, utterance: "paguei 10,126 de taxa" });

    expect(res.rejected[0].suggestedValue).toBe("10.13");
    expect(await amountOf(w)).toBeUndefined();
  });

  it("o usuário aceita: a sugestão é registrada", async () => {
    const w = await wire();
    const res = await w.interpret.execute({ intentId: w.intentId, utterance: "paguei 10,125 de taxa" });

    const accepted = await w.advance.execute({
      intentId: w.intentId,
      key: "amount",
      value: res.rejected[0].suggestedValue!,
    });

    expect(accepted.error).toBeUndefined();
    expect(await amountOf(w)).toBe("10.12");
  });

  it("CA-221c: o usuário não aceita: nada é registrado e o campo continua sendo perguntado", async () => {
    const w = await wire();
    await w.interpret.execute({ intentId: w.intentId, utterance: "paguei 10,125 de taxa" });

    const next = await w.apply.execute({
      intentId: w.intentId,
      answers: [{ key: "payee", value: "party-acme" }],
    });

    expect(await amountOf(w)).toBeUndefined();
    expect(next.state.kind === "question" && next.state.slot.key).toBe("amount");
  });

  it("vale para qualquer entrada: a resposta direta recebe a mesma recusa e a mesma sugestão", async () => {
    const w = await wire();

    const res = await w.advance.execute({ intentId: w.intentId, key: "amount", value: "10.135" });

    expect(res.error?.suggestedValue).toBe("10.14");
    expect(await amountOf(w)).toBeUndefined();
  });

  it("não sugere um valor que arredondaria para zero (REQ-223)", async () => {
    const w = await wire();

    const res = await w.advance.execute({ intentId: w.intentId, key: "amount", value: "0.004" });

    expect(res.error).toBeDefined();
    expect(res.error?.suggestedValue).toBeUndefined();
    expect(await amountOf(w)).toBeUndefined();
  });
});

describe("a extração nunca altera o valor dito", () => {
  const slots = getScenario("register_service_fee")!.slots;
  const amountFrom = async (utterance: string) => {
    const { slots: proposed } = await new StubSlotExtractionAdapter().extract({ utterance, slots });
    return proposed.find((p) => p.key === "amount")?.value;
  };

  it.each([
    ["10,125", "10.125"],
    ["10.1251", "10.1251"],
    ["1.500,125", "1500.125"],
    ["1,500.125", "1500.125"],
    ["1.500,00", "1500.00"],
    ["1,500.00", "1500.00"],
    ["1500,00", "1500.00"],
    ["1500.00", "1500.00"],
    ["1500", "1500"],
  ])("%s → %s", async (said, expected) => {
    expect(await amountFrom(`paguei ${said} de taxa`)).toBe(expected);
  });

  it.each([
    ["1.500", "1500"],
    ["1.234.567", "1234567"],
  ])("%s é separador de milhar: vira %s, e não 1,50", async (said, expected) => {
    expect(await amountFrom(`paguei ${said} de taxa`)).toBe(expected);
  });
});
