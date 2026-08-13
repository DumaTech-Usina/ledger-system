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

const retraction = (targetId: string, objectId = OBJ, amount = "250.00"): CreateLedgerEventCommand => ({
  eventType: EventType.LEDGER_CORRECTION,
  economicEffect: EconomicEffect.NON_CASH,
  occurredAt: new Date("2025-05-01"),
  amount,
  currency: "BRL",
  sourceSystem: "manual-import",
  sourceReference: ref("retraction"),
  normalizationVersion: "1.0",
  normalizationWorkerId: "worker-test",
  relatedEventId: targetId,
  parties: [{ partyId: USINA, role: PartyRole.PLATFORM, direction: Direction.NEUTRAL }],
  objects: [{ objectId, objectType: ObjectType.ADVANCE, relation: Relation.RETRACTS }],
  reason: {
    type: ReasonType.DATA_RECONCILIATION,
    description: "verified by accounting: this entry never happened",
    confidence: ConfidenceLevel.HIGH,
    requiresFollowup: false,
  },
  reporter: reporter(),
});

const recover = (originId: string, amount: string, objectId = OBJ) =>
  advanceSettlement(ref, objectId, originId, Relation.SETTLES, EconomicEffect.CASH_IN, amount, ReasonType.ADVANCE_PAYMENT);

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

describe("the event feed and the position agree about what is closed", () => {
  const OBJ_ONLY_RETRACTED = "advance:only-retracted";

  it("a settlement that was retracted closes nothing", async () => {
    const s = setup();
    const advance = await s.run(advancePayment(ref, OBJ_ONLY_RETRACTED, "500.00"));
    const wrong = await s.run(recover(advance.id.value, "500.00", OBJ_ONLY_RETRACTED));
    await s.run(retraction(wrong.id.value, OBJ_ONLY_RETRACTED, "500.00"));

    // What `/api/events` reads to decide `hasOpenPosition`…
    const settled = await s.ledgerRepo.findSettledObjectIds([OBJ_ONLY_RETRACTED]);
    // …and what `/api/positions` says about the same object.
    const page = await new PositionProjectionService(s.ledgerRepo).summarizePaginated({});
    const position = page.data.find((p) => p.objectId === OBJ_ONLY_RETRACTED)!;

    // The rectification declared the payment never happened, so the position it appeared to close
    // is open again. Until this was fixed the two disagreed: the feed reported the position closed
    // while the projection reported it open, over the same book.
    expect(settled.has(OBJ_ONLY_RETRACTED)).toBe(false);
    expect(position.status).toBe("open");
    expect(position.openBalance!.toString()).toBe("500.00");
  });

  it("a settlement that still stands does close it, in both readings", async () => {
    const s = setup();
    const advance = await s.run(advancePayment(ref, "advance:standing", "500.00"));
    await s.run(recover(advance.id.value, "500.00", "advance:standing"));

    const settled = await s.ledgerRepo.findSettledObjectIds(["advance:standing"]);
    const page = await new PositionProjectionService(s.ledgerRepo).summarizePaginated({});
    const position = page.data.find((p) => p.objectId === "advance:standing")!;

    expect(settled.has("advance:standing")).toBe(true);
    expect(position.status).toBe("fully_settled");
  });

  it("retracting the retraction brings the settlement back for both", async () => {
    const s = setup();
    const advance = await s.run(advancePayment(ref, "advance:undone", "500.00"));
    const payment = await s.run(recover(advance.id.value, "500.00", "advance:undone"));
    const undo = await s.run(retraction(payment.id.value, "advance:undone", "500.00"));
    // Approved depth is 1: a retraction that is itself retracted no longer stands, so what it
    // withdrew counts again. The feed must follow the same rule as every projection, not its own.
    await s.run(retraction(undo.id.value, "advance:undone", "500.00"));

    const settled = await s.ledgerRepo.findSettledObjectIds(["advance:undone"]);
    const page = await new PositionProjectionService(s.ledgerRepo).summarizePaginated({});
    const position = page.data.find((p) => p.objectId === "advance:undone")!;

    expect(settled.has("advance:undone")).toBe(true);
    expect(position.status).toBe("fully_settled");
  });
});
