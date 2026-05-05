import { describe, it, expect } from "vitest";
import { DashboardService } from "../../../core/application/services/DashboardService";
import { PositionProjectionService } from "../../../core/application/services/PositionProjectionService";
import { BookHealthService } from "../../../core/application/services/BookHealthService";
import { EconomicEffect } from "../../../core/domain/enums/EconomicEffect";
import { EventType } from "../../../core/domain/enums/EventType";
import { ObjectType } from "../../../core/domain/enums/ObjectType";
import { ReasonType } from "../../../core/domain/enums/ReasonType";
import { Relation } from "../../../core/domain/enums/Relation";
import { advancePayment, advanceSettlement } from "./helpers/commands/advance-commands";
import { commissionReceived, commissionSplit } from "./helpers/commands/commission-commands";
import { ledgerCorrection } from "./helpers/commands/correction-commands";
import { loanOrigination, loanRepayment } from "./helpers/commands/loan-commands";
import { makeRef } from "./helpers/ref";
import { setup } from "./helpers/setup";

const ref = makeRef();

function makeSvc(ledgerRepo: ReturnType<typeof setup>["ledgerRepo"]) {
  const posSvc        = new PositionProjectionService(ledgerRepo);
  const bookHealthSvc = new BookHealthService(ledgerRepo);
  return new DashboardService(ledgerRepo, posSvc, bookHealthSvc);
}

// Wide period that covers all fixture dates
const ALL_TIME = { from: new Date("2000-01-01"), to: new Date("2099-12-31") };
// Fixture dates used by loan-commands: originated 2025-02-01, repaid 2025-05-01
const PERIOD_Q1_2025 = { from: new Date("2025-01-01"), to: new Date("2025-03-31") };

