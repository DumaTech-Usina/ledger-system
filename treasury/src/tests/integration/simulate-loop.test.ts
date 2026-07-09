import { describe, it, expect } from "vitest";
import { InMemoryLedgerSimulator } from "../../infra/ledger-sim/InMemoryLedgerSimulator";
import { InMemoryIntentRepository } from "../../infra/persistence/InMemoryIntentRepository";
import { InMemoryAuditLog } from "../../infra/audit/InMemoryAuditLog";
import { CandidateMapper } from "../../core/application/services/CandidateMapper";
import { StartIntentUseCase } from "../../core/application/use-cases/StartIntent";
import { AdvanceDialogUseCase } from "../../core/application/use-cases/AdvanceDialog";
import { SubmitIntentUseCase } from "../../core/application/use-cases/SubmitIntent";
import { GetTreasuryDashboardUseCase } from "../../core/application/use-cases/GetTreasuryDashboard";
import type { Clock } from "../../core/application/ports/Clock";
import type { IdGenerator } from "../../core/application/ports/IdGenerator";

const clock: Clock = { now: () => "2026-07-09T00:00:00.000Z" };

describe("simulate mode — full create → dashboard loop", () => {
  it("an accepted intent shows up in the dashboard and moves cash-in", async () => {
    const simulator = new InMemoryLedgerSimulator(); // one fake Ledger for submit + reads
    const repo = new InMemoryIntentRepository();
    const audit = new InMemoryAuditLog();
    const mapper = new CandidateMapper("party-usina");
    let n = 0;
    const ids: IdGenerator = { next: () => `intent-${++n}` };

    const start = new StartIntentUseCase(repo, clock, ids, audit);
    const advance = new AdvanceDialogUseCase(repo, clock, audit);
    const submit = new SubmitIntentUseCase(repo, mapper, simulator, audit, clock);
    const dashboard = new GetTreasuryDashboardUseCase(simulator, "party-usina");

    const before = Number((await dashboard.execute()).cashPosition!.totalCashIn);

    // Create an "Add a charge" (cash_in) intent end-to-end.
    const { intentId } = await start.execute({ scenarioId: "add_charge", userId: "u1" });
    await advance.execute({ intentId, key: "counterparty", value: "ACME Foods" });
    await advance.execute({ intentId, key: "amount", value: "5000.00" });
    await advance.execute({ intentId, key: "currency", value: "BRL" });
    await advance.execute({ intentId, key: "occurredAt", value: "2026-07-09" });
    const result = await submit.execute(intentId);
    expect(result.status).toBe("accepted");

    const after = await dashboard.execute();
    // Cash-in grew by exactly the charge amount…
    expect(Number(after.cashPosition!.totalCashIn) - before).toBe(5000);
    // …and the movement is visible, linked back to the intent.
    expect(after.movements!.some((m) => m.sourceReference === `intent:${intentId}`)).toBe(true);
    expect(after.positions!.some((p) => p.objectId === `intent:${intentId}`)).toBe(true);
  });
});
