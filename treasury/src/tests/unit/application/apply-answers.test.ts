import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryIntentRepository } from "../../../infra/persistence/InMemoryIntentRepository";
import { InMemoryAuditLog } from "../../../infra/audit/InMemoryAuditLog";
import { StartIntentUseCase } from "../../../core/application/use-cases/StartIntent";
import { ApplyAnswersUseCase } from "../../../core/application/use-cases/ApplyAnswers";
import { IntentStatus } from "../../../core/domain/enums/IntentStatus";
import type { Clock } from "../../../core/application/ports/Clock";
import type { IdGenerator } from "../../../core/application/ports/IdGenerator";
import { PARTY, partyDirectory } from "../../fixtures/parties";

const clock: Clock = { now: () => "2026-07-23T00:00:00.000Z" };

function wire() {
  const directory = partyDirectory();
  const repo = new InMemoryIntentRepository();
  const audit = new InMemoryAuditLog();
  let n = 0;
  const ids: IdGenerator = { next: () => `intent-${++n}` };
  return {
    repo,
    audit,
    start: new StartIntentUseCase(repo, clock, ids, audit),
    apply: new ApplyAnswersUseCase(repo, clock, audit, directory),
  };
}

// register_payment slots: payee, amount, currency (BRL|USD), occurredAt, description(optional)
async function startPayment(w: ReturnType<typeof wire>) {
  const { intentId } = await w.start.execute({ scenarioId: "register_payment", userId: "cfo" });
  return intentId;
}

describe("ApplyAnswers — deterministic multi-slot merge", () => {
  let w: ReturnType<typeof wire>;
  beforeEach(() => {
    w = wire();
  });

  it("records every valid answer in one batch and reports the next question", async () => {
    const intentId = await startPayment(w);

    const res = await w.apply.execute({
      intentId,
      answers: [
        { key: "payee", value: PARTY.ACME },
        { key: "amount", value: "1500.00" },
      ],
    });

    expect(res.rejected).toHaveLength(0);
    expect(res.skipped).toHaveLength(0);
    expect(res.state.kind).toBe("question"); // currency still required

    const intent = await w.repo.findById(intentId);
    expect(intent?.answers.payee).toBe(PARTY.ACME);
    expect(intent?.answers.amount).toBe("1500.00");
  });

  it("reaches ready and marks the intent awaiting confirmation when all required slots are filled", async () => {
    const intentId = await startPayment(w);

    const res = await w.apply.execute({
      intentId,
      answers: [
        { key: "payee", value: PARTY.ACME },
        { key: "amount", value: "1500.00" },
        { key: "currency", value: "BRL" },
        { key: "occurredAt", value: "2026-07-23" },
        { key: "description", value: "" },
      ],
    });

    expect(res.state.kind).toBe("ready");
    const intent = await w.repo.findById(intentId);
    expect(intent?.status).toBe(IntentStatus.AWAITING_CONFIRMATION);
  });

  it("records the valid subset and rejects the invalid ones individually", async () => {
    const intentId = await startPayment(w);

    const res = await w.apply.execute({
      intentId,
      answers: [
        { key: "payee", value: PARTY.ACME },
        { key: "amount", value: "abc" }, // invalid money
        { key: "currency", value: "GBP" }, // not an allowed choice
      ],
    });

    expect(res.rejected.map((r) => r.key).sort()).toEqual(["amount", "currency"]);

    const intent = await w.repo.findById(intentId);
    expect(intent?.answers.payee).toBe(PARTY.ACME); // valid one recorded
    expect(intent?.answers.amount).toBeUndefined(); // invalid never persisted
    expect(intent?.answers.currency).toBeUndefined();
  });

  it("reports an unknown slot key without throwing and without recording it", async () => {
    const intentId = await startPayment(w);

    const res = await w.apply.execute({
      intentId,
      answers: [
        { key: "payee", value: PARTY.ACME },
        { key: "not_a_slot", value: "x" },
      ],
    });

    expect(res.rejected).toHaveLength(1);
    expect(res.rejected[0].key).toBe("not_a_slot");

    const intent = await w.repo.findById(intentId);
    expect(intent?.answers.payee).toBe(PARTY.ACME);
    expect(intent?.answers.not_a_slot).toBeUndefined();
  });

  it("is a no-op on an empty batch and returns the current state", async () => {
    const intentId = await startPayment(w);

    const res = await w.apply.execute({ intentId, answers: [] });

    expect(res.rejected).toHaveLength(0);
    expect(res.skipped).toHaveLength(0);
    expect(res.state.kind).toBe("question");
  });

  describe("overwrite policy", () => {
    it("skips an already-filled slot in the default fill mode", async () => {
      const intentId = await startPayment(w);
      await w.apply.execute({ intentId, answers: [{ key: "payee", value: PARTY.ACME }] });

      const res = await w.apply.execute({ intentId, answers: [{ key: "payee", value: PARTY.OTHER }] });

      expect(res.skipped).toEqual(["payee"]);
      const intent = await w.repo.findById(intentId);
      expect(intent?.answers.payee).toBe(PARTY.ACME); // unchanged
    });

    it("overwrites an already-filled slot in edit mode and re-validates", async () => {
      const intentId = await startPayment(w);
      await w.apply.execute({ intentId, answers: [{ key: "payee", value: PARTY.ACME }] });

      const res = await w.apply.execute({ intentId, answers: [{ key: "payee", value: PARTY.OTHER }], mode: "edit" });

      expect(res.skipped).toHaveLength(0);
      expect(res.rejected).toHaveLength(0);
      const intent = await w.repo.findById(intentId);
      expect(intent?.answers.payee).toBe(PARTY.OTHER);
    });

    it("rejects an invalid overwrite in edit mode without changing the stored value", async () => {
      const intentId = await startPayment(w);
      await w.apply.execute({ intentId, answers: [{ key: "amount", value: "1500.00" }] });

      const res = await w.apply.execute({ intentId, answers: [{ key: "amount", value: "abc" }], mode: "edit" });

      expect(res.rejected.map((r) => r.key)).toEqual(["amount"]);
      const intent = await w.repo.findById(intentId);
      expect(intent?.answers.amount).toBe("1500.00"); // preserved
    });
  });

  it("throws on an unknown intent", async () => {
    await expect(w.apply.execute({ intentId: "nope", answers: [] })).rejects.toThrow(/Unknown intent/);
  });
});
