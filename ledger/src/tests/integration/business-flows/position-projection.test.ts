import { describe, expect, it } from "vitest";
import { EconomicEffect } from "../../../core/domain/enums/EconomicEffect";
import { ReasonType } from "../../../core/domain/enums/ReasonType";
import { Relation } from "../../../core/domain/enums/Relation";
import { PositionProjectionService } from "../../../core/application/services/PositionProjectionService";
import { advancePayment, advanceSettlement } from "./helpers/commands/advance-commands";
import { commissionReceived } from "./helpers/commands/commission-commands";
import { loanOrigination, loanRepayment } from "./helpers/commands/loan-commands";
import { makeRef } from "./helpers/ref";
import { setup } from "./helpers/setup";

const ref = makeRef();

function makeService(ledgerRepo: ReturnType<typeof setup>["ledgerRepo"]) {
  return new PositionProjectionService(ledgerRepo);
}

describe("PositionProjectionService", () => {
  describe("summarize()", () => {
    it("PP1 — returns null for an unknown objectId", async () => {
      const { ledgerRepo } = setup();
      const svc = makeService(ledgerRepo);
      expect(await svc.summarize("does-not-exist")).toBeNull();
    });

    it("PP2 — open position: originated but never settled", async () => {
      const { ledgerRepo, run } = setup();

      await run(loanOrigination(ref, "loan-pp2", "1000.00"));

      const svc = makeService(ledgerRepo);
      const summary = await svc.summarize("loan-pp2");

      expect(summary).not.toBeNull();
      expect(summary!.status).toBe("open");
      expect(summary!.outcome).toBe("pending");
      expect(summary!.totalOriginated.toString()).toBe("1000.00");
      expect(summary!.totalSettled.toString()).toBe("0.00");
      expect(summary!.openBalance.toString()).toBe("1000.00");
      expect(summary!.cashRecovered.toString()).toBe("0.00");
      expect(summary!.eventCount).toBe(1);
    });

    it("PP3 — fully settled via cash: gain outcome", async () => {
      const { ledgerRepo, run } = setup();

      const loan = await run(loanOrigination(ref, "loan-pp3", "1000.00"));
      await run(
        loanRepayment(ref, "loan-pp3", loan.id.value, EconomicEffect.CASH_IN, Relation.SETTLES, ReasonType.LOAN_REPAYMENT, "1000.00"),
      );

      const svc = makeService(ledgerRepo);
      const summary = await svc.summarize("loan-pp3");

      expect(summary!.status).toBe("fully_settled");
      expect(summary!.outcome).toBe("gain");
      expect(summary!.openBalance.toString()).toBe("0.00");
      expect(summary!.cashRecovered.toString()).toBe("1000.00");
      expect(summary!.nonCashClosed.toString()).toBe("0.00");
      expect(summary!.eventCount).toBe(2);
    });

    it("PP4 — partially settled: pending outcome", async () => {
      const { ledgerRepo, run } = setup();

      const loan = await run(loanOrigination(ref, "loan-pp4", "1000.00"));
      await run(
        loanRepayment(ref, "loan-pp4", loan.id.value, EconomicEffect.CASH_IN, Relation.SETTLES, ReasonType.LOAN_REPAYMENT, "400.00"),
      );

      const svc = makeService(ledgerRepo);
      const summary = await svc.summarize("loan-pp4");

      expect(summary!.status).toBe("partially_settled");
      expect(summary!.outcome).toBe("pending");
      expect(summary!.totalOriginated.toString()).toBe("1000.00");
      expect(summary!.totalSettled.toString()).toBe("400.00");
      expect(summary!.openBalance.toString()).toBe("600.00");
    });

    it("PP5 — full loss: originated 500, settled 500 via NON_CASH loss recognition", async () => {
      const { ledgerRepo, run } = setup();

      const advance = await run(advancePayment(ref, "adv-pp5", "500.00"));
      await run(
        advanceSettlement(
          ref, "adv-pp5", advance.id.value,
          Relation.SETTLES, EconomicEffect.NON_CASH, "500.00", ReasonType.LOSS_RECOGNITION,
        ),
      );

      const svc = makeService(ledgerRepo);
      const summary = await svc.summarize("adv-pp5");

      expect(summary!.status).toBe("fully_settled");
      expect(summary!.outcome).toBe("full_loss");
      expect(summary!.cashRecovered.toString()).toBe("0.00");
      expect(summary!.nonCashClosed.toString()).toBe("500.00");
    });

    it("PP6 — partial loss: some cash recovered, remainder written off", async () => {
      const { ledgerRepo, run } = setup();

      const advance = await run(advancePayment(ref, "adv-pp6", "500.00"));
      await run(
        advanceSettlement(
          ref, "adv-pp6", advance.id.value,
          Relation.SETTLES, EconomicEffect.CASH_IN, "200.00", ReasonType.ADVANCE_PAYMENT,
        ),
      );
      await run(
        advanceSettlement(
          ref, "adv-pp6", advance.id.value,
          Relation.SETTLES, EconomicEffect.NON_CASH, "300.00", ReasonType.LOSS_RECOGNITION,
        ),
      );

      const svc = makeService(ledgerRepo);
      const summary = await svc.summarize("adv-pp6");

      expect(summary!.status).toBe("fully_settled");
      expect(summary!.outcome).toBe("partial_loss");
      expect(summary!.cashRecovered.toString()).toBe("200.00");
      expect(summary!.nonCashClosed.toString()).toBe("300.00");
    });

    it("PP7 — reversed position: cancelled outcome", async () => {
      // A commission entitlement waived (REVERSES relation) is cancelled
      const { ledgerRepo, run } = setup();

      await run(commissionReceived(ref, "com-pp7", "700.00"));

      // Inject a REVERSES via reconstitute to simulate a LEDGER_CORRECTION reversing the object
      const { LedgerEvent } = await import("../../../core/domain/entities/LedgerEvent");
      const { EventId } = await import("../../../core/domain/value-objects/EventId");
      const { EventSource } = await import("../../../core/domain/value-objects/EventSource");
      const { NormalizationMetadata } = await import("../../../core/domain/value-objects/NormalizationMetadata");
      const { EventHash } = await import("../../../core/domain/value-objects/EventHash");
      const { Money } = await import("../../../core/domain/value-objects/Money");
      const { EventType } = await import("../../../core/domain/enums/EventType");
      const { EconomicEffect: Effect } = await import("../../../core/domain/enums/EconomicEffect");
      const { ObjectType } = await import("../../../core/domain/enums/ObjectType");
      const { EventReason } = await import("../../../core/domain/entities/EventReason");
      const { ReasonType: RT } = await import("../../../core/domain/enums/ReasonType");
      const { ConfidenceLevel } = await import("../../../core/domain/enums/ConfidenceLevel");
      const { LedgerEventObject } = await import("../../../core/domain/entities/LedgerEconomicObject");
      const { ObjectId } = await import("../../../core/domain/value-objects/ObjectId");
      const { EventReporter } = await import("../../../core/domain/entities/EventReporter");
      const { ReporterType } = await import("../../../core/domain/enums/ReporterType");
      const { LedgerEventParty } = await import("../../../core/domain/entities/LedgerEventParty");
      const { PartyId } = await import("../../../core/domain/value-objects/PartyId");
      const { PartyRole } = await import("../../../core/domain/enums/PartyRole");
      const { Direction } = await import("../../../core/domain/enums/Direction");
      const { USINA } = await import("./helpers/parties");

      const correction = LedgerEvent.reconstitute({
        id: new EventId("evt-correction-pp7"),
        eventType: EventType.LEDGER_CORRECTION,
        economicEffect: Effect.NON_CASH,
        occurredAt: new Date(),
        recordedAt: new Date(),
        sourceAt: null,
        amount: Money.fromDecimal("700.00", "BRL"),
        description: "reversal of com-pp7",
        source: new EventSource("normalizer", "correction-pp7"),
        normalization: new NormalizationMetadata("1.0", "worker-test"),
        hash: EventHash.generateCanonical({ id: "evt-correction-pp7", seed: "pp7" }),
        previousHash: null,
        commandId: null,
        relatedEventId: null,
        parties: [
          new LedgerEventParty(new PartyId(USINA), PartyRole.PAYER, Direction.NEUTRAL, Money.fromDecimal("700.00", "BRL")),
        ],
        objects: [
          new LedgerEventObject(new ObjectId("com-pp7"), ObjectType.COMMISSION_RECEIVABLE, Relation.REVERSES),
        ],
        reason: new EventReason(RT.MANUAL_CORRECTION, "reversal", ConfidenceLevel.HIGH, false),
        reporter: new EventReporter(ReporterType.SYSTEM, "worker-test", null, new Date(), "integration-test"),
      });

      await ledgerRepo.save(correction);

      const svc = makeService(ledgerRepo);
      const summary = await svc.summarize("com-pp7");

      expect(summary!.status).toBe("reversed");
      expect(summary!.outcome).toBe("cancelled");
    });
  });

  describe("summarizeAll() and streamAll()", () => {
    it("PP8 — summarizeAll returns one summary per unique objectId", async () => {
      const { ledgerRepo, run } = setup();

      await run(loanOrigination(ref, "loan-pp8-a", "1000.00"));
      await run(loanOrigination(ref, "loan-pp8-b", "500.00"));
      await run(commissionReceived(ref, "com-pp8-c", "700.00"));

      const svc = makeService(ledgerRepo);
      const summaries = await svc.summarizeAll();
      const ids = summaries.map((s) => s.objectId).sort();

      expect(ids).toContain("loan-pp8-a");
      expect(ids).toContain("loan-pp8-b");
      expect(ids).toContain("com-pp8-c");
    });

    it("PP9 — streamAll respects batchSize and yields same count as summarizeAll", async () => {
      const { ledgerRepo, run } = setup();

      for (let i = 0; i < 10; i++) {
        await run(loanOrigination(ref, `loan-pp9-${i}`, "100.00"));
      }

      // Use tiny batch to exercise multi-batch path
      const svc = new PositionProjectionService(ledgerRepo, 3);
      const streamed: string[] = [];
      for await (const s of svc.streamAll()) {
        streamed.push(s.objectId);
      }

      const collected = await svc.summarizeAll();

      expect(streamed.length).toBe(10);
      expect(collected.length).toBe(10);
    });

    it("PP10 — summarizeAll on empty ledger returns empty array", async () => {
      const { ledgerRepo } = setup();
      const svc = makeService(ledgerRepo);
      expect(await svc.summarizeAll()).toEqual([]);
    });
  });
});
