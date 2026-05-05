import { describe, it, expect } from "vitest";
import { BookHealthService } from "../../../core/application/services/BookHealthService";
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

// ── Helpers ───────────────────────────────────────────────────────────────────

let _seq = 0;
const ref = () => `ref-bh-${++_seq}`;

function makeSvc(repo: InMemoryLedgerEventRepository) {
  return new BookHealthService(repo);
}

async function createAdvance(
  repo: InMemoryLedgerEventRepository,
  objectId: string,
  amount: string,
  occurredAt: Date,
) {
  const uc = new CreateLedgerEventUseCase(repo, new NoOpAuditLogger());
  return uc.execute(makeValidCommand({
    sourceReference: ref(),
    occurredAt,
    eventType:       EventType.ADVANCE_PAYMENT,
    economicEffect:  EconomicEffect.CASH_OUT,
    amount,
    objects:  [{ objectId, objectType: ObjectType.ADVANCE, relation: Relation.ORIGINATES }],
    parties:  [
      { partyId: "usina", role: PartyRole.PAYER,  direction: Direction.OUT,     amount },
      { partyId: "bkr",   role: PartyRole.PAYEE,  direction: Direction.NEUTRAL, amount },
    ],
    reason: { type: ReasonType.ADVANCE_PAYMENT, description: "adv", confidence: ConfidenceLevel.HIGH, requiresFollowup: false },
  }));
}

async function settleAdvance(
  repo: InMemoryLedgerEventRepository,
  objectId: string,
  relatedEventId: string,
  amount: string,
  occurredAt: Date,
  effect: EconomicEffect = EconomicEffect.CASH_IN,
) {
  const uc = new CreateLedgerEventUseCase(repo, new NoOpAuditLogger());
  const parties = effect === EconomicEffect.NON_CASH
    ? [{ partyId: "bkr", role: PartyRole.BENEFICIARY, direction: Direction.NEUTRAL }]
    : [
        { partyId: "usina", role: PartyRole.PAYEE,  direction: Direction.IN,      amount },
        { partyId: "bkr",   role: PartyRole.PAYER,  direction: Direction.NEUTRAL, amount },
      ];
  return uc.execute(makeValidCommand({
    sourceReference:  ref(),
    occurredAt,
    eventType:        EventType.ADVANCE_SETTLEMENT,
    economicEffect:   effect,
    amount,
    relatedEventId,
    objects:  [{ objectId, objectType: ObjectType.ADVANCE, relation: Relation.SETTLES }],
    parties,
    reason: { type: ReasonType.ADVANCE_PAYMENT, description: "settle", confidence: ConfidenceLevel.MEDIUM, requiresFollowup: false },
  }));
}

