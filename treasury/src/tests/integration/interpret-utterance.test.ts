import { describe, it, expect } from "vitest";
import { InMemoryIntentRepository } from "../../infra/persistence/InMemoryIntentRepository";
import { InMemoryAuditLog } from "../../infra/audit/InMemoryAuditLog";
import { StubSlotExtractionAdapter } from "../../infra/nlp/StubSlotExtractionAdapter";
import { StartIntentUseCase } from "../../core/application/use-cases/StartIntent";
import { ApplyAnswersUseCase } from "../../core/application/use-cases/ApplyAnswers";
import { InterpretUtteranceUseCase, type InterpretOptions } from "../../core/application/use-cases/InterpretUtterance";
import type { SlotExtractionPort, SlotExtractionResult } from "../../core/application/ports/SlotExtractionPort";
import type { Clock } from "../../core/application/ports/Clock";
import type { IdGenerator } from "../../core/application/ports/IdGenerator";
import { PARTY, partyDirectory } from "../fixtures/parties";

const clock: Clock = { now: () => "2026-07-23T00:00:00.000Z" };

/** A controllable extractor for exercising InterpretUtterance's handling of proposals. */
const fakePort = (result: SlotExtractionResult | (() => never)): SlotExtractionPort => ({
  extract: async () => (typeof result === "function" ? result() : result),
});

async function wire(extractor: SlotExtractionPort, options?: InterpretOptions) {
  const directory = partyDirectory();
  const repo = new InMemoryIntentRepository();
  const audit = new InMemoryAuditLog();
  let n = 0;
  const ids: IdGenerator = { next: () => `intent-${++n}` };
  const apply = new ApplyAnswersUseCase(repo, clock, audit, directory);
  const start = new StartIntentUseCase(repo, clock, ids, audit);
  const interpret = new InterpretUtteranceUseCase(repo, extractor, apply, audit, clock, ids, directory, options);
  const { intentId } = await start.execute({ scenarioId: "register_payment", userId: "cfo" });
  return { repo, audit, interpret, intentId };
}

