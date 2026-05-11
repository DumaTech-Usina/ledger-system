import { describe, it, expect } from "vitest";
import { CashPositionService } from "../../../core/application/services/CashPositionService";
import { InMemoryLedgerEventRepository } from "../../../infra/persistence/ledger/InMemoryLedgerEventRepository";
import { CreateLedgerEventUseCase } from "../../../core/application/use-cases/CreateLedgerEventUseCase";
import { NoOpAuditLogger } from "../../../infra/audit/NoOpAuditLogger";
import { makeValidCommand } from "../../fixtures";
import { EconomicEffect } from "../../../core/domain/enums/EconomicEffect";
import { EventType } from "../../../core/domain/enums/EventType";
import { ObjectType } from "../../../core/domain/enums/ObjectType";
import { Relation } from "../../../core/domain/enums/Relation";
import { Direction } from "../../../core/domain/enums/Direction";
import { PartyRole } from "../../../core/domain/enums/PartyRole";
import { ReasonType } from "../../../core/domain/enums/ReasonType";
import { ConfidenceLevel } from "../../../core/domain/enums/ConfidenceLevel";

let _seq = 0;
const ref = () => `ref-cp-${++_seq}`;

function makeSvc(repo: InMemoryLedgerEventRepository) {
  return new CashPositionService(repo);
}

async function createLoan(
  repo: InMemoryLedgerEventRepository,
  objectId: string,
  amount: string,
) {
  const uc = new CreateLedgerEventUseCase(repo, new NoOpAuditLogger());
  return uc.execute(makeValidCommand({
    sourceReference: ref(),
    eventType: EventType.LOAN_ORIGINATION,
    economicEffect: EconomicEffect.CASH_OUT,
    amount,
    objects: [{ objectId, objectType: ObjectType.LOAN, relation: Relation.ORIGINATES }],
    parties: [
      { partyId: "usina", role: PartyRole.PAYER, direction: Direction.OUT, amount },
      { partyId: "broker", role: PartyRole.PAYEE, direction: Direction.NEUTRAL, amount },
    ],
    reason: { type: ReasonType.LOAN_ORIGINATION, description: "loan", confidence: ConfidenceLevel.HIGH, requiresFollowup: false },
  }));
}

async function repayLoan(
  repo: InMemoryLedgerEventRepository,
  objectId: string,
  relatedEventId: string,
  amount: string,
  effect: EconomicEffect = EconomicEffect.CASH_IN,
) {
  const uc = new CreateLedgerEventUseCase(repo, new NoOpAuditLogger());
  const parties = effect === EconomicEffect.NON_CASH
    ? [{ partyId: "broker", role: PartyRole.BENEFICIARY, direction: Direction.NEUTRAL }]
    : [
        { partyId: "usina", role: PartyRole.PAYEE, direction: Direction.IN, amount },
        { partyId: "broker", role: PartyRole.PAYER, direction: Direction.NEUTRAL, amount },
      ];
  return uc.execute(makeValidCommand({
    sourceReference: ref(),
    eventType: EventType.LOAN_REPAYMENT,
    economicEffect: effect,
    amount,
    relatedEventId,
    objects: [{ objectId, objectType: ObjectType.LOAN, relation: Relation.SETTLES }],
    parties,
    reason: { type: ReasonType.LOAN_REPAYMENT, description: "repay", confidence: ConfidenceLevel.MEDIUM, requiresFollowup: false },
  }));
}

async function createAdvance(
  repo: InMemoryLedgerEventRepository,
  objectId: string,
  amount: string,
) {
  const uc = new CreateLedgerEventUseCase(repo, new NoOpAuditLogger());
  return uc.execute(makeValidCommand({
    sourceReference: ref(),
    eventType: EventType.ADVANCE_PAYMENT,
    economicEffect: EconomicEffect.CASH_OUT,
    amount,
    objects: [{ objectId, objectType: ObjectType.ADVANCE, relation: Relation.ORIGINATES }],
    parties: [
      { partyId: "usina", role: PartyRole.PAYER, direction: Direction.OUT, amount },
      { partyId: "broker", role: PartyRole.PAYEE, direction: Direction.NEUTRAL, amount },
    ],
    reason: { type: ReasonType.ADVANCE_PAYMENT, description: "advance", confidence: ConfidenceLevel.HIGH, requiresFollowup: false },
  }));
}

