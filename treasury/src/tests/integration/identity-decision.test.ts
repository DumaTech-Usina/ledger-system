import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryIntentRepository } from "../../infra/persistence/InMemoryIntentRepository";
import { InMemoryPartyRepository } from "../../infra/persistence/InMemoryPartyRepository";
import { InMemoryAuditLog } from "../../infra/audit/InMemoryAuditLog";
import { StartIntentUseCase } from "../../core/application/use-cases/StartIntent";
import { AdvanceDialogUseCase } from "../../core/application/use-cases/AdvanceDialog";
import { DecideIdentityUseCase } from "../../core/application/use-cases/DecideIdentity";
import { PartyDirectory } from "../../core/application/services/PartyDirectory";
import { PartyIdentityState } from "../../core/domain/enums/PartyIdentityState";
import { IdentityDecisionKind } from "../../core/domain/value-objects/IdentityDecision";
import type { Clock } from "../../core/application/ports/Clock";
import type { IdGenerator } from "../../core/application/ports/IdGenerator";

const clock: Clock = { now: () => "2026-08-03T00:00:00.000Z" };

function wire() {
  const intents = new InMemoryIntentRepository();
  const parties = new InMemoryPartyRepository();
  const audit = new InMemoryAuditLog();
  const directory = new PartyDirectory(parties);
  let n = 0;
  const ids: IdGenerator = { next: () => `0000-${++n}` };
  return {
    intents,
    parties,
    audit,
    directory,
    start: new StartIntentUseCase(intents, clock, ids, audit),
    advance: new AdvanceDialogUseCase(intents, clock, audit, directory),
    decide: new DecideIdentityUseCase(intents, parties, clock, ids, audit),
  };
}

let w: ReturnType<typeof wire>;

beforeEach(() => {
  w = wire();
});

/** register_payment: outgoing, so its payee may NOT be declared unidentifiable. */
async function startPayment() {
  return (await w.start.execute({ scenarioId: "register_payment", userId: "cfo" })).intentId;
}

/** register_commission_received: money arriving, so its payer MAY be. */
async function startCommission() {
  return (await w.start.execute({ scenarioId: "register_commission_received", userId: "cfo" })).intentId;
}

describe("creating an identity is a distinct act", () => {
  it("mints a canonical id and records it in the slot", async () => {
    const intentId = await startPayment();

    const { decision, state } = await w.decide.execute({
      intentId,
      slot: "payee",
      kind: IdentityDecisionKind.CREATE,
      mention: "Fornecedor Novo",
      userId: "cfo",
    });

    expect(decision.partyId).toMatch(/^party-/);
    expect((await w.intents.findById(intentId))?.answers.payee).toBe(decision.partyId);
    expect(state.kind).toBe("question"); // the other slots are still open
  });

  it("asks for one attribute only — the name the user already said", async () => {
    const intentId = await startPayment();
    const { decision } = await w.decide.execute({
      intentId,
      slot: "payee",
      kind: IdentityDecisionKind.CREATE,
      mention: "Fornecedor Novo",
      userId: "cfo",
    });

    const party = await w.parties.findById(decision.partyId);
    expect(party?.displayName).toBe("Fornecedor Novo");
    expect(party?.identityState).toBe(PartyIdentityState.IDENTIFIED);
    // Nothing else is demanded: no document, no type. Enrichment is never a precondition for a fact.
    expect(party?.attributes).toEqual({});
  });

  it("refuses to create from nothing", async () => {
    const intentId = await startPayment();
    await expect(
      w.decide.execute({ intentId, slot: "payee", kind: IdentityDecisionKind.CREATE, userId: "cfo" }),
    ).rejects.toThrow(/nothing to record/i);
  });

  it("makes the new party immediately resolvable, so the second mention costs no turn", async () => {
    const intentId = await startPayment();
    await w.decide.execute({
      intentId,
      slot: "payee",
      kind: IdentityDecisionKind.CREATE,
      mention: "Fornecedor Novo",
      userId: "cfo",
    });

    const second = await startPayment();
    await w.advance.execute({ intentId: second, key: "payee", value: "fornecedor novo ltda" });

    const recorded = (await w.intents.findById(second))?.answers.payee;
    expect(recorded).toMatch(/^party-/);
  });
});

