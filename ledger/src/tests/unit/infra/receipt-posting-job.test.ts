import { describe, it, expect, vi } from "vitest";
import { ReceiptStagingBuilder } from "../../../core/application/services/ReceiptStagingBuilder";
import { ReceiptPostingInput } from "../../../core/application/dtos/ReceiptPostingInput";
import { InMemoryStagingRepository } from "../../../infra/persistence/staging/InMemoryStagingRepository";
import { ProposalContext } from "../../../core/application/dtos/ProposalContext";
import { EconomicEffect } from "../../../core/domain/enums/EconomicEffect";
import { EventType } from "../../../core/domain/enums/EventType";
import { Direction } from "../../../core/domain/enums/Direction";
import { ObjectType } from "../../../core/domain/enums/ObjectType";
import { Relation } from "../../../core/domain/enums/Relation";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const USINA_ID = "usina-001";
const WORKER_ID = "worker-etl-v1";

function makeContext(overrides: Partial<ProposalContext> = {}): ProposalContext {
  return {
    proposalId: "prop-abc",
    proposalNumber: "12345678",
    operatorId: "op-001",
    brokerId: null,
    supervisorId: null,
    registeredAt: new Date("2024-05-01T08:00:00Z"),
    ...overrides,
  };
}

function ctxMap(...contexts: ProposalContext[]): Map<string, ProposalContext> {
  return new Map(contexts.map((c) => [c.proposalId, c]));
}

function baixado(overrides: Partial<ReceiptPostingInput> = {}): ReceiptPostingInput {
  return {
    receiptId: "rcpt-111",
    proposalId: "prop-abc",
    installmentNumber: 3,
    downloadedValue: "250.00",
    dischargeDate: "2024-07-10T00:00:00Z",
    receiptStatus: "BAIXADO",
    ...overrides,
  };
}

function naoBaixado(overrides: Partial<ReceiptPostingInput> = {}): ReceiptPostingInput {
  return {
    receiptId: "rcpt-222",
    proposalId: "prop-abc",
    installmentNumber: 2,
    downloadedValue: "180.00",
    dischargeDate: null,
    receiptStatus: "NÃO BAIXADO",
    ...overrides,
  };
}

