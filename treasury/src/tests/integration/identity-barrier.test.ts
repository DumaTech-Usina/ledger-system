import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryIntentRepository } from "../../infra/persistence/InMemoryIntentRepository";
import { InMemoryPartyRepository } from "../../infra/persistence/InMemoryPartyRepository";
import { InMemoryAuditLog } from "../../infra/audit/InMemoryAuditLog";
import { StubSlotExtractionAdapter } from "../../infra/nlp/StubSlotExtractionAdapter";
import { StartIntentUseCase } from "../../core/application/use-cases/StartIntent";
import { AdvanceDialogUseCase } from "../../core/application/use-cases/AdvanceDialog";
import { ApplyAnswersUseCase } from "../../core/application/use-cases/ApplyAnswers";
import { InterpretUtteranceUseCase } from "../../core/application/use-cases/InterpretUtterance";
import { PartyDirectory } from "../../core/application/services/PartyDirectory";
import { PartyIdentityState } from "../../core/domain/enums/PartyIdentityState";
import { ResolutionRule } from "../../core/domain/services/PartyResolution";
import type { Clock } from "../../core/application/ports/Clock";
import type { IdGenerator } from "../../core/application/ports/IdGenerator";
import { PARTY, PARTY_DISPLAY_NAMES, partyDirectory, emptyPartyDirectory } from "../fixtures/parties";

const clock: Clock = { now: () => "2026-08-03T00:00:00.000Z" };

