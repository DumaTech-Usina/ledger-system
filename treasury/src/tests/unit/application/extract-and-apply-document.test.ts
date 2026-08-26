import { describe, it, expect } from "vitest";
import { InMemoryIntentRepository } from "../../../infra/persistence/InMemoryIntentRepository";
import { InMemoryAuditLog } from "../../../infra/audit/InMemoryAuditLog";
import { StartIntentUseCase } from "../../../core/application/use-cases/StartIntent";
import { ApplyAnswersUseCase } from "../../../core/application/use-cases/ApplyAnswers";
import { ExtractAndApplyDocumentUseCase } from "../../../core/application/use-cases/ExtractAndApplyDocument";
import type { FileExtractionPort } from "../../../core/application/ports/FileExtractionPort";
import type { ExtractionResult, RawDocument } from "../../../core/application/dtos/ExtractionModels";
import type { Clock } from "../../../core/application/ports/Clock";
import type { IdGenerator } from "../../../core/application/ports/IdGenerator";
import { PARTY, partyDirectory } from "../../fixtures/parties";

const clock: Clock = { now: () => "2026-07-23T00:00:00.000Z" };

/** Hands back whatever result the test configured — no file is actually parsed. */
class FakeExtraction implements FileExtractionPort {
  constructor(private readonly result: ExtractionResult) {}
  async extract(_file: RawDocument): Promise<ExtractionResult> {
    return this.result;
  }
}

const aFile: RawDocument = { buffer: Buffer.from(""), mimeType: "application/pdf", filename: "recibo.pdf" };

function wire(result: ExtractionResult) {
  const directory = partyDirectory();
  const repo = new InMemoryIntentRepository();
  const audit = new InMemoryAuditLog();
  let n = 0;
  const ids: IdGenerator = { next: () => `intent-${++n}` };
  const apply = new ApplyAnswersUseCase(repo, clock, audit, directory);
  return {
    repo,
    start: new StartIntentUseCase(repo, clock, ids, audit),
    extractAndApply: new ExtractAndApplyDocumentUseCase(new FakeExtraction(result), apply, repo),
  };
}

// register_payment slots: payee (PARTY), amount (MONEY), currency (CHOICE: BRL|USD),
// occurredAt (DATE), objectRef (STRING, optional), description (STRING, optional).
async function startPayment(w: { start: StartIntentUseCase }) {
  const { intentId } = await w.start.execute({ scenarioId: "register_payment", userId: "cfo" });
  return intentId;
}