function buildJob(repo?: InMemoryStagingRepository) {
  const stagingRepo = repo ?? new InMemoryStagingRepository([]);
  return { job: new ReceiptStagingBuilder(stagingRepo, USINA_ID, WORKER_ID), stagingRepo };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ReceiptPostingJob — converting raw receipts into ledger staging records", () => {

  describe("BAIXADO receipts — cash has been received and must be recorded as a financial inflow", () => {

    it("a BAIXADO receipt with a known proposal context becomes a COMMISSION_RECEIVED staging record carrying a CASH_IN economic effect — the operator has been paid and the ledger must capture the cash inflow", async () => {
      const { job, stagingRepo } = buildJob();

      await job.run([baixado()], ctxMap(makeContext()));

      const [record] = await stagingRepo.findAll();
      expect(record.eventType).toBe(EventType.COMMISSION_RECEIVED);
      expect(record.economicEffect).toBe(EconomicEffect.CASH_IN);
    });

    it("the source reference encodes the receipt identity so the same receipt can never be posted twice — deduplication depends on this exact format", async () => {
      const { job, stagingRepo } = buildJob();

      await job.run([baixado({ receiptId: "rcpt-unique" })], ctxMap(makeContext()));

      const [record] = await stagingRepo.findAll();
      expect(record.sourceReference).toBe("receipt:rcpt-unique:receivable");
    });

    it("the BAIXADO record's parties show money flowing: the operator pays out and Usina receives the exact commission amount", async () => {
      const { job, stagingRepo } = buildJob();
      const ctx = makeContext({ operatorId: "op-specific" });

      await job.run([baixado({ downloadedValue: "300.00" })], ctxMap(ctx));

      const [record] = await stagingRepo.findAll();
      const payer = record.parties!.find((p) => p.direction === Direction.OUT);
      const payee = record.parties!.find((p) => p.direction === Direction.IN);

      expect(payer?.partyId).toBe("op-specific");
      expect(payee?.partyId).toBe(USINA_ID);
      expect(payee?.amount).toBe("300.00");
    });

    it("the BAIXADO record is timestamped to the actual discharge date — the event happened when the money arrived, not when the batch ran", async () => {
      const { job, stagingRepo } = buildJob();

      await job.run(
        [baixado({ dischargeDate: "2024-07-10T14:30:00Z" })],
        ctxMap(makeContext()),
      );

      const [record] = await stagingRepo.findAll();
      expect(record.occurredAt).toBe("2024-07-10T14:30:00Z");
    });

    it("the BAIXADO record links three economic objects: the receivable being settled, the proposal it belongs to, and the specific installment being paid off", async () => {
      const { job, stagingRepo } = buildJob();
      const ctx = makeContext({ proposalId: "prop-target" });

      await job.run(
        [baixado({ receiptId: "rcpt-links", installmentNumber: 5, proposalId: "prop-target" })],
        ctxMap(ctx),
      );

      const [record] = await stagingRepo.findAll();
      const objects = record.objects!;

      expect(objects).toHaveLength(3);
      expect(objects.find((o) => o.objectType === ObjectType.COMMISSION_RECEIVABLE)?.relation)
        .toBe(Relation.SETTLES);
      expect(objects.find((o) => o.objectType === ObjectType.PROPOSAL)?.objectId)
        .toBe("prop-target");
      expect(objects.find((o) => o.objectType === ObjectType.INSTALLMENT)?.objectId)
        .toBe("prop-target:5");
    });

    it("a BAIXADO staging record enters the pipeline in 'pending' status — it has been accepted for processing but not yet promoted to the ledger", async () => {
      const { job, stagingRepo } = buildJob();

      await job.run([baixado()], ctxMap(makeContext()));

      const [record] = await stagingRepo.findAll();
      expect(record.status).toBe("pending");
    });

  });

  describe("NÃO BAIXADO and ABERTA receipts — an obligation has been identified, but no cash has moved yet", () => {

    it("a NÃO BAIXADO receipt becomes a COMMISSION_EXPECTED staging record with NON_CASH effect — the commission obligation exists on paper but Usina has not received the money", async () => {
      const { job, stagingRepo } = buildJob();

      await job.run([naoBaixado()], ctxMap(makeContext()));

      const [record] = await stagingRepo.findAll();
      expect(record.eventType).toBe(EventType.COMMISSION_EXPECTED);
      expect(record.economicEffect).toBe(EconomicEffect.NON_CASH);
    });

    it("a NÃO BAIXADO record's parties carry NEUTRAL direction — no cash transfer is implied, only the economic obligation is being named", async () => {
      const { job, stagingRepo } = buildJob();

      await job.run([naoBaixado()], ctxMap(makeContext()));

      const [record] = await stagingRepo.findAll();
      expect(record.parties!.every((p) => p.direction === Direction.NEUTRAL)).toBe(true);
    });

    it("an ABERTA receipt is treated identically to NÃO BAIXADO — both statuses represent unresolved commission obligations and the ledger must record them the same way", async () => {
      const { job, stagingRepo } = buildJob();

      await job.run(
        [naoBaixado({ receiptStatus: "ABERTA", receiptId: "rcpt-aberta" })],
        ctxMap(makeContext()),
      );

      const [record] = await stagingRepo.findAll();
      expect(record.economicEffect).toBe(EconomicEffect.NON_CASH);
      expect(record.parties!.every((p) => p.direction === Direction.NEUTRAL)).toBe(true);
    });

    it("the NÃO BAIXADO record links the receivable with the ORIGINATES relation — the commission position is being opened, not closed", async () => {
      const { job, stagingRepo } = buildJob();

      await job.run([naoBaixado()], ctxMap(makeContext()));

      const [record] = await stagingRepo.findAll();
      const receivable = record.objects!.find((o) => o.objectType === ObjectType.COMMISSION_RECEIVABLE);
      expect(receivable?.relation).toBe(Relation.ORIGINATES);
    });

    it("a NÃO BAIXADO record is timestamped to the proposal registration date — since no discharge occurred, the obligation is anchored to when the proposal was first registered", async () => {
      const { job, stagingRepo } = buildJob();
      const ctx = makeContext({ registeredAt: new Date("2024-04-20T09:00:00Z") });

      await job.run([naoBaixado()], ctxMap(ctx));

      const [record] = await stagingRepo.findAll();
      expect(record.occurredAt).toBe("2024-04-20T09:00:00.000Z");
    });

  });

  describe("validation gates — receipts that carry data errors must never reach the staging pipeline", () => {

    it("a receipt with no receiptId is silently dropped — without an identity the record cannot be deduplicated or traced back to its source system", async () => {
      const { job, stagingRepo } = buildJob();
      await job.run([baixado({ receiptId: "" })], ctxMap(makeContext()));
      expect(await stagingRepo.findAll()).toHaveLength(0);
    });

    it("a receipt referencing a proposalId with no matching context is dropped — the operator who earned the commission cannot be identified, so the event cannot be financially attributed", async () => {
      const { job, stagingRepo } = buildJob();
      await job.run(
        [baixado({ proposalId: "prop-orphan" })],
        ctxMap(makeContext({ proposalId: "prop-known" })),
      );
      expect(await stagingRepo.findAll()).toHaveLength(0);
    });

    it("a receipt with downloadedValue of zero is dropped — a zero-value commission event carries no economic content and would silently inflate position aggregates without meaning", async () => {
      const { job, stagingRepo } = buildJob();
      await job.run([baixado({ downloadedValue: "0" })], ctxMap(makeContext()));
      expect(await stagingRepo.findAll()).toHaveLength(0);
    });

    it("a receipt with a negative downloadedValue is dropped — a negative amount signals a data error at the source; legitimate reversals are represented as separate ledger events", async () => {
      const { job, stagingRepo } = buildJob();
      await job.run([baixado({ downloadedValue: "-100.00" })], ctxMap(makeContext()));
      expect(await stagingRepo.findAll()).toHaveLength(0);
    });

    it("a receipt with a non-numeric downloadedValue is dropped — unparseable amounts cannot be committed to the financial ledger without risking calculation corruption", async () => {
      const { job, stagingRepo } = buildJob();
      await job.run([baixado({ downloadedValue: "abc" })], ctxMap(makeContext()));
      expect(await stagingRepo.findAll()).toHaveLength(0);
    });

    it("a receipt with installmentNumber zero is dropped — installment numbers are 1-based in this domain; zero indicates a corrupt source record that must not be posted", async () => {
      const { job, stagingRepo } = buildJob();
      await job.run([baixado({ installmentNumber: 0 })], ctxMap(makeContext()));
      expect(await stagingRepo.findAll()).toHaveLength(0);
    });

    it("a receipt with a negative installmentNumber is dropped — structural data corruption in installment references must be caught before it creates phantom obligations", async () => {
      const { job, stagingRepo } = buildJob();
      await job.run([baixado({ installmentNumber: -1 })], ctxMap(makeContext()));
      expect(await stagingRepo.findAll()).toHaveLength(0);
    });

    it("a receipt with a fractional installmentNumber is dropped — installments are discrete numbered obligations; 1.5 does not correspond to any real financial contract term", async () => {
      const { job, stagingRepo } = buildJob();
      await job.run([baixado({ installmentNumber: 1.5 })], ctxMap(makeContext()));
      expect(await stagingRepo.findAll()).toHaveLength(0);
    });

    it("a receipt that carries a dischargeDate but claims status NÃO BAIXADO is dropped — a discharge date means the cash moved, which directly contradicts the 'not discharged' claim", async () => {
      const { job, stagingRepo } = buildJob();
      await job.run(
        [baixado({ dischargeDate: "2024-07-10T00:00:00Z", receiptStatus: "NÃO BAIXADO" })],
        ctxMap(makeContext()),
      );
      expect(await stagingRepo.findAll()).toHaveLength(0);
    });

    it("a BAIXADO receipt with no dischargeDate is dropped — a discharged receipt must record when the money arrived to establish the event's temporal position in the ledger chain", async () => {
      const { job, stagingRepo } = buildJob();
      await job.run([baixado({ dischargeDate: null })], ctxMap(makeContext()));
      expect(await stagingRepo.findAll()).toHaveLength(0);
    });

    it("a BAIXADO receipt with an unparseable dischargeDate is dropped — an invalid date string cannot anchor an event in the timeline and would corrupt the ledger's hash chain", async () => {
      const { job, stagingRepo } = buildJob();
      await job.run([baixado({ dischargeDate: "not-a-date" })], ctxMap(makeContext()));
      expect(await stagingRepo.findAll()).toHaveLength(0);
    });

    it("a receipt with an unrecognized status is dropped — the system only understands BAIXADO, NÃO BAIXADO, and ABERTA; unknown statuses cannot be safely categorized as either cash or obligation events", async () => {
      const { job, stagingRepo } = buildJob();
      await job.run([baixado({ receiptStatus: "PENDENTE" })], ctxMap(makeContext()));
      expect(await stagingRepo.findAll()).toHaveLength(0);
    });

  });

  describe("batching behavior — processing multiple receipts in one run", () => {

    it("a valid receipt results in exactly one staging repository write — the job does not duplicate saves for a single receipt", async () => {
      const repo = new InMemoryStagingRepository([]);
      const saveSpy = vi.spyOn(repo, "save");
      const { job } = buildJob(repo);

      await job.run([baixado()], ctxMap(makeContext()));

      expect(saveSpy).toHaveBeenCalledTimes(1);
    });

    it("an invalid receipt never reaches the staging repository — the save method is not called and no partial record is persisted", async () => {
      const repo = new InMemoryStagingRepository([]);
      const saveSpy = vi.spyOn(repo, "save");
      const { job } = buildJob(repo);

      await job.run([baixado({ receiptId: "" })], ctxMap(makeContext()));

      expect(saveSpy).not.toHaveBeenCalled();
    });

    it("a batch of three receipts — two valid and one with a missing receiptId — produces exactly two staging records: the corrupt receipt is silently quarantined without blocking the valid ones", async () => {
      const { job, stagingRepo } = buildJob();
      const ctx = makeContext();

      await job.run(
        [
          baixado({ receiptId: "rcpt-ok-1", installmentNumber: 1 }),
          baixado({ receiptId: "",          installmentNumber: 2 }),  // invalid: no id
          baixado({ receiptId: "rcpt-ok-2", installmentNumber: 3 }),
        ],
        ctxMap(ctx),
      );

      expect(await stagingRepo.findAll()).toHaveLength(2);
    });

  });

});
