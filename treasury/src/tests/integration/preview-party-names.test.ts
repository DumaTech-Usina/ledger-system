import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryIntentRepository } from "../../infra/persistence/InMemoryIntentRepository";
import { InMemoryPartyRepository } from "../../infra/persistence/InMemoryPartyRepository";
import { InMemoryAuditLog } from "../../infra/audit/InMemoryAuditLog";
import { InMemoryConversationLog } from "../../infra/audit/InMemoryConversationLog";
import { StubCandidateSubmissionAdapter } from "../../infra/submission/StubCandidateSubmissionAdapter";
import { CandidateMapper } from "../../core/application/services/CandidateMapper";
import { PartyDirectory } from "../../core/application/services/PartyDirectory";
import { StartIntentUseCase } from "../../core/application/use-cases/StartIntent";
import { AdvanceDialogUseCase } from "../../core/application/use-cases/AdvanceDialog";
import { PreviewIntentUseCase } from "../../core/application/use-cases/PreviewIntent";
import { SubmitIntentUseCase } from "../../core/application/use-cases/SubmitIntent";
import { IntentStatus } from "../../core/domain/enums/IntentStatus";
import { PartyIdentityState } from "../../core/domain/enums/PartyIdentityState";
import type { Clock } from "../../core/application/ports/Clock";
import type { IdGenerator } from "../../core/application/ports/IdGenerator";
import { PARTY } from "../fixtures/parties";

/**
 * The confirmation card shows names and sends ids. And a party with nothing known about it beyond its
 * name holds no fact back: REQ-314 asks for a document when registering a party, never when recording
 * a fact (REQ-320).
 */
const clock: Clock = { now: () => "2026-08-03T12:00:00.000Z" };
const SUPPLIER = "party-fornecedor";

function wire() {
  const intents = new InMemoryIntentRepository();
  const parties = new InMemoryPartyRepository();
  const audit = new InMemoryAuditLog();
  const log = new InMemoryConversationLog();
  const directory = new PartyDirectory(parties);
  const mapper = new CandidateMapper(PARTY.USINA);
  let n = 0;
  const ids: IdGenerator = { next: () => `0000-${++n}` };
  return {
    intents,
    parties,
    start: new StartIntentUseCase(intents, clock, ids, log),
    advance: new AdvanceDialogUseCase(intents, clock, log, directory),
    preview: new PreviewIntentUseCase(intents, mapper, directory),
    submit: new SubmitIntentUseCase(intents, mapper, new StubCandidateSubmissionAdapter(), audit, clock, directory),
  };
}

let w: ReturnType<typeof wire>;

/** A complete payment to a party known by name alone: no document, no type. */
async function readyPayment(): Promise<string> {
  await w.parties.save({
    partyId: SUPPLIER,
    identityState: PartyIdentityState.IDENTIFIED,
    displayName: "Fornecedor Novo",
    aliases: [],
    externalIds: [],
    attributes: {},
  });
  const { intentId } = await w.start.execute({ scenarioId: "register_payment", userId: "cfo" });
  await w.advance.execute({ intentId, key: "payee", value: SUPPLIER });
  await w.advance.execute({ intentId, key: "amount", value: "1500.00" });
  await w.advance.execute({ intentId, key: "occurredAt", value: "2026-08-03" });
  return intentId;
}

beforeEach(() => {
  w = wire();
});

describe("display: the name, never the raw id", () => {
  it("returns a display name for every party in the candidate", async () => {
    const preview = await w.preview.execute(await readyPayment());

    expect(preview.partyNames[SUPPLIER]).toBe("Fornecedor Novo");
    expect(preview.partyNames[PARTY.USINA]).toBeUndefined(); // the usina is not in the Directory here
  });

  it("keeps the candidate itself free of names — only the id crosses to the Ledger", async () => {
    const preview = await w.preview.execute(await readyPayment());

    expect(preview.candidate.parties.map((p) => p.partyId)).toContain(SUPPLIER);
    expect(JSON.stringify(preview.candidate)).not.toContain("Fornecedor Novo");
  });
});

describe("the preview", () => {
  it("refuses to run before every required answer is in", async () => {
    const { intentId } = await w.start.execute({ scenarioId: "register_payment", userId: "cfo" });

    await expect(w.preview.execute(intentId)).rejects.toThrow(/not ready/i);
  });

  it("§5.5: asks nothing about the party", async () => {
    expect(await w.preview.execute(await readyPayment())).not.toHaveProperty("enrichment");
  });
});

describe("what is unknown about a party holds no fact back", () => {
  it("a party with no document and no type is submitted and accepted", async () => {
    const intentId = await readyPayment();

    const result = await w.submit.execute(intentId);

    expect(result.status).toBe("accepted");
    expect((await w.intents.findById(intentId))?.status).toBe(IntentStatus.ACCEPTED);
  });
});
