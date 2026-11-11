import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ExternalSignal } from "../../core/domain/entities/ExternalSignal";
import { Intent } from "../../core/domain/entities/Intent";
import { ListExternalSignalsUseCase } from "../../core/application/use-cases/ListExternalSignals";
import type { ExternalSignalRepository } from "../../core/application/repositories/ExternalSignalRepository";
import { InMemoryExternalSignalRepository } from "../../infra/persistence/InMemoryExternalSignalRepository";
import { InMemoryIntentRepository } from "../../infra/persistence/InMemoryIntentRepository";
import { SqliteExternalSignalRepository } from "../../infra/persistence/SqliteExternalSignalRepository";

/** The signals feed: newest first, paged by cursor, by default only what still needs the user. */
const NOW = "2026-11-09T12:00:00.000Z";

async function seed(signals: ExternalSignalRepository, intents: InMemoryIntentRepository, n: number, open: (i: number) => boolean) {
  for (let i = 1; i <= n; i++) {
    const intent = Intent.start(`i-${i}`, "register_obligation_recognition", "cfo", NOW);
    // Intents start gathering (open); the rest are driven to a closed state.
    if (!open(i)) {
      intent.markAwaitingConfirmation(NOW);
      intent.markSubmitted(NOW);
      intent.markAccepted("evt-" + i, NOW);
    }
    await intents.save(intent);
    await signals.add(
      ExternalSignal.record({
        id: `s-${i}`,
        system: "insurance",
        kind: "eligibility",
        recordId: String(i),
        fields: { policyId: String(i) },
        contentHash: "a".repeat(64),
        receivedAt: NOW,
        recordedBy: "cfo",
        proposals: [{ fact: "commission_obligation", sourceReference: `ref-${i}`, intentId: `i-${i}`, reused: false }],
      }),
    );
  }
}

const suites: [string, () => ExternalSignalRepository][] = [
  ["em memória", () => new InMemoryExternalSignalRepository()],
  ["SQLite", () => new SqliteExternalSignalRepository(join(mkdtempSync(join(tmpdir(), "signals-page-")), "operations.db"))],
];

describe.each(suites)("paginação dos sinais — %s", (_name, makeRepo) => {
  let signals: ExternalSignalRepository;
  let intents: InMemoryIntentRepository;
  let list: ListExternalSignalsUseCase;

  beforeEach(() => {
    signals = makeRepo();
    intents = new InMemoryIntentRepository();
    list = new ListExternalSignalsUseCase(signals, intents);
  });

  it("devolve do mais novo para o mais antigo e continua pelo cursor sem repetir", async () => {
    await seed(signals, intents, 7, () => true);

    const first = await list.page({ limit: 3, filter: "all" });
    expect(first.signals.map((s) => s.id)).toEqual(["s-7", "s-6", "s-5"]);
    expect(first.nextCursor).not.toBeNull();

    const second = await list.page({ limit: 3, filter: "all", before: first.nextCursor! });
    expect(second.signals.map((s) => s.id)).toEqual(["s-4", "s-3", "s-2"]);

    const third = await list.page({ limit: 3, filter: "all", before: second.nextCursor! });
    expect(third.signals.map((s) => s.id)).toEqual(["s-1"]);
    expect(third.nextCursor).toBeNull();
  });

  it("por padrão só traz o que precisa de ação, mesmo com muitos já resolvidos no meio", async () => {
    // 250 signals; only 1, 120 and 250 still wait for the user.
    await seed(signals, intents, 250, (i) => [1, 120, 250].includes(i));

    const page = await list.page({ limit: 2 });
    expect(page.signals.map((s) => s.id)).toEqual(["s-250", "s-120"]);

    const next = await list.page({ limit: 2, before: page.nextCursor! });
    expect(next.signals.map((s) => s.id)).toEqual(["s-1"]);
    expect(next.nextCursor).toBeNull();
  });

  it("o filtro 'all' traz também os já registrados no Ledger", async () => {
    await seed(signals, intents, 4, (i) => i === 4);

    expect((await list.page({})).signals.map((s) => s.id)).toEqual(["s-4"]);
    expect((await list.page({ filter: "all" })).signals).toHaveLength(4);
  });

  it("o estado vem da intenção a cada leitura: o que foi resolvido sai do filtro", async () => {
    await seed(signals, intents, 2, () => true);
    expect((await list.page({})).signals).toHaveLength(2);

    const intent = (await intents.findById("i-2"))!;
    intent.markAwaitingConfirmation(NOW);
    intent.markSubmitted(NOW);
    intent.markAccepted("evt-2", NOW);
    await intents.save(intent);

    expect((await list.page({})).signals.map((s) => s.id)).toEqual(["s-1"]);
  });

  it("limita o tamanho da página e ignora cursor inválido", async () => {
    await seed(signals, intents, 3, () => true);

    expect((await list.page({ limit: 0, filter: "all" })).signals).toHaveLength(3);
    expect((await list.page({ limit: 100000, filter: "all" })).signals).toHaveLength(3);
    expect(await list.page({ before: "abc", filter: "all" })).toEqual({ signals: [], nextCursor: null });
  });

  it("conta as propostas abertas em todos os sinais, não só na primeira página", async () => {
    await seed(signals, intents, 230, (i) => i % 50 === 0);

    expect(await list.countOpenProposals()).toBe(4);
  });

  it("sem sinais, a página vem vazia e sem cursor", async () => {
    expect(await list.page({})).toEqual({ signals: [], nextCursor: null });
  });
});
