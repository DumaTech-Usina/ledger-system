import { describe, it, expect, beforeAll } from "vitest";
import { setup } from "./helpers/setup";
import { makeRef } from "./helpers/ref";
import { BROKER, USINA, reporter } from "./helpers/parties";
import { commissionExpected, commissionReceived } from "./helpers/commands/commission-commands";
import { advancePayment, advanceSettlement } from "./helpers/commands/advance-commands";
import { InMemoryLedgerEventRepository } from "../../../infra/persistence/memory/InMemoryLedgerEventRepository";
import { CashPositionService } from "../../../core/application/services/CashPositionService";
import { CreateLedgerEventCommand } from "../../../core/application/dtos/CreateLedgerEventInput";
import { ConfidenceLevel } from "../../../core/domain/enums/ConfidenceLevel";
import { Direction } from "../../../core/domain/enums/Direction";
import { EconomicEffect } from "../../../core/domain/enums/EconomicEffect";
import { EventType } from "../../../core/domain/enums/EventType";
import { ObjectType } from "../../../core/domain/enums/ObjectType";
import { PartyRole } from "../../../core/domain/enums/PartyRole";
import { ReasonType } from "../../../core/domain/enums/ReasonType";
import { Relation } from "../../../core/domain/enums/Relation";

/**
 * Safety net for the CASH axis, ahead of the rectification work (D5).
 *
 * The cash figure is derived through four independent paths — `aggregateCashFlows`,
 * `aggregateCashFlowsBefore`, `aggregatePeriodCashFlow` and `aggregateClosureStats` — plus the
 * listings. Nothing today pins them against one another, and D5 will require every one of them to
 * start excluding retracted events. If one is changed and another is not, these tests fail; that is
 * their whole purpose. The ground truth is always the event stream itself.
 *
 * No business rule is exercised here that does not already hold: this file only pins today's
 * behaviour so a regression becomes visible immediately.
 */

const ref = makeRef();
const DAY_ZERO = new Date("2020-01-01");
const FAR_FUTURE = new Date("2100-01-01");

const outboundPayment = (objectId: string, amount: string): CreateLedgerEventCommand => ({
  eventType: EventType.OUTBOUND_PAYMENT,
  economicEffect: EconomicEffect.CASH_OUT,
  occurredAt: new Date("2025-03-11"),
  amount,
  currency: "BRL",
  sourceSystem: "integration",
  sourceReference: ref("outbound"),
  normalizationVersion: "1.0",
  normalizationWorkerId: "worker-test",
  parties: [
    { partyId: USINA, role: PartyRole.PAYER, direction: Direction.OUT, amount },
    { partyId: "supplier-acme", role: PartyRole.PAYEE, direction: Direction.NEUTRAL },
  ],
  objects: [{ objectId, objectType: ObjectType.PAYABLE, relation: Relation.SETTLES }],
  reason: {
    type: ReasonType.ORDINARY_SETTLEMENT,
    description: "ordinary settlement of a payable",
    confidence: ConfidenceLevel.HIGH,
    requiresFollowup: false,
  },
  reporter: reporter(),
});

/** A NON_CASH correction: by contract it can never move cash. Pinned here on purpose. */
const correction = (objectId: string, relation: Relation.REVERSES | Relation.ADJUSTS, amount: string): CreateLedgerEventCommand => ({
  eventType: EventType.LEDGER_CORRECTION,
  economicEffect: EconomicEffect.NON_CASH,
  occurredAt: new Date("2025-03-12"),
  amount,
  currency: "BRL",
  sourceSystem: "manual-import",
  sourceReference: ref("correction"),
  normalizationVersion: "1.0",
  normalizationWorkerId: "worker-test",
  parties: [{ partyId: USINA, role: PartyRole.PLATFORM, direction: Direction.NEUTRAL }],
  objects: [{ objectId, objectType: ObjectType.COMMISSION_RECEIVABLE, relation }],
  reason: {
    type: ReasonType.MANUAL_CORRECTION,
    description: "correction of a prior entry",
    confidence: ConfidenceLevel.HIGH,
    requiresFollowup: false,
  },
  reporter: reporter(),
});

let repo: InMemoryLedgerEventRepository;
let cash: CashPositionService;

/** Ground truth: the cash the event stream itself asserts, computed independently of any aggregate. */
async function groundTruth(): Promise<{ inUnits: bigint; outUnits: bigint }> {
  const events = await repo.findAll();
  let inUnits = 0n;
  let outUnits = 0n;
  for (const e of events) {
    if (e.economicEffect === EconomicEffect.CASH_IN) inUnits += e.amount.toUnits();
    else if (e.economicEffect === EconomicEffect.CASH_OUT) outUnits += e.amount.toUnits();
  }
  return { inUnits, outUnits };
}