describe("ExtractAndApplyDocument — file extraction bridged into the batch merge", () => {
  it("fills every matching unanswered slot from a successful extraction", async () => {
    const w = wire({
      success: true,
      documentType: "pix_receipt",
      data: { counterparty: "ACME", amount: "1500.00", date: "2026-07-20", currency: "BRL" },
    });
    const intentId = await startPayment(w);

    const res = await w.extractAndApply.execute({ intentId, file: aFile });

    expect(res.applied.map((s) => s.key).sort()).toEqual(["amount", "currency", "occurredAt", "payee"]);
    expect(res.skipped).toHaveLength(0);
    expect(res.identity).toHaveLength(1); // the PARTY field always reports its resolution outcome

    const intent = await w.repo.findById(intentId);
    expect(intent?.answers.payee).toBe(PARTY.ACME);
    expect(intent?.answers.amount).toBe("1500.00");
    expect(intent?.answers.currency).toBe("BRL");
    expect(intent?.answers.occurredAt).toBe("2026-07-20");
  });

  it("never writes a description into a scenario's OTHER string slot (e.g. objectRef)", async () => {
    const w = wire({ success: true, data: { description: "Pagamento de consultoria" } });
    const intentId = await startPayment(w);

    const res = await w.extractAndApply.execute({ intentId, file: aFile });

    expect(res.applied.map((s) => s.key)).toEqual(["description"]);
    const intent = await w.repo.findById(intentId);
    expect(intent?.answers.description).toBe("Pagamento de consultoria");
    expect(intent?.answers.objectRef).toBeUndefined();
  });

  it("never writes currency into a scenario's OTHER choice slot (e.g. an incentive/bonus kind)", async () => {
    const w = wire({ success: true, data: { currency: "USD" } });
    const { intentId } = await w.start.execute({ scenarioId: "register_incentive", userId: "cfo" });

    const res = await w.extractAndApply.execute({ intentId, file: aFile });

    expect(res.applied.map((s) => s.key)).toEqual(["currency"]);
    const intent = await w.repo.findById(intentId);
    expect(intent?.answers.currency).toBe("USD");
    expect(intent?.answers.kind).toBeUndefined();
  });

  it("leaves an unrecognized counterparty out of applied and reports the identity outcome instead", async () => {
    const w = wire({ success: true, data: { counterparty: "Alguém Desconhecido" } });
    const intentId = await startPayment(w);

    const res = await w.extractAndApply.execute({ intentId, file: aFile });

    expect(res.applied).toHaveLength(0);
    expect(res.identity).toHaveLength(1);
    expect(res.identity[0].resolution.kind).toBe("new");
    const intent = await w.repo.findById(intentId);
    expect(intent?.answers.payee).toBeUndefined();
  });

  it("skips a required slot the extraction found nothing for, with a reason", async () => {
    const w = wire({ success: true, data: {} });
    const intentId = await startPayment(w);

    const res = await w.extractAndApply.execute({ intentId, file: aFile });

    expect(res.applied).toHaveLength(0);
    // payee, amount, currency, occurredAt are all required and unanswered. objectRef/description
    // are optional, so their absence is silently skipped, not reported.
    expect(res.skipped.map((s) => s.slot.key).sort()).toEqual(["amount", "currency", "occurredAt", "payee"]);
  });

  it("reports a value that fails validation as skipped, without recording it", async () => {
    const w = wire({
      success: true,
      data: { counterparty: "ACME", date: "2026-07-20", currency: "BRL", amount: "not-a-number" },
    });
    const intentId = await startPayment(w);

    const res = await w.extractAndApply.execute({ intentId, file: aFile });

    expect(res.applied.map((s) => s.key).sort()).toEqual(["currency", "occurredAt", "payee"]);
    expect(res.skipped.map((s) => s.slot.key)).toEqual(["amount"]);
    const intent = await w.repo.findById(intentId);
    expect(intent?.answers.amount).toBeUndefined();
  });

  it("never fills an already-answered slot (fill-only overwrite policy)", async () => {
    const directory = partyDirectory();
    const repo = new InMemoryIntentRepository();
    const audit = new InMemoryAuditLog();
    let n = 0;
    const ids: IdGenerator = { next: () => `intent-${++n}` };
    const start = new StartIntentUseCase(repo, clock, ids, audit);
    const apply = new ApplyAnswersUseCase(repo, clock, audit, directory);

    const { intentId } = await start.execute({ scenarioId: "register_payment", userId: "cfo" });
    const first = new ExtractAndApplyDocumentUseCase(
      new FakeExtraction({ success: true, data: { amount: "999.00" } }),
      apply,
      repo,
    );
    await first.execute({ intentId, file: aFile });

    // A second file proposes a different amount for the slot the first one just filled.
    const second = new ExtractAndApplyDocumentUseCase(
      new FakeExtraction({ success: true, data: { amount: "1.00" } }),
      apply,
      repo,
    );
    const res = await second.execute({ intentId, file: aFile });

    expect(res.applied).toHaveLength(0);
    const intent = await repo.findById(intentId);
    expect(intent?.answers.amount).toBe("999.00"); // unchanged
  });

  it("does nothing and reports no applied/skipped fields when extraction itself failed", async () => {
    const w = wire({ success: false, data: {}, errors: ["Formato não suportado."] });
    const intentId = await startPayment(w);

    const res = await w.extractAndApply.execute({ intentId, file: aFile });

    expect(res.extraction.success).toBe(false);
    expect(res.applied).toHaveLength(0);
    expect(res.skipped).toHaveLength(0);
    expect(res.identity).toHaveLength(0);
    expect(res.state.kind).toBe("question");
  });

  it("throws on an unknown intent", async () => {
    const w = wire({ success: true, data: {} });
    await expect(w.extractAndApply.execute({ intentId: "nope", file: aFile })).rejects.toThrow(/Unknown intent/);
  });
});
