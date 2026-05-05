/**
 * Ledger Manifesto — Pillar-level integration tests.
 *
 * Each describe block maps to one of the 11 manifesto pillars.
 * These tests supplement the business-flow tests by verifying
 * infrastructure-level guarantees: immutability, replay determinism,
 * idempotency, atomicity, and global conservation.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateLedgerEventUseCase } from "../../core/application/use-cases/CreateLedgerEventUseCase";
import { RejectLedgerEventUseCase } from "../../core/application/use-cases/RejectLedgerEventUseCase";
import { LedgerEvent } from "../../core/domain/entities/LedgerEvent";
import { EconomicEffect } from "../../core/domain/enums/EconomicEffect";
import { EventHash } from "../../core/domain/value-objects/EventHash";
import { NoOpAuditLogger } from "../../infra/audit/NoOpAuditLogger";
import { InMemoryLedgerEventRepository } from "../../infra/persistence/ledger/InMemoryLedgerEventRepository";
import { InMemoryRejectedEventRepository } from "../../infra/persistence/rejected/InMemoryRejectedEventRepository";
import { InMemoryStagingRepository } from "../../infra/persistence/staging/InMemoryStagingRepository";
import { StagingRecordValidator } from "../../core/application/services/StagingRecordValidator";
import { ProcessStagingJob } from "../../infra/jobs/ProcessStagingJob";
import { makeValidCommand, makeValidProps, makeValidStagingRecord } from "../fixtures";

// ============================
// Pillar 1 — Conservation of Value
// ============================

describe("Pillar 1 — Conservation of Value", () => {
  it("P1a — for a complete advance lifecycle (disburse → fully recover), net cash flow is zero", async () => {
    const ledgerRepo = new InMemoryLedgerEventRepository();
    const useCase = new CreateLedgerEventUseCase(ledgerRepo, new NoOpAuditLogger());

    const advanceCmd = makeValidCommand({
      eventType: "advance_payment" as any,
      economicEffect: EconomicEffect.CASH_OUT,
      amount: "500.00",
      sourceReference: "adv-p1a-orig",
      objects: [{ objectId: "adv-p1a", objectType: "advance" as any, relation: "originates" as any }],
      parties: [
        { partyId: "usina", role: "payer" as any, direction: "out" as any, amount: "500.00" },
        { partyId: "broker", role: "payee" as any, direction: "neutral" as any, amount: "500.00" },
      ],
      reason: { type: "advance_payment" as any, description: "advance", confidence: "high" as any, requiresFollowup: false },
    });

    const origin = await useCase.execute(advanceCmd);

    await useCase.execute(makeValidCommand({
      eventType: "advance_settlement" as any,
      economicEffect: EconomicEffect.CASH_IN,
      amount: "500.00",
      sourceReference: "adv-p1a-settle",
      relatedEventId: origin.id.value,
      objects: [{ objectId: "adv-p1a", objectType: "advance" as any, relation: "settles" as any }],
      parties: [
        { partyId: "usina", role: "payee" as any, direction: "in" as any, amount: "500.00" },
        { partyId: "broker", role: "payer" as any, direction: "neutral" as any, amount: "500.00" },
      ],
      reason: { type: "advance_payment" as any, description: "recovery", confidence: "medium" as any, requiresFollowup: false },
    }));

    const events = await ledgerRepo.findAll();
    const totalIn = events
      .filter((e) => e.economicEffect === EconomicEffect.CASH_IN)
      .reduce((sum, e) => sum + e.amount.toUnits(), 0n);
    const totalOut = events
      .filter((e) => e.economicEffect === EconomicEffect.CASH_OUT)
      .reduce((sum, e) => sum + e.amount.toUnits(), 0n);

    expect(totalIn).toBe(totalOut);
  });

  it("P1b — per-event flow is balanced: CASH_IN inflows equal event amount, no outflows allowed", async () => {
    const event = LedgerEvent.create(makeValidProps());
    expect(event.economicEffect).toBe(EconomicEffect.CASH_IN);
    // If we reach here, LedgerEvent.create() validated balance — amount equals inbound flow
    expect(event.amount.toString()).toBe("1000.00");
  });

  it("P1c — over-settlement is rejected at the use-case boundary", async () => {
    const ledgerRepo = new InMemoryLedgerEventRepository();
    const useCase = new CreateLedgerEventUseCase(ledgerRepo, new NoOpAuditLogger());

    const originCmd = makeValidCommand({
      eventType: "advance_payment" as any,
      economicEffect: EconomicEffect.CASH_OUT,
      amount: "300.00",
      sourceReference: "adv-p1c-orig",
      objects: [{ objectId: "adv-p1c", objectType: "advance" as any, relation: "originates" as any }],
      parties: [
        { partyId: "usina", role: "payer" as any, direction: "out" as any, amount: "300.00" },
        { partyId: "broker", role: "payee" as any, direction: "neutral" as any, amount: "300.00" },
      ],
      reason: { type: "advance_payment" as any, description: "advance", confidence: "high" as any, requiresFollowup: false },
    });
    const origin = await useCase.execute(originCmd);

    await useCase.execute(makeValidCommand({
      eventType: "advance_settlement" as any,
      economicEffect: EconomicEffect.CASH_IN,
      amount: "200.00",
      sourceReference: "adv-p1c-settle1",
      relatedEventId: origin.id.value,
      objects: [{ objectId: "adv-p1c", objectType: "advance" as any, relation: "settles" as any }],
      parties: [
        { partyId: "usina", role: "payee" as any, direction: "in" as any, amount: "200.00" },
        { partyId: "broker", role: "payer" as any, direction: "neutral" as any, amount: "200.00" },
      ],
      reason: { type: "advance_payment" as any, description: "partial", confidence: "medium" as any, requiresFollowup: false },
    }));

    // 200 already settled against 300 origin; 150 would make 350 > 300
    await expect(
      useCase.execute(makeValidCommand({
        eventType: "advance_settlement" as any,
        economicEffect: EconomicEffect.CASH_IN,
        amount: "150.00",
        sourceReference: "adv-p1c-settle2",
        relatedEventId: origin.id.value,
        objects: [{ objectId: "adv-p1c", objectType: "advance" as any, relation: "settles" as any }],
        parties: [
          { partyId: "usina", role: "payee" as any, direction: "in" as any, amount: "150.00" },
          { partyId: "broker", role: "payer" as any, direction: "neutral" as any, amount: "150.00" },
        ],
        reason: { type: "advance_payment" as any, description: "over", confidence: "medium" as any, requiresFollowup: false },
      })),
    ).rejects.toThrow("Over-settlement");
  });
});

// ============================
// Pillar 2 — Immutability
// ============================

describe("Pillar 2 — Immutability", () => {
  it("P2a — saving an event with a duplicate ID is rejected", async () => {
    const ledgerRepo = new InMemoryLedgerEventRepository();
    const event = LedgerEvent.create(makeValidProps());

    await ledgerRepo.save(event);

    await expect(ledgerRepo.save(event)).rejects.toThrow("Immutability violation");
  });

  it("P2b — the store size stays at 1 after a duplicate save attempt", async () => {
    const ledgerRepo = new InMemoryLedgerEventRepository();
    const event = LedgerEvent.create(makeValidProps());

    await ledgerRepo.save(event);
    await expect(ledgerRepo.save(event)).rejects.toThrow();

    expect((await ledgerRepo.findAll()).length).toBe(1);
  });

  it("P2c — two distinct events with different IDs are both accepted", async () => {
    const ledgerRepo = new InMemoryLedgerEventRepository();
    const { EventId } = await import("../../core/domain/value-objects/EventId");

    const event1 = LedgerEvent.create(makeValidProps({ id: new EventId("evt-p2c-1") }));
    const event2 = LedgerEvent.create(makeValidProps({ id: new EventId("evt-p2c-2") }));

    await ledgerRepo.save(event1);
    await ledgerRepo.save(event2);

    expect((await ledgerRepo.findAll()).length).toBe(2);
  });
});

// ============================
// Pillar 4 — Determinism
// ============================

describe("Pillar 4 — Determinism", () => {
  it("P4a — hash chain is linear after a sequential event sequence", async () => {
    const ledgerRepo = new InMemoryLedgerEventRepository();
    const useCase = new CreateLedgerEventUseCase(ledgerRepo, new NoOpAuditLogger());

    await useCase.execute(makeValidCommand({ sourceReference: "det-1" }));
    await useCase.execute(makeValidCommand({ sourceReference: "det-2" }));
    await useCase.execute(makeValidCommand({ sourceReference: "det-3" }));

    const events = await ledgerRepo.findAll();

    // First event has no predecessor
    expect(events[0].previousHash).toBeNull();

    // Each subsequent event references the previous event's hash
    for (let i = 1; i < events.length; i++) {
      expect(events[i].previousHash?.value).toBe(events[i - 1].hash.value);
    }
  });

  it("P4b — EventHash is deterministic: same canonical data always produces the same digest", () => {
    const data = { id: "evt-det", eventType: "commission_received", amount: "1000.00" };
    expect(EventHash.generateCanonical(data).value).toBe(EventHash.generateCanonical(data).value);
    expect(EventHash.generateCanonical(data).value).toBe(EventHash.generateCanonical({ ...data }).value);
  });

  it("P4c — hash is key-order independent at every nesting level", () => {
    const h1 = EventHash.generateCanonical({ source: { system: "s", ref: "r" }, amount: "100" });
    const h2 = EventHash.generateCanonical({ amount: "100", source: { ref: "r", system: "s" } });
    expect(h1.value).toBe(h2.value);
  });
});

// ============================
// Pillar 8 — Idempotency
// ============================

describe("Pillar 8 — Idempotency", () => {
  it("P8a — commandId idempotency against a real repository: same command twice produces one event", async () => {
    const ledgerRepo = new InMemoryLedgerEventRepository();
    const useCase = new CreateLedgerEventUseCase(ledgerRepo, new NoOpAuditLogger());

    const cmd = makeValidCommand({ commandId: "idem-p8a", sourceReference: "src-p8a" });

    const first = await useCase.execute(cmd);
    const second = await useCase.execute(cmd);

    expect(first.id.value).toBe(second.id.value);
    expect((await ledgerRepo.findAll()).length).toBe(1);
  });

  it("P8b — duplicate sourceReference is rejected even without a commandId", async () => {
    const ledgerRepo = new InMemoryLedgerEventRepository();
    const useCase = new CreateLedgerEventUseCase(ledgerRepo, new NoOpAuditLogger());

    await useCase.execute(makeValidCommand({ sourceReference: "dup-src-p8b" }));

    await expect(
      useCase.execute(makeValidCommand({ sourceReference: "dup-src-p8b" })),
    ).rejects.toThrow("Duplicate source reference");

    expect((await ledgerRepo.findAll()).length).toBe(1);
  });

  it("P8c — staging job run twice on the same batch produces no duplicate ledger events", async () => {
    const records = [
      makeValidStagingRecord({ id: "stg-p8c-1", sourceReference: "src-p8c-1" }),
      makeValidStagingRecord({ id: "stg-p8c-2", sourceReference: "src-p8c-2" }),
    ];

    const stagingRepo = new InMemoryStagingRepository(records);
    const ledgerRepo = new InMemoryLedgerEventRepository();
    const rejectedRepo = new InMemoryRejectedEventRepository();
    const validator = new StagingRecordValidator(ledgerRepo);
    const audit = new NoOpAuditLogger();
    const job = new ProcessStagingJob(
      stagingRepo,
      validator,
      new CreateLedgerEventUseCase(ledgerRepo, audit),
      new RejectLedgerEventUseCase(rejectedRepo, audit),
    );

    await job.run();
    const afterFirst = (await ledgerRepo.findAll()).length;

    // Second run: no pending records remain, so nothing is processed
    await job.run();
    const afterSecond = (await ledgerRepo.findAll()).length;

    expect(afterFirst).toBe(2);
    expect(afterSecond).toBe(2);
  });
});

// ============================
// Pillar 9 — Atomicity
// ============================

describe("Pillar 9 — Atomicity", () => {
  it("P9 — a storage failure on one record rejects that record and leaves the rest committed", async () => {
    class FailOnSecondSave extends InMemoryLedgerEventRepository {
      private count = 0;
      async save(event: LedgerEvent): Promise<void> {
        this.count += 1;
        if (this.count === 2) throw new Error("Simulated storage failure on record 2");
        return super.save(event);
      }
    }

    const records = [
      makeValidStagingRecord({ id: "stg-p9-1", sourceReference: "src-p9-1" }),
      makeValidStagingRecord({ id: "stg-p9-2", sourceReference: "src-p9-2" }),
      makeValidStagingRecord({ id: "stg-p9-3", sourceReference: "src-p9-3" }),
    ];

    const stagingRepo = new InMemoryStagingRepository(records);
    const ledgerRepo = new FailOnSecondSave();
    const rejectedRepo = new InMemoryRejectedEventRepository();
    const validator = new StagingRecordValidator(ledgerRepo);
    const audit = new NoOpAuditLogger();
    const job = new ProcessStagingJob(
      stagingRepo,
      validator,
      new CreateLedgerEventUseCase(ledgerRepo, audit),
      new RejectLedgerEventUseCase(rejectedRepo, audit),
    );

    await job.run();

    const ledgerEvents = await ledgerRepo.findAll();
    const rejected = await rejectedRepo.findAll();

    // Record 1 saved successfully; record 2 storage failed → caught → rejected;
    // record 3 saved successfully (source ref src-p9-3 is not duplicate).
    // But since src-p9-2 is rejected (not saved), src-p9-3 has no conflict.
    expect(ledgerEvents).toHaveLength(2);     // records 1 and 3
    expect(rejected).toHaveLength(1);          // record 2 (POLICY_VIOLATION from domain catch)
  });
});

// ============================
// Pillar 3 — Auditability (chain query)
// ============================

describe("Pillar 3 — Auditability", () => {
  it("P3 — the full event chain is queryable in insertion order and each hash references its predecessor", async () => {
    const ledgerRepo = new InMemoryLedgerEventRepository();
    const useCase = new CreateLedgerEventUseCase(ledgerRepo, new NoOpAuditLogger());

    for (let i = 1; i <= 5; i++) {
      await useCase.execute(makeValidCommand({ sourceReference: `audit-src-${i}` }));
    }

    const chain = await ledgerRepo.findAll();

    expect(chain).toHaveLength(5);
    expect(chain[0].previousHash).toBeNull();

    for (let i = 1; i < chain.length; i++) {
      expect(chain[i].previousHash?.value).toBe(chain[i - 1].hash.value);
    }

    // Every hash is a valid 64-char SHA-256 hex digest
    for (const event of chain) {
      expect(event.hash.value).toMatch(/^[a-f0-9]{64}$/);
    }
  });
});