beforeAll(async () => {
  const s = setup();
  repo = s.ledgerRepo;
  cash = new CashPositionService(repo);
  const { run } = s;

  // CASH_OUT 500 — an advance disbursed, then partially recovered (CASH_IN 250).
  const advance = await run(advancePayment(ref, "advance:cash-eq", "500.00"));
  await run(
    advanceSettlement(ref, "advance:cash-eq", advance.id.value, Relation.SETTLES, EconomicEffect.CASH_IN, "250.00", ReasonType.ADVANCE_PAYMENT),
  );

  // NON_CASH accrual + CASH_IN 1000 commission.
  const expected = await run(commissionExpected(ref, "com-recv:cash-eq", "1000.00"));
  await run(commissionReceived(ref, "com-recv:cash-eq", expected.id.value, "1000.00"));

  // CASH_OUT 1500 — a cash-basis expense.
  await run(outboundPayment("payable:cash-eq", "1500.00"));

  // Two NON_CASH corrections on a separate position: neither may touch cash.
  const reversedOrigin = await run(commissionExpected(ref, "com-recv:corrected", "400.00"));
  await run(commissionReceived(ref, "com-recv:corrected", reversedOrigin.id.value, "400.00"));
  await run(correction("com-recv:corrected", Relation.ADJUSTS, "100.00"));
  await run(correction("com-recv:corrected", Relation.REVERSES, "400.00"));
});

describe("EQ-5 — every cash aggregation path agrees with the event stream", () => {
  it("aggregateCashFlows matches the ground truth", async () => {
    const truth = await groundTruth();
    const agg = await repo.aggregateCashFlows();
    expect(agg.cashInUnits).toBe(truth.inUnits);
    expect(agg.cashOutUnits).toBe(truth.outUnits);
  });

  it("aggregateCashFlowsBefore(far future) equals aggregateCashFlows — same predicate, wider window", async () => {
    const all = await repo.aggregateCashFlows();
    const before = await repo.aggregateCashFlowsBefore(FAR_FUTURE);
    expect(before.cashInUnits).toBe(all.cashInUnits);
    expect(before.cashOutUnits).toBe(all.cashOutUnits);
  });

  it("aggregatePeriodCashFlow over a covering period sums to the same totals", async () => {
    const groups = await repo.aggregatePeriodCashFlow(DAY_ZERO, FAR_FUTURE);
    let inUnits = 0n;
    let outUnits = 0n;
    for (const g of groups) {
      if (g.economicEffect === EconomicEffect.CASH_IN) inUnits += g.totalUnits;
      else if (g.economicEffect === EconomicEffect.CASH_OUT) outUnits += g.totalUnits;
    }
    const all = await repo.aggregateCashFlows();
    expect(inUnits).toBe(all.cashInUnits);
    expect(outUnits).toBe(all.cashOutUnits);
  });

  it("CashPositionService publishes exactly what the aggregate computes", async () => {
    const agg = await repo.aggregateCashFlows();
    const summary = await cash.summarize();
    expect(summary.totalCashIn.toUnits()).toBe(agg.cashInUnits);
    expect(summary.totalCashOut.toUnits()).toBe(agg.cashOutUnits);
  });

  it("the cash listings expose exactly the events the totals counted", async () => {
    const events = await repo.findAll();
    const cashEventIds = new Set(
      events
        .filter((e) => e.economicEffect === EconomicEffect.CASH_IN || e.economicEffect === EconomicEffect.CASH_OUT)
        .map((e) => e.id.value),
    );
    const recent = await repo.findRecentCashMovements(100);
    expect(new Set(recent.map((e) => e.id.value))).toEqual(cashEventIds);
  });

  it("aggregateClosureStats counts the settling events, and only those", async () => {
    const events = await repo.findAll();
    let totalSettled = 0n;
    let cashInSettled = 0n;
    for (const e of events) {
      if (!e.getObjects().some((o) => o.relation === Relation.SETTLES)) continue;
      if (e.amount.currency !== "BRL") continue;
      totalSettled += e.amount.toUnits();
      if (e.economicEffect === EconomicEffect.CASH_IN) cashInSettled += e.amount.toUnits();
    }
    const stats = await repo.aggregateClosureStats(DAY_ZERO, FAR_FUTURE, "BRL");
    expect(stats.totalSettledUnits).toBe(totalSettled);
    expect(stats.cashInSettledUnits).toBe(cashInSettled);
  });
});

describe("REGRESSION PIN — a NON_CASH correction never moves cash", () => {
  it("neither ADJUSTS nor REVERSES corrections appear in any cash total", async () => {
    // Ground truth counts only cash_in/cash_out; the two corrections are NON_CASH, so if any
    // aggregation path started counting them, the equivalences above would already break. This
    // states the rule directly so the intent survives a refactor of the harness.
    const events = await repo.findAll();
    const corrections = events.filter((e) => e.eventType === EventType.LEDGER_CORRECTION);
    expect(corrections.length).toBe(2);
    expect(corrections.every((e) => e.economicEffect === EconomicEffect.NON_CASH)).toBe(true);

    const agg = await repo.aggregateCashFlows();
    // 250 (advance recovery) + 1000 (commission) + 400 (commission on the corrected position)
    expect(agg.cashInUnits).toBe(165000n);
    // 500 (advance) + 1500 (payable)
    expect(agg.cashOutUnits).toBe(200000n);
  });
});