describe("the unidentifiable exception is granted per slot", () => {
  it("is admitted where the scenario declares it", async () => {
    const intentId = await startCommission();

    const { decision } = await w.decide.execute({
      intentId,
      slot: "payer",
      kind: IdentityDecisionKind.UNIDENTIFIABLE,
      justification: "Transferência recebida sem identificação do remetente.",
      userId: "cfo",
    });

    const party = await w.parties.findById(decision.partyId);
    expect(party?.identityState).toBe(PartyIdentityState.UNIDENTIFIABLE);
    expect((await w.intents.findById(intentId))?.answers.payer).toBe(decision.partyId);
  });

  it("is refused where the scenario does not declare it", async () => {
    const intentId = await startPayment();
    await expect(
      w.decide.execute({
        intentId,
        slot: "payee",
        kind: IdentityDecisionKind.UNIDENTIFIABLE,
        justification: "não sei",
        userId: "cfo",
      }),
    ).rejects.toThrow(/does not admit/i);
  });

  it("requires a justification", async () => {
    const intentId = await startCommission();
    await expect(
      w.decide.execute({
        intentId,
        slot: "payer",
        kind: IdentityDecisionKind.UNIDENTIFIABLE,
        justification: "   ",
        userId: "cfo",
      }),
    ).rejects.toThrow(/justification/i);
  });

  it("still issues a PartyId — the Ledger rejects a party without one", async () => {
    const intentId = await startCommission();
    const { decision } = await w.decide.execute({
      intentId,
      slot: "payer",
      kind: IdentityDecisionKind.UNIDENTIFIABLE,
      justification: "Remetente não informado pelo banco.",
      userId: "cfo",
    });

    expect(decision.partyId).toMatch(/^party-/);
    expect((await w.intents.findById(intentId))?.answers.payer).toBe(decision.partyId);
  });

  it("labels it as unknown rather than guessing who it was", async () => {
    const intentId = await startCommission();
    const { decision } = await w.decide.execute({
      intentId,
      slot: "payer",
      kind: IdentityDecisionKind.UNIDENTIFIABLE,
      justification: "Sem identificação.",
      userId: "cfo",
    });

    expect((await w.parties.findById(decision.partyId))?.displayName).toBe("Contraparte não identificada");
  });
});

describe("every issued id traces to a decision", () => {
  it("records the author, the moment and the raw mention", async () => {
    const intentId = await startPayment();
    const { decision } = await w.decide.execute({
      intentId,
      slot: "payee",
      kind: IdentityDecisionKind.CREATE,
      mention: "Fornecedor Novo",
      userId: "cfo",
    });

    expect(decision).toMatchObject({
      kind: IdentityDecisionKind.CREATE,
      slot: "payee",
      mention: "Fornecedor Novo",
      decidedBy: "cfo",
      decidedAt: "2026-08-03T00:00:00.000Z",
      intentId,
    });

    const entry = (await w.audit.listByIntent(intentId)).find((e) => e.type === "identity.decision");
    expect(entry?.detail).toContain("Fornecedor Novo");
    expect(entry?.detail).toContain(decision.partyId);
    expect(entry?.detail).toContain("cfo");
  });

  it("keeps the justification in the audit trail", async () => {
    const intentId = await startCommission();
    await w.decide.execute({
      intentId,
      slot: "payer",
      kind: IdentityDecisionKind.UNIDENTIFIABLE,
      justification: "Remetente não informado pelo banco.",
      userId: "cfo",
    });

    const entry = (await w.audit.listByIntent(intentId)).find((e) => e.type === "identity.decision");
    expect(entry?.detail).toContain("Remetente não informado pelo banco.");
  });

  it("refuses a slot that holds no identity", async () => {
    const intentId = await startPayment();
    await expect(
      w.decide.execute({
        intentId,
        slot: "amount",
        kind: IdentityDecisionKind.CREATE,
        mention: "1500.00",
        userId: "cfo",
      }),
    ).rejects.toThrow(/does not hold an identity/i);
  });

  it("issues nothing when the decision is refused", async () => {
    const intentId = await startPayment();
    await expect(
      w.decide.execute({ intentId, slot: "payee", kind: IdentityDecisionKind.CREATE, userId: "cfo" }),
    ).rejects.toThrow();

    expect(await w.parties.findAll()).toEqual([]);
  });
});

describe("the decision closes the dialog", () => {
  it("reaches ready once the created party fills the last open slot", async () => {
    const intentId = await startPayment();
    await w.advance.execute({ intentId, key: "amount", value: "1500.00" });
    await w.advance.execute({ intentId, key: "currency", value: "BRL" });
    await w.advance.execute({ intentId, key: "occurredAt", value: "2026-08-03" });
    await w.advance.execute({ intentId, key: "description", value: "" });

    const { state } = await w.decide.execute({
      intentId,
      slot: "payee",
      kind: IdentityDecisionKind.CREATE,
      mention: "Fornecedor Novo",
      userId: "cfo",
    });

    expect(state.kind).toBe("ready");
  });
});