// Dates — within the 90-day current window
const RECENT = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
// Older than 30 days but within the current 90-day window
const DAYS_45 = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
// Young (originated within last 10 days — not at risk)
const DAYS_10 = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("BookHealthService.compute()", () => {

  it("BH01 — empty ledger returns score=100, label=saudável, trend=stable", async () => {
    const repo = new InMemoryLedgerEventRepository();
    const result = await makeSvc(repo).compute();

    expect(result.score).toBe(100);
    expect(result.label).toBe("saudável");
    expect(result.trend).toBe("stable");
    expect(result.trendDelta).toBe(0);
    expect(result.closureQuality).toBe(1);
    expect(result.openBookHealth).toBe(1);
    expect(result.windowDays).toBe(90);
  });

  it("BH02 — all settlements in window are CASH_IN → closureQuality=1.0", async () => {
    const repo = new InMemoryLedgerEventRepository();
    const orig = await createAdvance(repo, "adv-bh02", "1000.00", DAYS_45);
    await settleAdvance(repo, "adv-bh02", orig.id.value, "1000.00", RECENT, EconomicEffect.CASH_IN);

    const result = await makeSvc(repo).compute();
    expect(result.closureQuality).toBe(1);
  });

  it("BH03 — all settlements in window are NON_CASH → closureQuality=0.0", async () => {
    const repo = new InMemoryLedgerEventRepository();
    const orig = await createAdvance(repo, "adv-bh03", "1000.00", DAYS_45);
    await settleAdvance(repo, "adv-bh03", orig.id.value, "1000.00", RECENT, EconomicEffect.NON_CASH);

    const result = await makeSvc(repo).compute();
    expect(result.closureQuality).toBe(0);
  });

  it("BH04 — 50% CASH_IN / 50% NON_CASH → closureQuality≈0.5", async () => {
    const repo = new InMemoryLedgerEventRepository();

    const orig1 = await createAdvance(repo, "adv-bh04a", "1000.00", DAYS_45);
    await settleAdvance(repo, "adv-bh04a", orig1.id.value, "1000.00", RECENT, EconomicEffect.CASH_IN);

    const orig2 = await createAdvance(repo, "adv-bh04b", "1000.00", DAYS_45);
    await settleAdvance(repo, "adv-bh04b", orig2.id.value, "1000.00", RECENT, EconomicEffect.NON_CASH);

    const result = await makeSvc(repo).compute();
    expect(result.closureQuality).toBeCloseTo(0.5, 3);
  });

  it("BH05 — all open exposure is capital at risk → openBookHealth=0, label=crítico", async () => {
    const repo = new InMemoryLedgerEventRepository();
    // Two old open positions, zero settlement
    await createAdvance(repo, "adv-bh05a", "500.00", DAYS_45);
    await createAdvance(repo, "adv-bh05b", "500.00", DAYS_45);

    const result = await makeSvc(repo).compute();
    expect(result.openBookHealth).toBe(0);
    expect(result.label).toBe("crítico");
  });

  it("BH06 — fully settled book → openBookHealth=1.0", async () => {
    const repo = new InMemoryLedgerEventRepository();
    const orig = await createAdvance(repo, "adv-bh06", "800.00", DAYS_45);
    await settleAdvance(repo, "adv-bh06", orig.id.value, "800.00", RECENT, EconomicEffect.CASH_IN);

    const result = await makeSvc(repo).compute();
    expect(result.openBookHealth).toBe(1);
  });

  it("BH07 — young book (originated < 30 days) with no closures → no penalty, score=100", async () => {
    const repo = new InMemoryLedgerEventRepository();
    // Originated only 10 days ago — not capitalAtRisk, no settlements yet
    await createAdvance(repo, "adv-bh07", "1000.00", DAYS_10);

    const result = await makeSvc(repo).compute();
    // Leg 1 = 1.0 (no settlements in window → no penalty)
    // Leg 2 = 1.0 (open exposure > 0 but capitalAtRisk = 0 since < 30 days)
    expect(result.closureQuality).toBe(1);
    expect(result.openBookHealth).toBe(1);
    expect(result.score).toBe(100);
  });

  it("BH08 — Leg 1 current > previous + 2 → trend=up", async () => {
    const repo = new InMemoryLedgerEventRepository();

    // Previous window (91–180 days ago): NON_CASH settlement → low closure quality
    const prevDate   = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
    const origPrev   = await createAdvance(repo, "adv-bh08-prev", "1000.00", new Date(Date.now() - 150 * 24 * 60 * 60 * 1000));
    await settleAdvance(repo, "adv-bh08-prev", origPrev.id.value, "1000.00", prevDate, EconomicEffect.NON_CASH);

    // Current window (last 90 days): CASH_IN settlement → high closure quality
    const origCurr = await createAdvance(repo, "adv-bh08-curr", "1000.00", DAYS_45);
    await settleAdvance(repo, "adv-bh08-curr", origCurr.id.value, "1000.00", RECENT, EconomicEffect.CASH_IN);

    const result = await makeSvc(repo).compute();
    expect(result.trend).toBe("up");
    expect(result.trendDelta).toBeGreaterThan(2);
  });

  it("BH09 — Leg 1 current < previous − 2 → trend=down", async () => {
    const repo = new InMemoryLedgerEventRepository();

    // Previous window: all CASH_IN → high closure quality
    const prevDate = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
    const origPrev = await createAdvance(repo, "adv-bh09-prev", "1000.00", new Date(Date.now() - 150 * 24 * 60 * 60 * 1000));
    await settleAdvance(repo, "adv-bh09-prev", origPrev.id.value, "1000.00", prevDate, EconomicEffect.CASH_IN);

    // Current window: all NON_CASH → low closure quality
    const origCurr = await createAdvance(repo, "adv-bh09-curr", "1000.00", DAYS_45);
    await settleAdvance(repo, "adv-bh09-curr", origCurr.id.value, "1000.00", RECENT, EconomicEffect.NON_CASH);

    const result = await makeSvc(repo).compute();
    expect(result.trend).toBe("down");
    expect(result.trendDelta).toBeLessThan(-2);
  });

  it("BH10 — identical Leg 1 in both windows → trend=stable", async () => {
    const repo = new InMemoryLedgerEventRepository();

    // Previous window: CASH_IN
    const prevDate = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
    const origPrev = await createAdvance(repo, "adv-bh10-prev", "1000.00", new Date(Date.now() - 150 * 24 * 60 * 60 * 1000));
    await settleAdvance(repo, "adv-bh10-prev", origPrev.id.value, "1000.00", prevDate, EconomicEffect.CASH_IN);

    // Current window: same CASH_IN ratio
    const origCurr = await createAdvance(repo, "adv-bh10-curr", "1000.00", DAYS_45);
    await settleAdvance(repo, "adv-bh10-curr", origCurr.id.value, "1000.00", RECENT, EconomicEffect.CASH_IN);

    const result = await makeSvc(repo).compute();
    expect(result.trend).toBe("stable");
    expect(Math.abs(result.trendDelta)).toBeLessThanOrEqual(2);
  });

  it("BH11 — mixed realistic scenario: partial cash recovery + some at-risk → composite score and label respected", async () => {
    const repo = new InMemoryLedgerEventRepository();

    // 2 settled via CASH_IN, 1 settled via NON_CASH → closureQuality ≈ 0.667
    const o1 = await createAdvance(repo, "adv-bh11a", "1000.00", DAYS_45);
    await settleAdvance(repo, "adv-bh11a", o1.id.value, "1000.00", RECENT, EconomicEffect.CASH_IN);

    const o2 = await createAdvance(repo, "adv-bh11b", "1000.00", DAYS_45);
    await settleAdvance(repo, "adv-bh11b", o2.id.value, "1000.00", RECENT, EconomicEffect.CASH_IN);

    const o3 = await createAdvance(repo, "adv-bh11c", "1000.00", DAYS_45);
    await settleAdvance(repo, "adv-bh11c", o3.id.value, "1000.00", RECENT, EconomicEffect.NON_CASH);

    // 1 open position at risk (old, no settlement)
    await createAdvance(repo, "adv-bh11d", "1000.00", DAYS_45);
    // 1 young open position (not at risk)
    await createAdvance(repo, "adv-bh11e", "1000.00", DAYS_10);

    const result = await makeSvc(repo).compute();

    expect(result.closureQuality).toBeCloseTo(2/3, 2);
    // openExposure = 2000, capitalAtRisk = 1000 (only adv-bh11d) → openBookHealth = 0.5
    expect(result.openBookHealth).toBeCloseTo(0.5, 2);
    // score = (0.667 × 0.4 + 0.5 × 0.6) × 100 ≈ 56.7
    expect(result.score).toBeGreaterThan(50);
    expect(result.score).toBeLessThan(80);
    expect(result.label).toBe("em_atencao");
  });
});
