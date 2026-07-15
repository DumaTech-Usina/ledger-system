import { describe, it, expect } from "vitest";
import { InMemoryIntentRepository } from "../../infra/persistence/InMemoryIntentRepository";
import { InMemoryAuditLog } from "../../infra/audit/InMemoryAuditLog";
import { StartIntentUseCase } from "../../core/application/use-cases/StartIntent";
import { AdvanceDialogUseCase } from "../../core/application/use-cases/AdvanceDialog";
import { IntentStatus } from "../../core/domain/enums/IntentStatus";
import type { Clock } from "../../core/application/ports/Clock";
import type { IdGenerator } from "../../core/application/ports/IdGenerator";

const clock: Clock = { now: () => "2026-07-09T00:00:00.000Z" };

function wire() {
  const repo = new InMemoryIntentRepository();
  const audit = new InMemoryAuditLog();
  let n = 0;
  const ids: IdGenerator = { next: () => `intent-${++n}` };
  return {
    repo,
    audit,
    start: new StartIntentUseCase(repo, clock, ids, audit),
    advance: new AdvanceDialogUseCase(repo, clock, audit),
  };
}

describe("conversation flow (register_payment)", () => {
  it("walks the guided dialog to ready and marks the intent awaiting confirmation", async () => {
    const { repo, start, advance } = wire();

    const { intentId, state } = await start.execute({ scenarioId: "register_payment", userId: "cfo" });
    expect(state.kind).toBe("question");

    await advance.execute({ intentId, key: "payee", value: "ACME" });
    await advance.execute({ intentId, key: "amount", value: "1500.00" });
    await advance.execute({ intentId, key: "currency", value: "BRL" });
    const last = await advance.execute({ intentId, key: "occurredAt", value: "2026-07-09" });

    expect(last.state.kind).toBe("ready");
    const intent = await repo.findById(intentId);
    expect(intent?.status).toBe(IntentStatus.AWAITING_CONFIRMATION);
  });

  it("rejects an invalid amount without recording it", async () => {
    const { repo, start, advance } = wire();
    const { intentId } = await start.execute({ scenarioId: "register_payment", userId: "cfo" });

    const res = await advance.execute({ intentId, key: "amount", value: "abc" });
    expect(res.error).toBeTruthy();

    const intent = await repo.findById(intentId);
    expect(intent?.answers.amount).toBeUndefined();
  });

  it("rejects an unknown scenario", async () => {
    const { start } = wire();
    await expect(start.execute({ scenarioId: "nope", userId: "cfo" })).rejects.toThrow(/Unknown scenario/);
  });
});
