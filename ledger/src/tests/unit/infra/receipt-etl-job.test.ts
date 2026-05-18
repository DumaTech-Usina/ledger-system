import { describe, it, expect, vi } from "vitest";
import { ReceiptETLJob } from "../../../infra/jobs/ReceiptETLJob";
import { InMemoryStagingRepository } from "../../../infra/persistence/staging/InMemoryStagingRepository";
import { EnrichedReceiptInput } from "../../../core/application/dtos/EnrichedReceiptInput";
import { ReceiptStagingBuilder } from "../../../core/application/services/ReceiptStagingBuilder";
import { ReceiptETLReader } from "../../../core/application/ports/ReceiptETLReader";

// ── Stub helpers ──────────────────────────────────────────────────────────────

async function* toStream<T>(items: T[]): AsyncGenerator<T> {
  for (const item of items) yield item;
}

async function* throwingStream<T>(err: Error): AsyncGenerator<T> {
  throw err;
}

function makeEnriched(
  receiptId: string,
  proposalId: string,
  opts: { status?: string; installmentNumber?: number } = {},
): EnrichedReceiptInput {
  return {
    receiptId,
    proposalId,
    installmentNumber: opts.installmentNumber ?? 1,
    downloadedValue: "200.00",
    dischargeDate: opts.status === "ABERTA" ? null : "2024-06-15T00:00:00Z",
    receiptStatus: opts.status ?? "BAIXADO",
    proposalNumber: "12345678",
    operatorId: "op-001",
    brokerId: null,
    registeredAt: "2024-05-01T08:00:00Z",
  };
}

function makeReader(items: EnrichedReceiptInput[]): ReceiptETLReader {
  return {
    streamEnrichedReceipts: vi.fn().mockImplementation(() => toStream(items)),
  };
}

function buildPipeline(
  reader: ReceiptETLReader,
  stagingRepo = new InMemoryStagingRepository([]),
) {
  const builder = new ReceiptStagingBuilder(
    stagingRepo,
    "usina-001",
    "worker-etl-1",
  );
  const job = new ReceiptETLJob(reader, builder);
  return { job, stagingRepo };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ReceiptETLJob — orchestrating the full ETL pipeline from source system to staging", () => {
  it("when the source cursor yields no receipts, nothing is staged — an empty run is a valid no-op and must not produce phantom records", async () => {
    const { job, stagingRepo } = buildPipeline(makeReader([]));

    await job.run();

    expect(await stagingRepo.findAll()).toHaveLength(0);
  });

  it("a BAIXADO enriched receipt produces one CASH_IN staging record — the ETL pipeline correctly routes a discharged commission from source to staging", async () => {
    const { job, stagingRepo } = buildPipeline(
      makeReader([makeEnriched("rcpt-A", "prop-001")]),
    );

    await job.run();

    const saved = await stagingRepo.findAll();
    expect(saved).toHaveLength(1);
    expect(saved[0].economicEffect).toBe("cash_in");
  });

  it("an ABERTA enriched receipt produces one NON_CASH staging record — the ETL pipeline correctly recognizes an unresolved commission obligation", async () => {
    const { job, stagingRepo } = buildPipeline(
      makeReader([makeEnriched("rcpt-B", "prop-002", { status: "ABERTA" })]),
    );

    await job.run();

    const saved = await stagingRepo.findAll();
    expect(saved).toHaveLength(1);
    expect(saved[0].economicEffect).toBe("non_cash");
  });

  it("when the receipt cursor fails, the run rejects with that error — a broken stream must not silently produce partial results", async () => {
    const reader: ReceiptETLReader = {
      streamEnrichedReceipts: vi
        .fn()
        .mockImplementation(() =>
          throwingStream(new Error("Receipt cursor disconnected")),
        ),
    };
    const { job } = buildPipeline(reader);

    await expect(job.run()).rejects.toThrow("Receipt cursor disconnected");
  });

  it("a batch with two valid receipts and one with a corrupt receiptId stages exactly two records — bad data is quarantined without blocking good data", async () => {
    const good1 = makeEnriched("rcpt-ok-1", "prop-001", {
      installmentNumber: 1,
    });
    const corrupt = {
      ...makeEnriched("rcpt-corrupt", "prop-001", { installmentNumber: 2 }),
      receiptId: "",
    };
    const good2 = makeEnriched("rcpt-ok-2", "prop-001", {
      installmentNumber: 3,
    });

    const { job, stagingRepo } = buildPipeline(
      makeReader([good1, corrupt, good2]),
    );

    await job.run();

    expect(await stagingRepo.findAll()).toHaveLength(2);
  });
});
