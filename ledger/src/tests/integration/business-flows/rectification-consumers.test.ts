import { describe, it, expect } from "vitest";
import { setup } from "./helpers/setup";
import { makeRef } from "./helpers/ref";
import { USINA, reporter } from "./helpers/parties";
import { advancePayment, advanceSettlement } from "./helpers/commands/advance-commands";
import { PositionProjectionService } from "../../../core/application/services/PositionProjectionService";
import { BookHealthService } from "../../../core/application/services/BookHealthService";
import { DashboardService } from "../../../core/application/services/DashboardService";
import { CashEventListingService } from "../../../core/application/services/CashEventListingService";
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
 * ETAPA 6 — the Ledger's own consumers.
 *
 * Dashboard, book health and the cash listing read the book exclusively through the repository's
 * aggregates and queries, all of which became retraction-aware in Etapas 3 and 4. So this stage
 * changes no production code: it PROVES the layering held, which is a claim worth a test rather
 * than an assurance. If a future consumer starts reading raw events instead, these break.
 */

const ref = makeRef();
const OBJ = "advance:consumers";
const FROM = new Date("2025-01-01");
const TO = new Date("2026-12-31");

const retraction = (targetId: string): CreateLedgerEventCommand => ({
  eventType: EventType.LEDGER_CORRECTION,
  economicEffect: EconomicEffect.NON_CASH,
  occurredAt: new Date("2025-05-01"),
  amount: "250.00",
  currency: "BRL",
  sourceSystem: "manual-import",
  sourceReference: ref("retraction"),
  normalizationVersion: "1.0",
  normalizationWorkerId: "worker-test",
  relatedEventId: targetId,
  parties: [{ partyId: USINA, role: PartyRole.PLATFORM, direction: Direction.NEUTRAL }],
  objects: [{ objectId: OBJ, objectType: ObjectType.ADVANCE, relation: Relation.RETRACTS }],
  reason: {
    type: ReasonType.DATA_RECONCILIATION,
    description: "verified by accounting: this entry never happened",
    confidence: ConfidenceLevel.HIGH,
    requiresFollowup: false,
  },
  reporter: reporter(),
});

const recover = (originId: string, amount: string) =>
  advanceSettlement(ref, OBJ, originId, Relation.SETTLES, EconomicEffect.CASH_IN, amount, ReasonType.ADVANCE_PAYMENT);

/** advance 500 out, a wrong recovery of 250 in, retracted, then the true 215 in. */
async function corrected() {
  const s = setup();
  const advance = await s.run(advancePayment(ref, OBJ, "500.00"));
  const wrong = await s.run(recover(advance.id.value, "250.00"));
  await s.run(retraction(wrong.id.value));
  await s.run(recover(advance.id.value, "215.00"));

  const positions = new PositionProjectionService(s.ledgerRepo);
  const health = new BookHealthService(s.ledgerRepo);
  return {
    repo: s.ledgerRepo,
    positions,
    health,
    dashboard: new DashboardService(s.ledgerRepo, positions, health),
    listing: new CashEventListingService(s.ledgerRepo),
  };
}

describe("DashboardService reads the corrected book", () => {
  it("period cash flow counts the money that arrived, not the money that was keyed", async () => {
    const { dashboard } = await corrected();
    const summary = await dashboard.compute(FROM, TO);

    expect(summary.cashIn.toString()).toBe("215.00");
    expect(summary.cashOut.toString()).toBe("500.00");
    expect(summary.netCashUnits).toBe(21500n - 50000n);
  });

  it("the cash-in breakdown by event type carries the corrected figure", async () => {
    const { dashboard } = await corrected();
    const summary = await dashboard.compute(FROM, TO);

    expect(summary.cashInByType[EventType.ADVANCE_SETTLEMENT]?.toString()).toBe("215.00");
  });

  it("open exposure and the attention list reflect the corrected balance", async () => {
    const { dashboard } = await corrected();
    const summary = await dashboard.compute(FROM, TO);

    expect(summary.openExposure.toString()).toBe("285.00");

    const attention = summary.attentionPositions.find((p) => p.objectId === OBJ)!;
    expect(attention.status).toBe("partially_settled");
    expect(attention.openBalance!.toString()).toBe("285.00");
  });

  it("recent movements omit the movement that never happened", async () => {
    const { dashboard } = await corrected();
    const summary = await dashboard.compute(FROM, TO);

    const amounts = summary.recentMovements.map((m) => m.amount.toString()).sort();
    expect(amounts).toEqual(["215.00", "500.00"]);
  });
});

describe("BookHealthService scores the corrected book", () => {
  it("closure quality is measured over settlements that still stand", async () => {
    const { repo, health } = await corrected();
    const aggs = await repo.findAllPositionAggregates();
    const score = await health.compute(aggs);

    // The retracted 250 is not part of the window's settled volume; only the 215 is.
    const stats = await repo.aggregateClosureStats(FROM, TO, "BRL");
    expect(stats.totalSettledUnits).toBe(21500n);
    expect(score.closureQuality).toBe(1);
  });
});

describe("CashEventListingService lists the corrected statement", () => {
  it("a retracted movement is not on the usina's statement", async () => {
    const { listing } = await corrected();
    const page = await listing.list({ partyId: USINA, limit: 50 });

    const amounts = page.items.map((m) => m.amount.toString()).sort();
    expect(amounts).toEqual(["215.00", "500.00"]);
    expect(amounts).not.toContain("250.00");
  });
});

describe("the consumers agree with the projection they never call", () => {
  it("dashboard, cash position and the position projection tell one story", async () => {
    const { repo, positions, dashboard } = await corrected();
    const summary = await dashboard.compute(FROM, TO);
    const position = (await positions.summarize(OBJ))!;
    const cashFlows = await repo.aggregateCashFlows();

    expect(summary.openExposure.toString()).toBe(position.openBalance!.toString());
    expect(summary.cashIn.toUnits()).toBe(cashFlows.cashInUnits);
    expect(summary.cashOut.toUnits()).toBe(cashFlows.cashOutUnits);
  });
});
