import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryIntentRepository } from "../../infra/persistence/InMemoryIntentRepository";
import { InMemoryPartyRepository } from "../../infra/persistence/InMemoryPartyRepository";
import { InMemoryAuditLog } from "../../infra/audit/InMemoryAuditLog";
import { StubCandidateSubmissionAdapter } from "../../infra/submission/StubCandidateSubmissionAdapter";
import { CandidateMapper } from "../../core/application/services/CandidateMapper";
import { PartyDirectory } from "../../core/application/services/PartyDirectory";
import { StartIntentUseCase } from "../../core/application/use-cases/StartIntent";
import { AdvanceDialogUseCase } from "../../core/application/use-cases/AdvanceDialog";
import { DecideIdentityUseCase } from "../../core/application/use-cases/DecideIdentity";
import { PreviewIntentUseCase } from "../../core/application/use-cases/PreviewIntent";
import { SubmitIntentUseCase } from "../../core/application/use-cases/SubmitIntent";
import { RecordPartyAttributeUseCase } from "../../core/application/use-cases/RecordPartyAttribute";
import { ListIncompletePartiesUseCase } from "../../core/application/use-cases/ListIncompleteParties";
import { AttributeState } from "../../core/domain/enums/AttributeState";
import { AttributeSource } from "../../core/domain/enums/AttributeSource";
import { PartyIdentityState } from "../../core/domain/enums/PartyIdentityState";
import { IdentityDecisionKind } from "../../core/domain/value-objects/IdentityDecision";
import { PartyAttributeKey } from "../../core/domain/value-objects/PartyAttribute";
import { IntentStatus } from "../../core/domain/enums/IntentStatus";
import type { Clock } from "../../core/application/ports/Clock";
import type { IdGenerator } from "../../core/application/ports/IdGenerator";
import { PARTY } from "../fixtures/parties";

const clock: Clock = { now: () => "2026-08-03T00:00:00.000Z" };

function wire() {
  const intents = new InMemoryIntentRepository();
  const parties = new InMemoryPartyRepository();
  const audit = new InMemoryAuditLog();
  const directory = new PartyDirectory(parties);
  const mapper = new CandidateMapper(PARTY.USINA);
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
    preview: new PreviewIntentUseCase(intents, mapper, directory),
    submit: new SubmitIntentUseCase(intents, mapper, new StubCandidateSubmissionAdapter(), audit, clock, directory),
    enrich: new RecordPartyAttributeUseCase(parties, clock, audit),
    incomplete: new ListIncompletePartiesUseCase(directory),
  };
}

let w: ReturnType<typeof wire>;

/** A complete payment against a party created in this very conversation. */
async function readyPayment(): Promise<{ intentId: string; partyId: string }> {
  const { intentId } = await w.start.execute({ scenarioId: "register_payment", userId: "cfo" });
  const { decision } = await w.decide.execute({
    intentId,
    slot: "payee",
    kind: IdentityDecisionKind.CREATE,
    mention: "Fornecedor Novo",
    userId: "cfo",
  });
  await w.advance.execute({ intentId, key: "amount", value: "1500.00" });
  await w.advance.execute({ intentId, key: "currency", value: "BRL" });
  await w.advance.execute({ intentId, key: "occurredAt", value: "2026-08-03" });
  await w.advance.execute({ intentId, key: "description", value: "" });
  return { intentId, partyId: decision.partyId };
}

beforeEach(() => {
  w = wire();
});

describe("display: the name, never the raw id", () => {
  it("returns a display name for every party in the candidate", async () => {
    const { intentId, partyId } = await readyPayment();
    const preview = await w.preview.execute(intentId);

    expect(preview.partyNames[partyId]).toBe("Fornecedor Novo");
    expect(preview.partyNames[PARTY.USINA]).toBeUndefined(); // the usina is not in the Directory here
  });

  it("keeps the candidate itself free of names — only the id crosses to the Ledger", async () => {
    const { intentId, partyId } = await readyPayment();
    const preview = await w.preview.execute(intentId);

    expect(preview.candidate.parties.map((p) => p.partyId)).toContain(partyId);
    expect(JSON.stringify(preview.candidate)).not.toContain("Fornecedor Novo");
  });
});

describe("enrichment is offered only after the fact is complete", () => {
  it("cannot be reached before ready — preview refuses to run", async () => {
    const { intentId } = await w.start.execute({ scenarioId: "register_payment", userId: "cfo" });
    await expect(w.preview.execute(intentId)).rejects.toThrow(/not ready/i);
  });

  it("offers exactly one question for a party with a gap", async () => {
    const { intentId, partyId } = await readyPayment();
    const preview = await w.preview.execute(intentId);

    expect(preview.enrichment).toMatchObject({ partyId, displayName: "Fornecedor Novo" });
    expect(preview.enrichment?.attribute).toBe(PartyAttributeKey.DOCUMENT);
  });

  it("offers nothing once the gaps are closed", async () => {
    const { intentId, partyId } = await readyPayment();
    await w.enrich.execute({ partyId, key: PartyAttributeKey.DOCUMENT, value: "12345678000199", userId: "cfo" });
    await w.enrich.execute({ partyId, key: PartyAttributeKey.TYPE, value: "supplier", userId: "cfo" });

    expect((await w.preview.execute(intentId)).enrichment).toBeUndefined();
  });

  it("never asks a party whose identity itself is unknown", async () => {
    const { intentId } = await w.start.execute({ scenarioId: "register_commission_received", userId: "cfo" });
    await w.decide.execute({
      intentId,
      slot: "payer",
      kind: IdentityDecisionKind.UNIDENTIFIABLE,
      justification: "Remetente não informado.",
      userId: "cfo",
    });
    await w.advance.execute({ intentId, key: "amount", value: "1000.00" });
    await w.advance.execute({ intentId, key: "currency", value: "BRL" });
    await w.advance.execute({ intentId, key: "occurredAt", value: "2026-08-03" });
    await w.advance.execute({ intentId, key: "description", value: "" });

    expect((await w.preview.execute(intentId)).enrichment).toBeUndefined();
  });
});

