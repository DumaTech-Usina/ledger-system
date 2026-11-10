import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteExternalSignalRepository } from "../../../infra/persistence/SqliteExternalSignalRepository";
import { SqliteIntentRepository } from "../../../infra/persistence/SqliteIntentRepository";
import { ExternalSignal } from "../../../core/domain/entities/ExternalSignal";
import { Intent } from "../../../core/domain/entities/Intent";

/** REQ-260 and REQ-265 survive a restart: the signal, and the link from an intent to its origin. */
const file = () => join(mkdtempSync(join(tmpdir(), "signals-")), "operations.db");

const signal = (id: string) =>
  ExternalSignal.record({
    id,
    system: "insurance",
    kind: "eligibility",
    recordId: "5177",
    fields: { policyId: "5177", usinaValue: "128.77", payout: "77.26", eligibleAt: "2026-10-21" },
    contentHash: "a".repeat(64),
    receivedAt: "2026-11-09T12:00:00.000Z",
    recordedBy: "cfo",
    proposals: [{ fact: "commission_obligation", sourceReference: "seguro:apolice:5177:elegibilidade", intentId: "i-1", reused: false }],
  });

describe("SQLite — sinais externos", () => {
  it("guarda e devolve o sinal inteiro, o mais recente primeiro, depois de reabrir", async () => {
    const path = file();
    const first = new SqliteExternalSignalRepository(path);
    await first.add(signal("s-1"));
    await first.add(signal("s-2"));
    first.close();

    const reopened = new SqliteExternalSignalRepository(path);
    const all = await reopened.list();
    expect(all.map((s) => s.id)).toEqual(["s-2", "s-1"]);
    expect(all[1].toJSON()).toEqual(signal("s-1").toJSON());
    reopened.close();
  });

  it("um sinal não é regravado", async () => {
    const repo = new SqliteExternalSignalRepository(file());
    await repo.add(signal("s-1"));
    await expect(repo.add(signal("s-1"))).rejects.toThrow();
    repo.close();
  });

  it("a intenção guarda a origem e é achada pela referência", async () => {
    const path = file();
    const repo = new SqliteIntentRepository(path);
    const origin = { signalId: "s-1", sourceReference: "seguro:apolice:5177:elegibilidade", confidence: "medium" as const };
    await repo.save(Intent.start("i-1", "register_obligation_recognition", "cfo", "2026-11-09T12:00:00.000Z", {}, origin));
    await repo.save(Intent.start("i-2", "register_obligation_recognition", "cfo", "2026-11-09T12:00:00.000Z"));
    repo.close();

    const reopened = new SqliteIntentRepository(path);
    const found = await reopened.findByOriginReference("seguro:apolice:5177:elegibilidade");
    expect(found.map((i) => i.id)).toEqual(["i-1"]);
    expect(found[0].origin).toEqual(origin);
    expect((await reopened.findById("i-2"))!.origin).toBeUndefined();
    reopened.close();
  });
});
