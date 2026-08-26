import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryIntentRepository } from "../../infra/persistence/InMemoryIntentRepository";
import { InMemoryAuditLog } from "../../infra/audit/InMemoryAuditLog";
import { CandidateMapper, UNIDENTIFIED_COUNTERPARTY } from "../../core/application/services/CandidateMapper";
import { StartIntentUseCase } from "../../core/application/use-cases/StartIntent";
import { AdvanceDialogUseCase } from "../../core/application/use-cases/AdvanceDialog";
import { DecideIdentityUseCase } from "../../core/application/use-cases/DecideIdentity";
import { PreviewIntentUseCase } from "../../core/application/use-cases/PreviewIntent";
import { SubmitIntentUseCase } from "../../core/application/use-cases/SubmitIntent";
import { IdentityDecisionKind } from "../../core/domain/value-objects/IdentityDecision";
import type { Candidate } from "../../core/domain/value-objects/Candidate";
import type { CandidateSubmissionPort, SubmissionOutcome } from "../../core/application/ports/CandidateSubmissionPort";
import type { Clock } from "../../core/application/ports/Clock";
import type { IdGenerator } from "../../core/application/ports/IdGenerator";
import { PARTY, PARTY_DISPLAY_NAMES, seededDirectory } from "../fixtures/parties";

const clock: Clock = { now: () => "2026-08-03T00:00:00.000Z" };

/** Captures exactly what would reach the Ledger. */
class CapturingSubmission implements CandidateSubmissionPort {
  last?: Candidate;
  async submit(candidate: Candidate): Promise<SubmissionOutcome> {
    this.last = candidate;
    return { status: "accepted", ledgerReference: "evt-1" };
  }
}

function wire() {
  const { directory, repo: parties } = seededDirectory();
  const intents = new InMemoryIntentRepository();
  const audit = new InMemoryAuditLog();
  const mapper = new CandidateMapper(PARTY.USINA);
  const submission = new CapturingSubmission();
  let n = 0;
  const ids: IdGenerator = { next: () => `0000-${++n}` };
  return {
    submission,
    parties,
    start: new StartIntentUseCase(intents, clock, ids, audit),
    advance: new AdvanceDialogUseCase(intents, clock, audit, directory),
    decide: new DecideIdentityUseCase(intents, parties, clock, ids, audit),
    preview: new PreviewIntentUseCase(intents, mapper, directory),
    submit: new SubmitIntentUseCase(intents, mapper, submission, audit, clock, directory),
  };
}

let w: ReturnType<typeof wire>;
beforeEach(() => {
  w = wire();
});

/** register_commission_received is the one scenario whose payer may be unidentifiable. */
async function commissionWithUnknownPayer(origin?: string): Promise<string> {
  const { intentId } = await w.start.execute({
    scenarioId: "register_commission_received",
    userId: "cfo",
  });
  await w.decide.execute({
    intentId,
    slot: "payer",
    kind: IdentityDecisionKind.UNIDENTIFIABLE,
    justification: "Remetente não informado pelo banco.",
    userId: "cfo",
  });
  await w.advance.execute({ intentId, key: "amount", value: "1000.00" });
  await w.advance.execute({ intentId, key: "currency", value: "BRL" });
  await w.advance.execute({ intentId, key: "occurredAt", value: "2026-08-03" });
  if (origin) await w.advance.execute({ intentId, key: "origin", value: origin });
  await w.advance.execute({ intentId, key: "description", value: "" });
  return intentId;
}

async function commissionWithKnownPayer(): Promise<string> {
  const { intentId } = await w.start.execute({
    scenarioId: "register_commission_received",
    userId: "cfo",
  });
  await w.advance.execute({ intentId, key: "payer", value: PARTY_DISPLAY_NAMES[PARTY.OPERATOR] });
  await w.advance.execute({ intentId, key: "amount", value: "1000.00" });
  await w.advance.execute({ intentId, key: "currency", value: "BRL" });
  await w.advance.execute({ intentId, key: "occurredAt", value: "2026-08-03" });
  await w.advance.execute({ intentId, key: "description", value: "" });
  return intentId;
}

