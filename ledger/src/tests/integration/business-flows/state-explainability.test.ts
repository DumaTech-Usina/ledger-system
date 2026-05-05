import { describe, expect, it } from "vitest";
import { LedgerEvent } from "../../../core/domain/entities/LedgerEvent";
import { EventReason } from "../../../core/domain/entities/EventReason";
import { EventReporter } from "../../../core/domain/entities/EventReporter";
import { LedgerEventObject } from "../../../core/domain/entities/LedgerEconomicObject";
import { LedgerEventParty } from "../../../core/domain/entities/LedgerEventParty";
import { ConfidenceLevel } from "../../../core/domain/enums/ConfidenceLevel";
import { Direction } from "../../../core/domain/enums/Direction";
import { EconomicEffect } from "../../../core/domain/enums/EconomicEffect";
import { EventType } from "../../../core/domain/enums/EventType";
import { ObjectType } from "../../../core/domain/enums/ObjectType";
import { PartyRole } from "../../../core/domain/enums/PartyRole";
import { ReasonType } from "../../../core/domain/enums/ReasonType";
import { Relation } from "../../../core/domain/enums/Relation";
import { ReporterType } from "../../../core/domain/enums/ReporterType";
import { EventHash } from "../../../core/domain/value-objects/EventHash";
import { EventId } from "../../../core/domain/value-objects/EventId";
import { EventSource } from "../../../core/domain/value-objects/EventSource";
import { Money } from "../../../core/domain/value-objects/Money";
import { NormalizationMetadata } from "../../../core/domain/value-objects/NormalizationMetadata";
import { ObjectId } from "../../../core/domain/value-objects/ObjectId";
import { PartyId } from "../../../core/domain/value-objects/PartyId";
import { BROKER, TAX_AUTH, USINA } from "./helpers/parties";
import { advancePayment, advanceSettlement } from "./helpers/commands/advance-commands";
import {
  commissionReceived,
  commissionSplit,
  directPaymentAcknowledged,
} from "./helpers/commands/commission-commands";
import { loanOrigination, loanRepayment } from "./helpers/commands/loan-commands";
import { makeRef } from "./helpers/ref";
import { setup } from "./helpers/setup";

const ref = makeRef();

function amountOf(event: LedgerEvent): number {
  return Number(event.amount.toString());
}

function sumAmounts(events: LedgerEvent[]): number {
  return events.reduce((total, event) => total + amountOf(event), 0);
}

function roundCurrency(value: number): number {
  return Number(value.toFixed(2));
}

function partyAmountOf(event: LedgerEvent, partyId: string): number {
  const party = event.getParties().find((item) => item.partyId.value === partyId);
  return party?.amount ? Number(party.amount.toString()) : 0;
}

function deriveOriginAmount(events: LedgerEvent[], originType: EventType): number | null {
  const origin = events.find((event) => event.eventType === originType);
  return origin ? amountOf(origin) : null;
}

function ensureOrdered(events: LedgerEvent[]) {
  for (let i = 1; i < events.length; i += 1) {
    expect(events[i].recordedAt.getTime()).toBeGreaterThanOrEqual(
      events[i - 1].recordedAt.getTime(),
    );
  }
}

function orphanIds(events: LedgerEvent[]): string[] {
  const ids = new Set(events.map((event) => event.id.value));
  return events
    .filter((event) => event.relatedEventId && !ids.has(event.relatedEventId))
    .map((event) => event.id.value);
}