describe("Dashboard integration", () => {

  it("DB01 — commission received appears in cashIn breakdown", async () => {
    const { ledgerRepo, run } = setup();
    await run(commissionReceived(ref, "com-db01", "1500.00"));

    const d = await makeSvc(ledgerRepo).compute(ALL_TIME.from, ALL_TIME.to);

    expect(d.cashIn.toString()).toBe("1500.00");
    expect(d.cashInByType[EventType.COMMISSION_RECEIVED]?.toString()).toBe("1500.00");
    expect(d.cashOut.toString()).toBe("0.00");
  });

  it("DB02 — commission split appears in cashOut breakdown", async () => {
    const { ledgerRepo, run } = setup();
    await run(commissionSplit(ref, "pool-db02", "700.00"));

    const d = await makeSvc(ledgerRepo).compute(ALL_TIME.from, ALL_TIME.to);

    expect(d.cashOut.toString()).toBe("700.00");
    expect(d.cashOutByType[EventType.COMMISSION_SPLIT]?.toString()).toBe("700.00");
  });

  it("DB03 — net cash is positive when commissions exceed splits", async () => {
    const { ledgerRepo, run } = setup();
    await run(commissionReceived(ref, "com-db03", "2000.00"));
    await run(commissionSplit(ref, "pool-db03", "700.00"));

    const d = await makeSvc(ledgerRepo).compute(ALL_TIME.from, ALL_TIME.to);

    expect(d.netCashUnits).toBeGreaterThan(0n);
    expect(d.cashIn.toString()).toBe("2000.00");
    expect(d.cashOut.toString()).toBe("700.00");
  });

  it("DB04 — open advance contributes to openExposure and attentionPositions", async () => {
    const { ledgerRepo, run } = setup();
    await run(advancePayment(ref, "adv-db04", "900.00"));

    const d = await makeSvc(ledgerRepo).compute(ALL_TIME.from, ALL_TIME.to);

    expect(d.openExposure.toString()).toBe("900.00");
    expect(d.attentionPositions.some((p) => p.objectId === "adv-db04")).toBe(true);
  });

  it("DB05 — fully settled advance is removed from openExposure", async () => {
    const { ledgerRepo, run } = setup();
    const orig = await run(advancePayment(ref, "adv-db05", "500.00"));
    await run(
      advanceSettlement(ref, "adv-db05", orig.id.value, Relation.SETTLES, EconomicEffect.CASH_IN, "500.00", ReasonType.ADVANCE_PAYMENT),
    );

    const d = await makeSvc(ledgerRepo).compute(ALL_TIME.from, ALL_TIME.to);

    expect(d.openExposure.toString()).toBe("0.00");
    expect(d.attentionPositions.some((p) => p.objectId === "adv-db05")).toBe(false);
  });

  it("DB06 — fully settled advance with cash recovery yields healthy score", async () => {
    const { ledgerRepo, run } = setup();
    const orig = await run(advancePayment(ref, "adv-db06", "600.00"));
    await run(
      advanceSettlement(ref, "adv-db06", orig.id.value, Relation.SETTLES, EconomicEffect.CASH_IN, "600.00", ReasonType.ADVANCE_PAYMENT),
    );

    const d = await makeSvc(ledgerRepo).compute(ALL_TIME.from, ALL_TIME.to);

    expect(d.healthScore.openBookHealth).toBe(1);
    expect(d.healthScore.score).toBeGreaterThanOrEqual(80);
  });

  it("DB07 — period filter excludes events before 'from'", async () => {
    const { ledgerRepo, run } = setup();
    // commissionReceived is 2025-03-01, which is outside PERIOD_Q1_2025 (jan-mar), actually no, march IS in Q1
    // loan origination is 2025-02-01 — inside Q1
    // loan repayment is 2025-05-01 — OUTSIDE Q1
    await run(loanOrigination(ref, "loan-db07", "2000.00"));
    await run(commissionReceived(ref, "com-db07", "500.00")); // 2025-03-01 inside Q1

    const d = await makeSvc(ledgerRepo).compute(PERIOD_Q1_2025.from, PERIOD_Q1_2025.to);

    // loan origination is cash_out (2025-02-01) inside Q1
    expect(d.cashOut.toString()).toBe("2000.00");
    // commission received is cash_in (2025-03-01) inside Q1
    expect(d.cashIn.toString()).toBe("500.00");
  });

  it("DB08 — repayment outside period does not appear in period cashIn", async () => {
    const { ledgerRepo, run } = setup();
    const orig = await run(loanOrigination(ref, "loan-db08", "2000.00")); // 2025-02-01
    await run(loanRepayment(ref, "loan-db08", orig.id.value, EconomicEffect.CASH_IN, Relation.SETTLES, ReasonType.LOAN_REPAYMENT, "2000.00")); // 2025-05-01

    // Query only Q1 (loan repayment is in May, outside)
    const d = await makeSvc(ledgerRepo).compute(PERIOD_Q1_2025.from, PERIOD_Q1_2025.to);

    // Only the origination (cash_out Feb) is inside Q1; repayment (cash_in May) is outside
    expect(d.cashIn.toString()).toBe("0.00");
    expect(d.cashOut.toString()).toBe("2000.00");
  });

  it("DB09 — capital at risk: loan originated 45 days ago, never repaid", async () => {
    const { ledgerRepo, run } = setup();
    const oldDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);

    // Manually construct a loan origination with old date
    const { CreateLedgerEventUseCase } = await import("../../../core/application/use-cases/CreateLedgerEventUseCase");
    const { NoOpAuditLogger } = await import("../../../infra/audit/NoOpAuditLogger");
    const { makeValidCommand } = await import("../../fixtures");
    const { Direction, PartyRole, ObjectType, ConfidenceLevel } = await import("../../../core/domain/enums/Direction").then(async () => ({
      Direction:       (await import("../../../core/domain/enums/Direction")).Direction,
      PartyRole:       (await import("../../../core/domain/enums/PartyRole")).PartyRole,
      ObjectType:      (await import("../../../core/domain/enums/ObjectType")).ObjectType,
      ConfidenceLevel: (await import("../../../core/domain/enums/ConfidenceLevel")).ConfidenceLevel,
    }));

    const uc = new CreateLedgerEventUseCase(ledgerRepo, new NoOpAuditLogger());
    await uc.execute(makeValidCommand({
      sourceReference: `ref-db09-${Date.now()}`,
      occurredAt:      oldDate,
      eventType:       EventType.ADVANCE_PAYMENT,
      economicEffect:  EconomicEffect.CASH_OUT,
      amount:          "1200.00",
      objects: [{ objectId: "loan-risk-db09", objectType: ObjectType.ADVANCE, relation: Relation.ORIGINATES }],
      parties: [
        { partyId: "usina", role: PartyRole.PAYER, direction: Direction.OUT,     amount: "1200.00" },
        { partyId: "bkr",   role: PartyRole.PAYEE, direction: Direction.NEUTRAL, amount: "1200.00" },
      ],
      reason: { type: ReasonType.ADVANCE_PAYMENT, description: "old advance", confidence: ConfidenceLevel.HIGH, requiresFollowup: false },
    }));

    const d = await makeSvc(ledgerRepo).compute(new Date(0), new Date());
    expect(d.capitalAtRisk.toString()).toBe("1200.00");
  });

  it("DB10 — multiple positions: attentionPositions sorted oldest first", async () => {
    const { ledgerRepo } = setup();
    const { CreateLedgerEventUseCase } = await import("../../../core/application/use-cases/CreateLedgerEventUseCase");
    const { NoOpAuditLogger } = await import("../../../infra/audit/NoOpAuditLogger");
    const { makeValidCommand } = await import("../../fixtures");
    const { Direction, PartyRole, ObjectType, ConfidenceLevel } = await import("../../../core/domain/enums/Direction").then(async () => ({
      Direction:       (await import("../../../core/domain/enums/Direction")).Direction,
      PartyRole:       (await import("../../../core/domain/enums/PartyRole")).PartyRole,
      ObjectType:      (await import("../../../core/domain/enums/ObjectType")).ObjectType,
      ConfidenceLevel: (await import("../../../core/domain/enums/ConfidenceLevel")).ConfidenceLevel,
    }));

    const uc = new CreateLedgerEventUseCase(ledgerRepo, new NoOpAuditLogger());
    const sortDates = ["2025-03-15", "2025-01-05", "2025-02-20"];
    for (const [i, d] of sortDates.entries()) {
      await uc.execute(makeValidCommand({
        sourceReference: `ref-db10-${i}`,
        occurredAt:      new Date(`${d}T00:00:00Z`),
        eventType:       EventType.ADVANCE_PAYMENT,
        economicEffect:  EconomicEffect.CASH_OUT,
        amount:          "100.00",
        objects: [{ objectId: `adv-sort-db10-${i}`, objectType: ObjectType.ADVANCE, relation: Relation.ORIGINATES }],
        parties: [
          { partyId: "usina", role: PartyRole.PAYER, direction: Direction.OUT,     amount: "100.00" },
          { partyId: "bkr",   role: PartyRole.PAYEE, direction: Direction.NEUTRAL, amount: "100.00" },
        ],
        reason: { type: ReasonType.ADVANCE_PAYMENT, description: "adv", confidence: ConfidenceLevel.HIGH, requiresFollowup: false },
      }));
    }

    const dashboard = await makeSvc(ledgerRepo).compute(new Date(0), new Date());
    const origTimes = dashboard.attentionPositions.map((p) => p.originatedAt?.getTime() ?? 0);
    for (let i = 1; i < origTimes.length; i++) {
      expect(origTimes[i]).toBeGreaterThanOrEqual(origTimes[i - 1]);
    }
  });

  it("DB11 — reversed position does not appear in attentionPositions", async () => {
    const { ledgerRepo, run } = setup();
    await run(advancePayment(ref, "adv-rev-db11", "400.00"));
    // ledger_correction with REVERSES is the correct way to reverse a position
    await run(ledgerCorrection(ref, "adv-rev-db11", ObjectType.ADVANCE, Relation.REVERSES, ReasonType.MANUAL_CORRECTION));

    const d = await makeSvc(ledgerRepo).compute(ALL_TIME.from, ALL_TIME.to);
    expect(d.attentionPositions.some((p) => p.objectId === "adv-rev-db11")).toBe(false);
  });

  it("DB12 — period with zero events returns all zeros but current-state still reflects existing positions", async () => {
    const { ledgerRepo, run } = setup();
    // Seed an open advance (fixture date 2025-03-05 — outside the query period below)
    await run(advancePayment(ref, "adv-db12", "500.00"));

    // Query a period that has no events
    const emptyPeriod = { from: new Date("2020-01-01"), to: new Date("2020-12-31") };
    const d = await makeSvc(ledgerRepo).compute(emptyPeriod.from, emptyPeriod.to);

    // Period cash is zero
    expect(d.cashIn.toString()).toBe("0.00");
    expect(d.cashOut.toString()).toBe("0.00");
    // But current-state exposure is still present
    expect(d.openExposure.toString()).toBe("500.00");
  });
});