async function settleAdvance(
  repo: InMemoryLedgerEventRepository,
  objectId: string,
  relatedEventId: string,
  amount: string,
  effect: EconomicEffect,
  reason: ReasonType = ReasonType.ADVANCE_PAYMENT,
) {
  const uc = new CreateLedgerEventUseCase(repo, new NoOpAuditLogger());
  const parties = effect === EconomicEffect.NON_CASH
    ? [{ partyId: "broker", role: PartyRole.BENEFICIARY, direction: Direction.NEUTRAL }]
    : [
        { partyId: "usina", role: PartyRole.PAYEE, direction: Direction.IN, amount },
        { partyId: "broker", role: PartyRole.PAYER, direction: Direction.NEUTRAL, amount },
      ];
  return uc.execute(makeValidCommand({
    sourceReference: ref(),
    eventType: EventType.ADVANCE_SETTLEMENT,
    economicEffect: effect,
    amount,
    relatedEventId,
    objects: [{ objectId, objectType: ObjectType.ADVANCE, relation: Relation.SETTLES }],
    parties,
    reason: { type: reason, description: "settle", confidence: ConfidenceLevel.MEDIUM, requiresFollowup: false },
  }));
}

async function createPenalty(
  repo: InMemoryLedgerEventRepository,
  objectId: string,
  amount: string,
) {
  const uc = new CreateLedgerEventUseCase(repo, new NoOpAuditLogger());
  return uc.execute(makeValidCommand({
    sourceReference: ref(),
    eventType: EventType.PENALTY_PAYMENT,
    economicEffect: EconomicEffect.CASH_OUT,
    amount,
    objects: [{ objectId, objectType: ObjectType.PENALTY, relation: Relation.SETTLES }],
    parties: [
      { partyId: "usina", role: PartyRole.PAYER, direction: Direction.OUT, amount },
    ],
    reason: { type: ReasonType.PENALTY_PAYMENT, description: "penalty", confidence: ConfidenceLevel.HIGH, requiresFollowup: false },
  }));
}

async function createCommissionReceived(
  repo: InMemoryLedgerEventRepository,
  objectId: string,
  amount: string,
) {
  const uc = new CreateLedgerEventUseCase(repo, new NoOpAuditLogger());
  return uc.execute(makeValidCommand({
    sourceReference: ref(),
    eventType: EventType.COMMISSION_RECEIVED,
    economicEffect: EconomicEffect.CASH_IN,
    amount,
    objects: [{ objectId, objectType: ObjectType.COMMISSION_RECEIVABLE, relation: Relation.SETTLES }],
    parties: [
      { partyId: "usina", role: PartyRole.PAYEE, direction: Direction.IN, amount },
      { partyId: "broker", role: PartyRole.BENEFICIARY, direction: Direction.NEUTRAL, amount },
    ],
    reason: { type: ReasonType.COMMISSION_PAYMENT, description: "commission", confidence: ConfidenceLevel.MEDIUM, requiresFollowup: false },
  }));
}

