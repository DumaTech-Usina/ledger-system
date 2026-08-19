import { describe, it, expect } from "vitest";
import { InMemoryIntentRepository } from "../../infra/persistence/InMemoryIntentRepository";
import { InMemoryAuditLog } from "../../infra/audit/InMemoryAuditLog";
import { StubSlotExtractionAdapter } from "../../infra/nlp/StubSlotExtractionAdapter";
import { StubCandidateSubmissionAdapter } from "../../infra/submission/StubCandidateSubmissionAdapter";
import { CandidateMapper } from "../../core/application/services/CandidateMapper";
import { ApplyAnswersUseCase } from "../../core/application/use-cases/ApplyAnswers";
import { InterpretUtteranceUseCase } from "../../core/application/use-cases/InterpretUtterance";
import { PreviewIntentUseCase } from "../../core/application/use-cases/PreviewIntent";
import { SubmitIntentUseCase } from "../../core/application/use-cases/SubmitIntent";
import type { Clock } from "../../core/application/ports/Clock";
import type { IdGenerator } from "../../core/application/ports/IdGenerator";
import { PARTY, partyDirectory } from "../fixtures/parties";

const clock: Clock = { now: () => "2026-07-23T00:00:00.000Z" };

function wire() {
  const directory = partyDirectory();
  const repo = new InMemoryIntentRepository();
  const audit = new InMemoryAuditLog();
  let n = 0;
  const ids: IdGenerator = { next: () => `intent-${++n}` };
  const mapper = new CandidateMapper(PARTY.USINA);
  const apply = new ApplyAnswersUseCase(repo, clock, audit, directory);
  return {
    repo,
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
    preview: new PreviewIntentUseCase(repo, mapper, directory),
    submit: new SubmitIntentUseCase(repo, mapper, new StubCandidateSubmissionAdapter(), audit, clock, directory),
  };
}

/**
 * Fill the one slot the stub can't ground (the payee PARTY), plus the optional description the
 * engine now asks once every required slot is filled — skipped blank, so the intent becomes ready.
 */
async function fillPayee(apply: ReturnType<typeof wire>["apply"], intentId: string) {
  await apply.execute({
    intentId,
    answers: [
      { key: "payee", value: PARTY.ACME },
      { key: "description", value: "" },
    ],
  });
}

describe("confirm → submit (Phase 4 end-to-end)", () => {
  it("chat → fill → preview → submit → accepted", async () => {
    const { apply, interpret, preview, submit } = wire();

    const r = await interpret.execute({ utterance: "pay a supplier 1500.00 in BRL on 2026-07-23", userId: "cfo" });
    expect(r.scenarioId).toBe("register_payment");
    await fillPayee(apply, r.intentId!);

    const p = await preview.execute(r.intentId!);
    expect(p.candidate.amount).toBe("1500.00");
    expect(p.candidate.currency).toBe("BRL");

    const s = await submit.execute(r.intentId!);
    expect(s.status).toBe("accepted");
    expect(s.ledgerReference).toBeTruthy();
  });

  it("rephrase safety: the submitted candidate is exactly the previewed candidate", async () => {
    // The summary shown to the user is derived from PreviewIntent; a rephrase can never change what
    // is submitted, because SubmitIntent rebuilds the candidate from the intent's answers, not text.
    const { apply, interpret, preview, submit } = wire();
    const r = await interpret.execute({ utterance: "pay a supplier 1500.00 in BRL on 2026-07-23", userId: "cfo" });
    await fillPayee(apply, r.intentId!);

    const previewed = (await preview.execute(r.intentId!)).candidate;
    const submitted = (await submit.execute(r.intentId!)).candidate;
    expect(submitted).toEqual(previewed);
  });

  it("edit before confirm: an edit is reflected in the re-preview and in the submission", async () => {
    const { apply, interpret, preview, submit } = wire();
    const r = await interpret.execute({ utterance: "pay a supplier 1500.00 in BRL on 2026-07-23", userId: "cfo" });
    await fillPayee(apply, r.intentId!);

    // Overwrite the amount via an explicit edit.
    await apply.execute({ intentId: r.intentId!, answers: [{ key: "amount", value: "2000.00" }], mode: "edit" });

    const p = await preview.execute(r.intentId!);
    expect(p.candidate.amount).toBe("2000.00");
    const s = await submit.execute(r.intentId!);
    expect(s.status).toBe("accepted");
    expect(s.candidate.amount).toBe("2000.00");
  });

  it("cannot preview until every required slot is filled (missing-slot loop)", async () => {
    const { interpret, preview } = wire();
    const r = await interpret.execute({ utterance: "pay a supplier 1500.00", userId: "cfo" }); // no date, no payee
    expect(r.state?.kind).toBe("question");
    await expect(preview.execute(r.intentId!)).rejects.toThrow(/not ready/i);
  });

  it("a Ledger rejection surfaces a legible reason", async () => {
    const { apply, interpret, submit } = wire();
    const r = await interpret.execute({ utterance: "pay a supplier 1500.00 in BRL on 2026-07-23", userId: "cfo" });
    await fillPayee(apply, r.intentId!);
    // The stub rejects a candidate whose description contains "test".
    await apply.execute({ intentId: r.intentId!, answers: [{ key: "description", value: "test payment" }], mode: "edit" });

    const s = await submit.execute(r.intentId!);
    expect(s.status).toBe("rejected");
    expect(s.reason).toBeTruthy();
  });
});