describe("enrichment can never hold a fact back", () => {
  it("submits successfully with every gap still open", async () => {
    const { intentId } = await readyPayment();
    const result = await w.submit.execute(intentId);

    expect(result.intentStatus).toBe(IntentStatus.ACCEPTED);
  });

  it("a broken enrichment path does not affect the submission", async () => {
    const { intentId, partyId } = await readyPayment();

    // Induce a failure on the enrichment path.
    await expect(
      w.enrich.execute({ partyId, key: "nao_existe", value: "x", userId: "cfo" }),
    ).rejects.toThrow();

    expect((await w.submit.execute(intentId)).intentStatus).toBe(IntentStatus.ACCEPTED);
  });
});

describe("answering, or refusing to answer", () => {
  it("records a value with the user as its provenance", async () => {
    const { partyId } = await readyPayment();
    await w.enrich.execute({
      partyId,
      key: PartyAttributeKey.DOCUMENT,
      value: " 12.345.678/0001-99 ",
      userId: "cfo",
      intentId: "intent-1",
    });

    const attribute = (await w.parties.findById(partyId))?.attributes[PartyAttributeKey.DOCUMENT];
    expect(attribute).toMatchObject({
      state: AttributeState.KNOWN,
      value: "12.345.678/0001-99",
      source: AttributeSource.USER,
      capturedBy: "cfo",
    });
  });

  it("records a refusal as DECLINED, which is never asked again", async () => {
    const { intentId, partyId } = await readyPayment();
    await w.enrich.execute({ partyId, key: PartyAttributeKey.DOCUMENT, value: "", userId: "cfo" });

    const attribute = (await w.parties.findById(partyId))?.attributes[PartyAttributeKey.DOCUMENT];
    expect(attribute?.state).toBe(AttributeState.DECLINED);
    expect(attribute?.value).toBeUndefined();

    // The next question moves on rather than repeating the declined one.
    expect((await w.preview.execute(intentId)).enrichment?.attribute).toBe(PartyAttributeKey.TYPE);
  });

  it("never overwrites a value that is already known", async () => {
    const { partyId } = await readyPayment();
    await w.enrich.execute({ partyId, key: PartyAttributeKey.DOCUMENT, value: "111", userId: "cfo" });
    await w.enrich.execute({ partyId, key: PartyAttributeKey.DOCUMENT, value: "222", userId: "outro" });

    expect((await w.parties.findById(partyId))?.attributes[PartyAttributeKey.DOCUMENT]?.value).toBe("111");
  });

  it("refuses an attribute the conversation does not ask for", async () => {
    const { partyId } = await readyPayment();
    await expect(
      w.enrich.execute({ partyId, key: "notes", value: "x", userId: "cfo" }),
    ).rejects.toThrow(/not an attribute/i);
  });
});

describe("the backlog is computed, never stored", () => {
  it("lists parties with gaps, most incomplete first", async () => {
    await w.parties.save({
      partyId: "party-completo",
      identityState: PartyIdentityState.IDENTIFIED,
      displayName: "Completo",
      aliases: [],
      externalIds: [],
      attributes: {},
    });
    const { partyId } = await readyPayment();
    await w.enrich.execute({ partyId, key: PartyAttributeKey.TYPE, value: "supplier", userId: "cfo" });

    const backlog = await w.incomplete.execute();
    expect(backlog.map((c) => c.partyId)).toEqual(["party-completo", partyId]);
    expect(backlog[0].missing).toHaveLength(2);
    expect(backlog[1].missing).toEqual([PartyAttributeKey.DOCUMENT]);
  });

  it("reflects an enrichment immediately, with no flag to keep in sync", async () => {
    const { partyId } = await readyPayment();
    expect((await w.incomplete.execute()).some((c) => c.partyId === partyId)).toBe(true);

    await w.enrich.execute({ partyId, key: PartyAttributeKey.DOCUMENT, value: "123", userId: "cfo" });
    await w.enrich.execute({ partyId, key: PartyAttributeKey.TYPE, value: "supplier", userId: "cfo" });

    expect((await w.incomplete.execute()).some((c) => c.partyId === partyId)).toBe(false);
  });

  it("does not chase a party that cannot be identified", async () => {
    await w.parties.save({
      partyId: "party-desconhecida",
      identityState: PartyIdentityState.UNIDENTIFIABLE,
      displayName: "Contraparte não identificada",
      aliases: [],
      externalIds: [],
      attributes: {},
    });

    expect(await w.incomplete.execute()).toEqual([]);
  });
});