function wire(directory = partyDirectory()) {
  const repo = new InMemoryIntentRepository();
  const audit = new InMemoryAuditLog();
  let n = 0;
  const ids: IdGenerator = { next: () => `intent-${++n}` };
  const apply = new ApplyAnswersUseCase(repo, clock, audit, directory);
  return {
    repo,
    audit,
    directory,
    start: new StartIntentUseCase(repo, clock, ids, audit),
    advance: new AdvanceDialogUseCase(repo, clock, audit, directory),
    apply,
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

let w: ReturnType<typeof wire>;
let intentId: string;

beforeEach(async () => {
  w = wire();
  ({ intentId } = await w.start.execute({ scenarioId: "register_payment", userId: "cfo" }));
});

describe("the ghost party is impossible", () => {
  it("never records free text as a party id", async () => {
    // A name nobody in the directory has. Before the barrier this string itself became the partyId
    // and, on submit, a counterparty inside an immutable event.
    const res = await w.advance.execute({ intentId, key: "payee", value: "Fornecedor Qualquer" });

    expect((await w.repo.findById(intentId))?.answers.payee).toBeUndefined();
    expect(res.identity?.resolution.kind).toBe("new");
  });

  it("keeps the intent short of ready, so nothing can be submitted", async () => {
    await w.advance.execute({ intentId, key: "payee", value: "Fornecedor Inventado" });
    await w.advance.execute({ intentId, key: "amount", value: "1500.00" });
    await w.advance.execute({ intentId, key: "currency", value: "BRL" });
    const last = await w.advance.execute({ intentId, key: "occurredAt", value: "2026-08-03" });

    // Every other slot is filled; the barrier holds purely because the party slot stayed blank.
    expect(last.state.kind).toBe("question");
    if (last.state.kind === "question") expect(last.state.slot.key).toBe("payee");
  });

  it("does not let four spellings become four counterparties", async () => {
    for (const spelling of ["ACME", "acme", "ACME Ltda", "Acme."]) {
      const fresh = await w.start.execute({ scenarioId: "register_payment", userId: "cfo" });
      await w.advance.execute({ intentId: fresh.intentId, key: "payee", value: spelling });
      const recorded = (await w.repo.findById(fresh.intentId))?.answers.payee;
      // Either it resolved to the one canonical id, or it was not recorded at all. What can never
      // happen is the spelling itself becoming an identity.
      expect(recorded === undefined || recorded === PARTY.ACME).toBe(true);
    }
  });

  it("holds even when the directory is empty", async () => {
    const empty = wire(emptyPartyDirectory());
    const { intentId: id } = await empty.start.execute({ scenarioId: "register_payment", userId: "cfo" });

    await empty.advance.execute({ intentId: id, key: "payee", value: PARTY.ACME });

    expect((await empty.repo.findById(id))?.answers.payee).toBeUndefined();
  });
});

describe("what does get recorded", () => {
  it("records the canonical id when the mention is the id itself", async () => {
    const res = await w.advance.execute({ intentId, key: "payee", value: PARTY.ACME });

    expect((await w.repo.findById(intentId))?.answers.payee).toBe(PARTY.ACME);
    if (res.identity?.resolution.kind === "resolved") {
      expect(res.identity.resolution.rule).toBe(ResolutionRule.EXACT_ID);
      expect(res.identity.resolution.needsConfirmation).toBe(false);
    }
  });

  it("records the id — not the mention — when the user says the name", async () => {
    await w.advance.execute({ intentId, key: "payee", value: PARTY_DISPLAY_NAMES[PARTY.BROKER] });

    // "Corretor Parceiro" was said; `party-broker` is what reaches the intent, and later the Ledger.
    expect((await w.repo.findById(intentId))?.answers.payee).toBe(PARTY.BROKER);
  });

  it("resolves a name typed in a different case or with a corporate suffix", async () => {
    await w.advance.execute({ intentId, key: "payee", value: "corretor parceiro ltda" });
    expect((await w.repo.findById(intentId))?.answers.payee).toBe(PARTY.BROKER);
  });

  it("leaves non-PARTY slots untouched and reports no identity for them", async () => {
    const res = await w.advance.execute({ intentId, key: "amount", value: "1500.00" });

    expect(res.identity).toBeUndefined();
    expect((await w.repo.findById(intentId))?.answers.amount).toBe("1500.00");
  });
});

describe("similarity is never promoted to identity", () => {
  it("does not record a near miss, and offers it for confirmation instead", async () => {
    // One edit away from "Corretor Parceiro".
    const res = await w.advance.execute({ intentId, key: "payee", value: "Corretor Parceira" });

    expect((await w.repo.findById(intentId))?.answers.payee).toBeUndefined();
    expect(res.identity?.resolution.kind).toBe("resolved");
    if (res.identity?.resolution.kind === "resolved") {
      expect(res.identity.resolution.needsConfirmation).toBe(true);
      expect(res.identity.resolution.partyId).toBe(PARTY.BROKER);
    }
  });

  it("surfaces every candidate when several are close, and picks none", async () => {
    const repo = new InMemoryPartyRepository();
    for (const [partyId, displayName] of [
      ["party-alfa-1", "Alfa Comercio"],
      ["party-alfa-2", "Alfa Comercial"],
    ]) {
      await repo.save({
        partyId,
        identityState: PartyIdentityState.IDENTIFIED,
        displayName,
        aliases: [],
        externalIds: [],
        attributes: {},
      });
    }

    const ambiguous = wire(new PartyDirectory(repo));
    const { intentId: id } = await ambiguous.start.execute({ scenarioId: "register_payment", userId: "cfo" });
    const res = await ambiguous.advance.execute({ intentId: id, key: "payee", value: "Alfa Comercia" });

    expect(res.identity?.resolution.kind).toBe("ambiguous");
    if (res.identity?.resolution.kind === "ambiguous") {
      expect(res.identity.resolution.candidates.map((c) => c.partyId).sort()).toEqual([
        "party-alfa-1",
        "party-alfa-2",
      ]);
    }
    expect((await ambiguous.repo.findById(id))?.answers.payee).toBeUndefined();
  });

  it("closes the loop when the user answers again with a canonical id", async () => {
    await w.advance.execute({ intentId, key: "payee", value: "Corretor Parceira" });
    expect((await w.repo.findById(intentId))?.answers.payee).toBeUndefined();

    // Picking a candidate is just answering with its id — rung 1 resolves it exactly. No extra
    // machinery is needed to confirm.
    await w.advance.execute({ intentId, key: "payee", value: PARTY.BROKER });
    expect((await w.repo.findById(intentId))?.answers.payee).toBe(PARTY.BROKER);
  });
});

describe("the raw mention is never lost", () => {
  it("keeps what the user actually said in the audit, with the rule that decided", async () => {
    await w.advance.execute({ intentId, key: "payee", value: "corretor parceiro ltda" });

    const entries = await w.audit.listByIntent(intentId);
    const identity = entries.find((e) => e.type === "identity.resolution");
    expect(identity?.detail).toContain("corretor parceiro ltda");
    expect(identity?.detail).toContain(PARTY.BROKER);
    expect(identity?.detail).toContain(ResolutionRule.EXACT_NAME);
  });

  it("records why an unknown mention was refused", async () => {
    await w.advance.execute({ intentId, key: "payee", value: "Empresa Inexistente" });

    const entries = await w.audit.listByIntent(intentId);
    const identity = entries.find((e) => e.type === "identity.resolution");
    expect(identity?.detail).toContain("Empresa Inexistente");
    expect(identity?.detail).toContain("no known party");
    // And no slot.answered was written for it.
    expect(entries.some((e) => e.type === "slot.answered" && e.detail === "payee")).toBe(false);
  });
});

describe("both write paths behave identically", () => {
  it("ApplyAnswers refuses an unresolved mention and reports it", async () => {
    const res = await w.apply.execute({
      intentId,
      answers: [
        { key: "payee", value: "Empresa Inexistente" },
        { key: "amount", value: "1500.00" },
      ],
    });

    const intent = await w.repo.findById(intentId);
    expect(intent?.answers.payee).toBeUndefined();
    expect(intent?.answers.amount).toBe("1500.00"); // the rest of the batch still merges
    expect(res.identity).toHaveLength(1);
    expect(res.identity[0]).toMatchObject({ slot: "payee" });
    expect(res.identity[0].resolution.kind).toBe("new");
  });

  it("ApplyAnswers records the canonical id for a resolvable mention", async () => {
    await w.apply.execute({ intentId, answers: [{ key: "payee", value: PARTY_DISPLAY_NAMES[PARTY.ACME] }] });
    expect((await w.repo.findById(intentId))?.answers.payee).toBe(PARTY.ACME);
  });
});

describe("natural language now grounds to real entities", () => {
  it("fills the party slot from an utterance — the knownParties field finally has a supplier", async () => {
    const res = await w.interpret.execute({
      intentId,
      utterance: "paguei ACME 1500.00 em BRL no dia 2026-08-03",
    });

    expect(res.accepted).toContain("payee");
    expect((await w.repo.findById(intentId))?.answers.payee).toBe(PARTY.ACME);
    expect(res.state?.kind).toBe("ready");
  });

  it("cannot invent a counterparty that does not exist", async () => {
    const res = await w.interpret.execute({
      intentId,
      utterance: "paguei Empresa Fantasma 1500.00 em BRL no dia 2026-08-03",
    });

    expect(res.accepted).not.toContain("payee");
    expect((await w.repo.findById(intentId))?.answers.payee).toBeUndefined();
    expect(res.state?.kind).toBe("question");
  });
});