describe("InterpretUtterance", () => {
  it("fills confident proposals via the deterministic merge and asks for what remains", async () => {
    const { repo, interpret, intentId } = await wire(new StubSlotExtractionAdapter());

    const res = await interpret.execute({ intentId, utterance: "Paguei 1500.00 em BRL no dia 2026-07-23" });

    expect(res.accepted.sort()).toEqual(["amount", "currency", "occurredAt"]);
    expect(res.state?.kind).toBe("question"); // payee still missing
    const intent = await repo.findById(intentId);
    expect(intent?.answers.amount).toBe("1500.00");
    expect(intent?.answers.payee).toBeUndefined();
  });

  it("reaches ready when the proposals complete every required slot", async () => {
    const { interpret, intentId } = await wire(
      fakePort({
        slots: [
          { key: "payee", value: PARTY.ACME, confidence: 0.9 },
          { key: "amount", value: "1500.00", confidence: 0.9 },
          { key: "currency", value: "BRL", confidence: 0.9 },
          { key: "occurredAt", value: "2026-07-23", confidence: 0.9 },
          { key: "description", value: "", confidence: 0.9 },
        ],
      }),
    );

    const res = await interpret.execute({ intentId, utterance: "..." });
    expect(res.state?.kind).toBe("ready");
  });

  it("rejects an invalid proposed value without recording it — it becomes the next question", async () => {
    const { repo, interpret, intentId } = await wire(
      fakePort({ slots: [{ key: "amount", value: "abc", confidence: 0.95 }] }),
    );

    const res = await interpret.execute({ intentId, utterance: "amount is abc" });

    expect(res.rejected.map((r) => r.key)).toEqual(["amount"]);
    expect(res.accepted).toHaveLength(0);
    const intent = await repo.findById(intentId);
    expect(intent?.answers.amount).toBeUndefined();
  });

  it("ignores a proposal for an unknown slot key", async () => {
    const { repo, interpret, intentId } = await wire(
      fakePort({ slots: [{ key: "not_a_slot", value: "x", confidence: 0.9 }] }),
    );

    const res = await interpret.execute({ intentId, utterance: "..." });

    expect(res.rejected.map((r) => r.key)).toEqual(["not_a_slot"]);
    const intent = await repo.findById(intentId);
    expect(intent?.answers.not_a_slot).toBeUndefined();
  });

  it("holds back a low-confidence proposal instead of silently accepting it", async () => {
    const { repo, interpret, intentId } = await wire(
      fakePort({ slots: [{ key: "amount", value: "1500.00", confidence: 0.2 }] }),
    );

    const res = await interpret.execute({ intentId, utterance: "maybe 1500?" });

    expect(res.lowConfidence.map((p) => p.key)).toEqual(["amount"]);
    expect(res.accepted).toHaveLength(0);
    const intent = await repo.findById(intentId);
    expect(intent?.answers.amount).toBeUndefined();
  });

  it("does not overwrite an already-filled slot (extraction is fill-only)", async () => {
    const { repo, interpret, intentId } = await wire(new StubSlotExtractionAdapter());
    await interpret.execute({ intentId, utterance: "1500.00" }); // amount = 1500.00

    const res = await interpret.execute({ intentId, utterance: "2000.00" });

    expect(res.skipped).toContain("amount");
    const intent = await repo.findById(intentId);
    expect(intent?.answers.amount).toBe("1500.00");
  });

  it("degrades to asking the current question when the extractor throws", async () => {
    const { repo, audit, interpret, intentId } = await wire(
      fakePort(() => {
        throw new Error("model unavailable");
      }),
    );

    const res = await interpret.execute({ intentId, utterance: "1500.00 BRL" });

    expect(res.accepted).toHaveLength(0);
    expect(res.state?.kind).toBe("question"); // never crashes; still guiding the user
    const trail = await audit.listByIntent(intentId);
    expect(trail.some((e) => e.type === "extraction.failed")).toBe(true);
    const intent = await repo.findById(intentId);
    expect(Object.keys(intent?.answers ?? {})).toHaveLength(0);
  });

  it("records the utterance in the audit trail", async () => {
    const { audit, interpret, intentId } = await wire(new StubSlotExtractionAdapter());
    await interpret.execute({ intentId, utterance: "hello 1500.00" });
    const trail = await audit.listByIntent(intentId);
    expect(trail.some((e) => e.type === "utterance.received")).toBe(true);
  });

  it("throws on an unknown intent", async () => {
    const { interpret } = await wire(new StubSlotExtractionAdapter());
    await expect(interpret.execute({ intentId: "nope", utterance: "x" })).rejects.toThrow(/Unknown intent/);
  });

  describe("first-utterance classification (no intentId)", () => {
    it("classifies the scenario, creates the intent and merges slots in one turn", async () => {
      const { repo, interpret } = await wire(new StubSlotExtractionAdapter());

      const res = await interpret.execute({
        utterance: "pay my employees 1500.00 in BRL on 2026-07-23",
        userId: "cfo",
      });

      expect(res.scenarioId).toBe("register_payroll");
      expect(res.intentId).toBeDefined();
      expect(res.accepted).toEqual(expect.arrayContaining(["amount", "currency", "occurredAt"]));
      const intent = await repo.findById(res.intentId!);
      expect(intent?.scenarioId).toBe("register_payroll");
      expect(intent?.answers.amount).toBe("1500.00");
    });

    it("asks to clarify and creates nothing when the operation is ambiguous", async () => {
      const { repo, interpret } = await wire(new StubSlotExtractionAdapter());
      const before = (await repo.listByUser("cfo")).length;

      const res = await interpret.execute({ utterance: "I want to record a payment", userId: "cfo" });

      expect(res.clarification).toBeTruthy();
      expect(res.intentId).toBeUndefined();
      expect(res.scenarioId).toBeUndefined();
      expect(await repo.listByUser("cfo")).toHaveLength(before); // no new intent
    });

    it("rejects a guessed scenario id that is not a real scenario (never trusts it)", async () => {
      const { repo, interpret } = await wire(
        fakePort({ scenarioId: "not_a_scenario", slots: [{ key: "amount", value: "1500.00", confidence: 0.9 }] }),
      );
      const before = (await repo.listByUser("cfo")).length;

      const res = await interpret.execute({ utterance: "whatever", userId: "cfo" });

      expect(res.clarification).toBeTruthy();
      expect(res.intentId).toBeUndefined();
      expect(await repo.listByUser("cfo")).toHaveLength(before);
    });

    it("clarifies (creates nothing) when the extractor throws during classification", async () => {
      const { repo, interpret } = await wire(
        fakePort(() => {
          throw new Error("model unavailable");
        }),
      );
      const before = (await repo.listByUser("cfo")).length;

      const res = await interpret.execute({ utterance: "register payroll", userId: "cfo" });

      expect(res.clarification).toBeTruthy();
      expect(res.intentId).toBeUndefined();
      expect(await repo.listByUser("cfo")).toHaveLength(before);
    });

    it("requires a userId to start from an utterance", async () => {
      const { interpret } = await wire(new StubSlotExtractionAdapter());
      await expect(interpret.execute({ utterance: "register payroll" })).rejects.toThrow(/userId is required/);
    });
  });
});