describe("CashPositionService", () => {
  it("CP1 — empty ledger: all fields are zero", async () => {
    const repo = new InMemoryLedgerEventRepository();
    const result = await makeSvc(repo).summarize();

    expect(result.totalCashIn.toString()).toBe("0.00");
    expect(result.totalCashIn.currency).toBe("BRL");
    expect(result.totalCashOut.toString()).toBe("0.00");
    expect(result.openReceivables.toString()).toBe("0.00");
    expect(result.contingentExposure.toString()).toBe("0.00");
  });

  it("CP2 — only CASH_IN events: totalCashIn accumulates, totalCashOut = 0", async () => {
    const repo = new InMemoryLedgerEventRepository();
    await createCommissionReceived(repo, "obj-cp2a", "1000.00");
    await createCommissionReceived(repo, "obj-cp2b", "500.00");

    const result = await makeSvc(repo).summarize();
    expect(result.totalCashIn.toString()).toBe("1500.00");
    expect(result.totalCashOut.toString()).toBe("0.00");
  });

  it("CP3 — only CASH_OUT events: totalCashOut accumulates, totalCashIn = 0", async () => {
    const repo = new InMemoryLedgerEventRepository();
    await createLoan(repo, "obj-cp3a", "2000.00");
    await createAdvance(repo, "obj-cp3b", "800.00");

    const result = await makeSvc(repo).summarize();
    expect(result.totalCashOut.toString()).toBe("2800.00");
    expect(result.totalCashIn.toString()).toBe("0.00");
  });

  it("CP4 — mixed CASH_IN + CASH_OUT: both sides accumulate independently", async () => {
    const repo = new InMemoryLedgerEventRepository();
    await createCommissionReceived(repo, "obj-cp4-com", "3000.00");
    const loan = await createLoan(repo, "obj-cp4-loan", "1000.00");
    await repayLoan(repo, "obj-cp4-loan", loan.id.value, "1000.00");

    const result = await makeSvc(repo).summarize();
    expect(result.totalCashIn.toString()).toBe("4000.00");
    expect(result.totalCashOut.toString()).toBe("1000.00");
  });

  it("CP5 — NON_CASH events only: neither side is affected", async () => {
    const repo = new InMemoryLedgerEventRepository();
    const uc = new CreateLedgerEventUseCase(repo, new NoOpAuditLogger());
    await uc.execute(makeValidCommand({
      sourceReference: ref(),
      eventType: EventType.COMMISSION_WAIVER,
      economicEffect: EconomicEffect.NON_CASH,
      amount: "500.00",
      objects: [{ objectId: "obj-cp5", objectType: ObjectType.COMMISSION_ENTITLEMENT, relation: Relation.SETTLES }],
      parties: [{ partyId: "broker", role: PartyRole.BENEFICIARY, direction: Direction.NEUTRAL }],
      reason: { type: ReasonType.COMMISSION_WAIVER, description: "waiver", confidence: ConfidenceLevel.HIGH, requiresFollowup: false },
    }));

    const result = await makeSvc(repo).summarize();
    expect(result.totalCashIn.toString()).toBe("0.00");
    expect(result.totalCashOut.toString()).toBe("0.00");
  });

  it("CP6 — open LOAN: openBalance appears in openReceivables", async () => {
    const repo = new InMemoryLedgerEventRepository();
    await createLoan(repo, "obj-cp6", "5000.00");

    const result = await makeSvc(repo).summarize();
    expect(result.openReceivables.toString()).toBe("5000.00");
    expect(result.contingentExposure.toString()).toBe("0.00");
  });

  it("CP7 — open ADVANCE: openBalance appears in openReceivables", async () => {
    const repo = new InMemoryLedgerEventRepository();
    await createAdvance(repo, "obj-cp7", "3000.00");

    const result = await makeSvc(repo).summarize();
    expect(result.openReceivables.toString()).toBe("3000.00");
  });

  it("CP8 — open PENALTY: goes to contingentExposure", async () => {
    const repo = new InMemoryLedgerEventRepository();
    const uc = new CreateLedgerEventUseCase(repo, new NoOpAuditLogger());
    // Create a PENALTY using penalty_payment that ORIGINATES (not SETTLES) the penalty object
    // Actually penalty_payment settles. Need another approach for open penalty.
    // Use COMMISSION_RECEIVED with PENALTY object — but contract doesn't allow that.
    // Instead mock the repo's aggregateOpenBalancesByObjectType.
    // Simplest: use a real scenario. penalty_payment SETTLES a penalty, not originates.
    // For CP8 we need an open PENALTY. But there's no event that ORIGINATES a penalty in the current contracts.
    // Use a mock repo approach:
    const mockRepo = {
      ...repo,
      aggregateCashFlows: async () => ({ cashInUnits: 0n, cashOutUnits: 0n, currency: "BRL" }),
      aggregateOpenBalancesByObjectType: async () => [
        { objectType: ObjectType.PENALTY, openBalanceUnits: 150000n, currency: "BRL" },
      ],
    } as unknown as InMemoryLedgerEventRepository;

    const result = await makeSvc(mockRepo).summarize();
    expect(result.contingentExposure.toString()).toBe("1500.00");
    expect(result.openReceivables.toString()).toBe("0.00");
  });

  it("CP9 — open DISPUTE: goes to contingentExposure", async () => {
    const repo = new InMemoryLedgerEventRepository();
    const mockRepo = {
      ...repo,
      aggregateCashFlows: async () => ({ cashInUnits: 0n, cashOutUnits: 0n, currency: "BRL" }),
      aggregateOpenBalancesByObjectType: async () => [
        { objectType: ObjectType.DISPUTE, openBalanceUnits: 75000n, currency: "BRL" },
      ],
    } as unknown as InMemoryLedgerEventRepository;

    const result = await makeSvc(mockRepo).summarize();
    expect(result.contingentExposure.toString()).toBe("750.00");
    expect(result.openReceivables.toString()).toBe("0.00");
  });

  it("CP10 — fully settled LOAN: does NOT appear in openReceivables", async () => {
    const repo = new InMemoryLedgerEventRepository();
    const loan = await createLoan(repo, "obj-cp10", "2000.00");
    await repayLoan(repo, "obj-cp10", loan.id.value, "2000.00");

    const result = await makeSvc(repo).summarize();
    expect(result.openReceivables.toString()).toBe("0.00");
  });

  it("CP11 — reversed position: does NOT feed either bucket", async () => {
    const repo = new InMemoryLedgerEventRepository();
    const uc = new CreateLedgerEventUseCase(repo, new NoOpAuditLogger());

    // Create a loan that would normally appear in openReceivables
    await createLoan(repo, "obj-cp11", "5000.00");

    // Reverse it via LEDGER_CORRECTION — this sets hasReversal=true on the object
    await uc.execute(makeValidCommand({
      sourceReference: ref(),
      eventType: EventType.LEDGER_CORRECTION,
      economicEffect: EconomicEffect.NON_CASH,
      amount: "5000.00",
      objects: [{ objectId: "obj-cp11", objectType: ObjectType.LOAN, relation: Relation.REVERSES }],
      parties: [{ partyId: "usina", role: PartyRole.PLATFORM, direction: Direction.NEUTRAL }],
      reason: { type: ReasonType.MANUAL_CORRECTION, description: "reversal", confidence: ConfidenceLevel.HIGH, requiresFollowup: false },
    }));

    const result = await makeSvc(repo).summarize();
    // The reversed LOAN must not contribute to openReceivables
    expect(result.openReceivables.toString()).toBe("0.00");
    expect(result.contingentExposure.toString()).toBe("0.00");
  });

  it("CP12 — open COMMISSION_RECEIVABLE: ignored by both buckets", async () => {
    const repo = new InMemoryLedgerEventRepository();
    const uc = new CreateLedgerEventUseCase(repo, new NoOpAuditLogger());
    // Create a COMMISSION_EXPECTED that originates a COMMISSION_RECEIVABLE
    await uc.execute(makeValidCommand({
      sourceReference: ref(),
      eventType: EventType.COMMISSION_EXPECTED,
      economicEffect: EconomicEffect.NON_CASH,
      amount: "1000.00",
      objects: [{ objectId: "obj-cp12-com", objectType: ObjectType.COMMISSION_RECEIVABLE, relation: Relation.ORIGINATES }],
      parties: [{ partyId: "usina", role: PartyRole.BENEFICIARY, direction: Direction.NEUTRAL }],
      reason: { type: ReasonType.LATE_IDENTIFIED_COMMISSION, description: "expected commission", confidence: ConfidenceLevel.MEDIUM, requiresFollowup: false },
    }));

    const result = await makeSvc(repo).summarize();
    // COMMISSION_RECEIVABLE is excluded from both USINA_RECEIVABLE_OBJECT_TYPES and USINA_CONTINGENT_OBJECT_TYPES
    expect(result.openReceivables.toString()).toBe("0.00");
    expect(result.contingentExposure.toString()).toBe("0.00");
  });

  it("CP13 — partially settled LOAN: openBalance > 0 contributes to openReceivables", async () => {
    const repo = new InMemoryLedgerEventRepository();
    const loan = await createLoan(repo, "obj-cp13", "3000.00");
    await repayLoan(repo, "obj-cp13", loan.id.value, "1000.00");

    const result = await makeSvc(repo).summarize();
    expect(result.openReceivables.toString()).toBe("2000.00");
  });

  it("CP14 — asOf field is within ~1 second of now", async () => {
    const repo = new InMemoryLedgerEventRepository();
    const before = Date.now();
    const result = await makeSvc(repo).summarize();
    const after = Date.now();

    expect(result.asOf.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.asOf.getTime()).toBeLessThanOrEqual(after + 1000);
  });
});