describe("State explainability", () => {
  it("E1 — outstanding loan balance is derivable from origination and repayments", async () => {
    const { ledgerRepo, run } = setup();

    const loan = await run(loanOrigination(ref, "loan-e1", "1000.00"));
    await run(
      loanRepayment(ref, "loan-e1", loan.id.value, EconomicEffect.CASH_IN, Relation.SETTLES, ReasonType.LOAN_REPAYMENT, "300.00"),
    );
    await run(
      loanRepayment(ref, "loan-e1", loan.id.value, EconomicEffect.CASH_IN, Relation.SETTLES, ReasonType.LOAN_REPAYMENT, "200.00"),
    );

    const lifecycle = await ledgerRepo.findByObjectId("loan-e1");
    const settlements = await ledgerRepo.findByRelatedEventId(loan.id.value);

    const originated = deriveOriginAmount(lifecycle, EventType.LOAN_ORIGINATION);
    const settled = sumAmounts(settlements);
    const remaining = roundCurrency((originated ?? 0) - settled);

    expect(originated).toBe(1000);
    expect(settled).toBe(500);
    expect(remaining).toBe(500);
  });

  it("E2 — advance recovery tracking exposes remaining recoverable amount", async () => {
    const { ledgerRepo, run } = setup();

    const advance = await run(advancePayment(ref, "adv-e2", "500.00"));
    await run(
      advanceSettlement(ref, "adv-e2", advance.id.value, Relation.SETTLES, EconomicEffect.CASH_IN, "300.00", ReasonType.ADVANCE_PAYMENT),
    );

    const lifecycle = await ledgerRepo.findByObjectId("adv-e2");
    const recoveries = await ledgerRepo.findByRelatedEventId(advance.id.value);

    const advanced = deriveOriginAmount(lifecycle, EventType.ADVANCE_PAYMENT);
    const recovered = sumAmounts(recoveries);
    const remaining = roundCurrency((advanced ?? 0) - recovered);

    expect(advanced).toBe(500);
    expect(recovered).toBe(300);
    expect(remaining).toBe(200);
  });

  it("E3 — received commission amount is exactly what is stored; expected-vs-outstanding gap requires a separate expected-amount fact", async () => {
    // What IS derivable today: the exact amount received against a commission object.
    // What is NOT derivable: a contractual "expected" amount (e.g. 1000) when only 700
    // was recorded — because the data model has no separate expected-amount event.
    // Detecting shortfalls requires a first-class "COMMISSION_EXPECTED" event or equivalent.
    // This is documented in CLAUDE.md Fix Roadmap (no position balance enforcement).
    const { ledgerRepo, run } = setup();

    await run({
      ...commissionReceived(ref, "com-e3", "700.00"),
      objects: [
        { objectId: "com-e3", objectType: ObjectType.COMMISSION_RECEIVABLE, relation: Relation.SETTLES },
        { objectId: "inst-e3", objectType: ObjectType.INSTALLMENT, relation: Relation.REFERENCES },
      ],
    });

    const installmentEvents = await ledgerRepo.findByObjectId("inst-e3");
    const received = installmentEvents
      .filter((e) => e.eventType === EventType.COMMISSION_RECEIVED)
      .reduce((total, e) => total + amountOf(e), 0);

    // The ledger records exactly what arrived — no phantom expected amount
    expect(received).toBe(700);
    // Outstanding (vs a contractual 1000) is not derivable from events alone
    // — the 300 shortfall is invisible until an expected-amount fact is stored
    expect(installmentEvents.every((e) => e.amount.toString() !== "1000.00")).toBe(true);
  });

  it("E4 — settlement batch balance exposes pending allocation", async () => {
    const { ledgerRepo, run } = setup();

    await run({
      ...commissionReceived(ref, "com-e4-recv", "1000.00"),
      objects: [
        { objectId: "com-e4-recv", objectType: ObjectType.COMMISSION_RECEIVABLE, relation: Relation.SETTLES },
        { objectId: "batch-e4", objectType: ObjectType.SETTLEMENT_BATCH, relation: Relation.REFERENCES },
      ],
    });
    await run({
      ...commissionSplit(ref, "com-e4-split", "700.00"),
      objects: [
        { objectId: "com-e4-split", objectType: ObjectType.COMMISSION_PAYABLE, relation: Relation.SETTLES },
        { objectId: "batch-e4", objectType: ObjectType.SETTLEMENT_BATCH, relation: Relation.REFERENCES },
      ],
    });

    const batchEvents = await ledgerRepo.findByObjectId("batch-e4");
    const received = sumAmounts(
      batchEvents.filter((event) => event.eventType === EventType.COMMISSION_RECEIVED),
    );
    const allocated = sumAmounts(
      batchEvents.filter((event) => event.eventType === EventType.COMMISSION_SPLIT),
    );
    const pending = roundCurrency(received - allocated);

    expect(received).toBe(1000);
    expect(allocated).toBe(700);
    expect(pending).toBe(300);
  });

  it("E5 — broker payable amount is explicitly derivable from a commission split", async () => {
    const { ledgerRepo, run } = setup();

    await run(commissionSplit(ref, "com-e5", "700.00"));

    const payableEvents = await ledgerRepo.findByObjectId("com-e5");
    const splitEvent = payableEvents.find((event) => event.eventType === EventType.COMMISSION_SPLIT);
    const brokerPayable = splitEvent ? partyAmountOf(splitEvent, BROKER) : 0;

    expect(splitEvent?.amount.toString()).toBe("700.00");
    expect(brokerPayable).toBe(560);
  });

  it("E6 — tax liability is explicitly derivable from a commission split", async () => {
    const { ledgerRepo, run } = setup();

    await run(commissionSplit(ref, "com-e6", "700.00"));

    const payableEvents = await ledgerRepo.findByObjectId("com-e6");
    const splitEvent = payableEvents.find((event) => event.eventType === EventType.COMMISSION_SPLIT);
    const taxPayable = splitEvent ? partyAmountOf(splitEvent, TAX_AUTH) : 0;

    expect(splitEvent?.amount.toString()).toBe("700.00");
    expect(taxPayable).toBe(140);
  });

  it("E7 — mixed payment channels can be reconciled without duplication", async () => {
    const { ledgerRepo, run } = setup();

    await run(
      directPaymentAcknowledged(
        ref,
        "com-e7",
        ObjectType.COMMISSION_RECEIVABLE,
        ReasonType.DIRECT_COMMISSION_PAYMENT_AUTHORIZED,
        ConfidenceLevel.HIGH,
        "operator paid BRL 300.00 directly",
        "300.00",
      ),
    );
    await run(commissionReceived(ref, "com-e7", "700.00"));

    const lifecycle = await ledgerRepo.findByObjectId("com-e7");
    const settled = sumAmounts(
      lifecycle.filter(
        (event) =>
          event.eventType === EventType.COMMISSION_RECEIVED ||
          event.eventType === EventType.DIRECT_PAYMENT_ACKNOWLEDGED,
      ),
    );

    expect(lifecycle.map((event) => event.eventType)).toEqual([
      EventType.DIRECT_PAYMENT_ACKNOWLEDGED,
      EventType.COMMISSION_RECEIVED,
    ]);
    expect(settled).toBe(1000);
    expect(new Set(lifecycle.map((event) => event.id.value)).size).toBe(2);
  });

  it("E8 — a full lifecycle can reconstruct originated, repaid, and remaining debt", async () => {
    const { ledgerRepo, run } = setup();

    const loan = await run(loanOrigination(ref, "loan-e8", "1000.00"));
    await run(commissionReceived(ref, "com-e8", "700.00"));
    await run(
      loanRepayment(ref, "loan-e8", loan.id.value, EconomicEffect.CASH_IN, Relation.SETTLES, ReasonType.LOAN_REPAYMENT, "300.00"),
    );
    await run(
      loanRepayment(ref, "loan-e8", loan.id.value, EconomicEffect.NON_CASH, Relation.ADJUSTS, ReasonType.LOAN_REPAYMENT_VIA_COMMISSION, "200.00"),
    );
    await run(commissionSplit(ref, "com-e8", "700.00"));

    const loanLifecycle = await ledgerRepo.findByObjectId("loan-e8");
    const repayments = await ledgerRepo.findByRelatedEventId(loan.id.value);

    const originated = deriveOriginAmount(loanLifecycle, EventType.LOAN_ORIGINATION);
    const repaid = sumAmounts(repayments);
    const remaining = roundCurrency((originated ?? 0) - repaid);

    expect(loanLifecycle.map((event) => event.eventType)).toEqual([
      EventType.LOAN_ORIGINATION,
      EventType.LOAN_REPAYMENT,
      EventType.LOAN_REPAYMENT,
    ]);
    expect(originated).toBe(1000);
    expect(repaid).toBe(500);
    expect(remaining).toBe(500);
  });

  it("E9 — orphaned relatedEventId values injected via reconstitute are discoverable by explainability queries", async () => {
    // Scenario: an event with a ghost relatedEventId was injected into the ledger
    // bypassing use-case validation (simulating a data migration artefact or a future bug).
    // reconstitute() is the legitimate path for forensic/migration data ingestion.
    // The audit query must still surface this as an orphan so it can be investigated.
    const { ledgerRepo } = setup();

    const orphan = LedgerEvent.reconstitute({
      id: new EventId("evt-orphan-e9"),
      eventType: EventType.LOAN_REPAYMENT,
      economicEffect: EconomicEffect.CASH_IN,
      occurredAt: new Date("2025-05-01"),
      recordedAt: new Date(),
      sourceAt: null,
      amount: Money.fromDecimal("300.00", "BRL"),
      description: null,
      source: new EventSource("normalizer", "orphan-ref-e9"),
      normalization: new NormalizationMetadata("1.0", "worker-test"),
      hash: EventHash.generateCanonical({ id: "evt-orphan-e9", seed: "e9" }),
      previousHash: null,
      commandId: null,
      relatedEventId: "evt-ghost-origin",
      parties: [
        new LedgerEventParty(new PartyId(USINA), PartyRole.PAYEE, Direction.IN, Money.fromDecimal("300.00", "BRL")),
        new LedgerEventParty(new PartyId(BROKER), PartyRole.PAYER, Direction.NEUTRAL, Money.fromDecimal("300.00", "BRL")),
      ],
      objects: [
        new LedgerEventObject(new ObjectId("loan-e9"), ObjectType.LOAN, Relation.SETTLES),
      ],
      reason: new EventReason(ReasonType.LOAN_REPAYMENT, "forensic repayment", ConfidenceLevel.MEDIUM, false),
      reporter: new EventReporter(ReporterType.SYSTEM, "worker-test", null, new Date(), "integration-test"),
    });

    await ledgerRepo.save(orphan);

    const events = await ledgerRepo.findAll();
    const orphans = orphanIds(events);

    expect(orphans).toHaveLength(1);
    expect(orphans[0]).toBe("evt-orphan-e9");
  });

  it("E10 — audit trace completeness is retrievable and ordered for a settlement batch", async () => {
    const { ledgerRepo, run } = setup();

    await run({
      ...commissionReceived(ref, "com-e10-recv", "1000.00"),
      objects: [
        { objectId: "com-e10-recv", objectType: ObjectType.COMMISSION_RECEIVABLE, relation: Relation.SETTLES },
        { objectId: "batch-e10", objectType: ObjectType.SETTLEMENT_BATCH, relation: Relation.REFERENCES },
      ],
    });
    await run({
      ...commissionSplit(ref, "com-e10-split", "700.00"),
      objects: [
        { objectId: "com-e10-split", objectType: ObjectType.COMMISSION_PAYABLE, relation: Relation.SETTLES },
        { objectId: "batch-e10", objectType: ObjectType.SETTLEMENT_BATCH, relation: Relation.REFERENCES },
      ],
    });

    const batchTrace = await ledgerRepo.findByObjectId("batch-e10");

    ensureOrdered(batchTrace);
    expect(batchTrace).toHaveLength(2);
    expect(batchTrace.map((event) => event.eventType)).toEqual([
      EventType.COMMISSION_RECEIVED,
      EventType.COMMISSION_SPLIT,
    ]);
    expect(batchTrace[1].previousHash?.value).toBe(batchTrace[0].hash.value);
  });
});