describe("an unidentified counterparty is disclosed to the Ledger", () => {
  it("flags follow-up and names the gap in the reason description", async () => {
    await w.submit.execute(await commissionWithUnknownPayer());
    const candidate = w.submission.last!;

    expect(candidate.reason.requiresFollowup).toBe(true);
    expect(candidate.reason.description).toContain(UNIDENTIFIED_COUNTERPARTY);
  });

  it("discloses it even when the lineage IS known", async () => {
    // The origin is filled, so `unknown_origin` does not apply. The party gap must still surface —
    // otherwise the only case that gets disclosed would be the one that was already disclosed.
    await w.submit.execute(await commissionWithUnknownPayer("evt-expected-1"));
    const candidate = w.submission.last!;

    expect(candidate.relatedEventId).toBe("evt-expected-1");
    expect(candidate.reason.type).not.toBe("unknown_origin");
    expect(candidate.reason.requiresFollowup).toBe(true);
    expect(candidate.reason.description).toContain(UNIDENTIFIED_COUNTERPARTY);
  });

  it("does not overwrite the event's cause with unknown_origin", async () => {
    // reason.type names why the event happened. Asserting unresolved lineage because the PARTY is
    // unknown would record a different fact, and one that may be false.
    await w.submit.execute(await commissionWithUnknownPayer("evt-expected-1"));
    expect(w.submission.last!.reason.type).toBe("commission_payment");
  });

  it("keeps unknown_origin for the lineage when the origin is genuinely absent", async () => {
    await w.submit.execute(await commissionWithUnknownPayer());
    const candidate = w.submission.last!;

    // Both gaps are real here, and both are visible: the cause says the lineage is unresolved, the
    // description says the counterparty is too.
    expect(candidate.reason.type).toBe("unknown_origin");
    expect(candidate.reason.description).toContain(UNIDENTIFIED_COUNTERPARTY);
  });

  it("still sends a real PartyId — the gap is disclosed, never expressed as an absence", async () => {
    await w.submit.execute(await commissionWithUnknownPayer());
    const parties = w.submission.last!.parties;

    expect(parties.every((p) => typeof p.partyId === "string" && p.partyId.length > 0)).toBe(true);
    expect(parties.some((p) => p.partyId.startsWith("party-"))).toBe(true);
  });
});

describe("a known counterparty is never marked", () => {
  it("carries no marker and no follow-up", async () => {
    await w.submit.execute(await commissionWithKnownPayer());
    const candidate = w.submission.last!;

    expect(candidate.reason.description).not.toContain(UNIDENTIFIED_COUNTERPARTY);
    // Origin left empty, so the lineage orphan still applies — that is the only follow-up here.
    expect(candidate.reason.type).toBe("unknown_origin");
  });

  it("a party the Directory has never heard of is NOT reported as unidentified", async () => {
    // Absence of information is not information about an absence. Only an explicit decision counts.
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
    await w.submit.execute(intentId);

    expect(w.submission.last!.parties.some((p) => p.partyId === decision.partyId)).toBe(true);
    expect(w.submission.last!.reason.description).not.toContain(UNIDENTIFIED_COUNTERPARTY);
    expect(w.submission.last!.reason.requiresFollowup).toBe(false);
  });
});

describe("preview and submit disclose the same thing", () => {
  it("the card the user confirms carries the marker the Ledger receives", async () => {
    const intentId = await commissionWithUnknownPayer();
    const preview = await w.preview.execute(intentId);
    await w.submit.execute(intentId);

    expect(preview.candidate.reason.description).toBe(w.submission.last!.reason.description);
    expect(preview.candidate.reason.requiresFollowup).toBe(w.submission.last!.reason.requiresFollowup);
  });
});
