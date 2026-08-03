import { describe, it, expect } from "vitest";
import { setup } from "./helpers/setup";
import { makeRef } from "./helpers/ref";
import { USINA, reporter } from "./helpers/parties";
import { advancePayment, advanceSettlement } from "./helpers/commands/advance-commands";
import { CashPositionService } from "../../../core/application/services/CashPositionService";
import { CashStatementService } from "../../../core/application/services/CashStatementService";
import { PositionProjectionService } from "../../../core/application/services/PositionProjectionService";
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
 * ETAPA 4 — the CASH axis (D5).
 *
 * Approved: when a cash event is retracted, the cash aggregates reflect it. This is the decision
 * that closes the SECOND axis of the motivating scenario — without it the position would read 215
 * while the cash books kept the 250 that never arrived.
 *
 * It narrows the doctrine pinned by CPREV5 (`reversal-cash-position.test.ts`), and the narrowing is
 * deliberate: there, a REVERSAL cancels a movement that really happened, and totalCashIn rightly
 * preserves the physical record. Here, a RETRACTION says no movement ever happened. Different
 * claims, different consequences — and the reversal tests still pass untouched, which is the proof.
 */

const ref = makeRef();
const PERIOD_FROM = new Date("2025-01-01");
const PERIOD_TO = new Date("2025-12-31");

const retraction = (objectId: string, relatedEventId: string, amount: string): CreateLedgerEventCommand => ({
  eventType: EventType.LEDGER_CORRECTION,
  economicEffect: EconomicEffect.NON_CASH,
  occurredAt: new Date("2026-02-10"), // deliberately AFTER the statement period it corrects
  amount,
  currency: "BRL",
  sourceSystem: "manual-import",
  sourceReference: ref("retraction"),
  normalizationVersion: "1.0",
  normalizationWorkerId: "worker-test",
  relatedEventId,
  parties: [{ partyId: USINA, role: PartyRole.PLATFORM, direction: Direction.NEUTRAL }],
  objects: [{ objectId, objectType: ObjectType.ADVANCE, relation: Relation.RETRACTS }],
  reason: {
    type: ReasonType.DATA_RECONCILIATION,
    description: "verified by accounting: this cash never arrived",
    confidence: ConfidenceLevel.HIGH,
    requiresFollowup: false,
  },
  reporter: reporter(),
});

const recover = (objectId: string, originId: string, amount: string) =>
  advanceSettlement(ref, objectId, originId, Relation.SETTLES, EconomicEffect.CASH_IN, amount, ReasonType.ADVANCE_PAYMENT);

/** advance 500 out, a wrong recovery of 250 in, retracted, then the true 215 in. */
async function motivatingScenario(objectId: string) {
  const s = setup();
  const advance = await s.run(advancePayment(ref, objectId, "500.00"));
  const wrong = await s.run(recover(objectId, advance.id.value, "250.00"));
  await s.run(retraction(objectId, wrong.id.value, "250.00"));
  await s.run(recover(objectId, advance.id.value, "215.00"));
  return s;
}

describe("the motivating scenario, cash axis — 250 recorded, 215 true", () => {
  it("totalCashIn reports the money that actually arrived", async () => {
    const { ledgerRepo } = await motivatingScenario("advance:cash-fix");
    const summary = await new CashPositionService(ledgerRepo).summarize();

    expect(summary.totalCashIn.toString()).toBe("215.00");
    expect(summary.totalCashOut.toString()).toBe("500.00");
  });

  it("both axes now agree with the world", async () => {
    const { ledgerRepo } = await motivatingScenario("advance:both-axes");
    const cash = await new CashPositionService(ledgerRepo).summarize();
    const position = (await new PositionProjectionService(ledgerRepo).summarize("advance:both-axes"))!;

    expect(position.totalSettled.toString()).toBe("215.00");
    expect(position.openBalance!.toString()).toBe("285.00");
    expect(cash.totalCashIn.toString()).toBe("215.00");
  });

  it("the statement reports the corrected period, even though the retraction is dated after it", async () => {
    const { ledgerRepo } = await motivatingScenario("advance:statement");
    const statement = await new CashStatementService(ledgerRepo, USINA).summarize(PERIOD_FROM, PERIOD_TO);

    expect(statement.totalCashIn.toString()).toBe("215.00");
    expect(statement.totalCashOut.toString()).toBe("500.00");
  });

  it("the retracted movement is off the cash listings — it never happened", async () => {
    const { ledgerRepo } = await motivatingScenario("advance:listing");

    const recent = await ledgerRepo.findRecentCashMovements(50);
    const amounts = recent.map((e) => e.amount.toString()).sort();
    expect(amounts).toEqual(["215.00", "500.00"]);

    const page = await ledgerRepo.findCashMovementsPaginated({ partyId: USINA, limit: 50 });
    expect(page.items.map((e) => e.amount.toString()).sort()).toEqual(["215.00", "500.00"]);
  });
});

describe("EQ-5 still holds after a retraction — every cash path agrees", () => {
  it("the four aggregation paths report the same totals", async () => {
    const { ledgerRepo } = await motivatingScenario("advance:eq5");

    const all = await ledgerRepo.aggregateCashFlows();
    const before = await ledgerRepo.aggregateCashFlowsBefore(new Date("2100-01-01"));
    const groups = await ledgerRepo.aggregatePeriodCashFlow(new Date("2020-01-01"), new Date("2100-01-01"));

    let groupedIn = 0n;
    let groupedOut = 0n;
    for (const g of groups) {
      if (g.economicEffect === EconomicEffect.CASH_IN) groupedIn += g.totalUnits;
      else if (g.economicEffect === EconomicEffect.CASH_OUT) groupedOut += g.totalUnits;
    }

    expect(all.cashInUnits).toBe(21500n);
    expect(before.cashInUnits).toBe(all.cashInUnits);
    expect(before.cashOutUnits).toBe(all.cashOutUnits);
    expect(groupedIn).toBe(all.cashInUnits);
    expect(groupedOut).toBe(all.cashOutUnits);
  });

  it("the listings expose exactly the movements the totals counted", async () => {
    const { ledgerRepo } = await motivatingScenario("advance:eq5-listing");

    const recent = await ledgerRepo.findRecentCashMovements(100);
    let listedIn = 0n;
    let listedOut = 0n;
    for (const e of recent) {
      if (e.economicEffect === EconomicEffect.CASH_IN) listedIn += e.amount.toUnits();
      else if (e.economicEffect === EconomicEffect.CASH_OUT) listedOut += e.amount.toUnits();
    }

    const totals = await ledgerRepo.aggregateCashFlows();
    expect(listedIn).toBe(totals.cashInUnits);
    expect(listedOut).toBe(totals.cashOutUnits);
  });
});

describe("D2 on the cash axis — undoing a retraction restores the movement", () => {
  it("retracting the retraction brings the cash back", async () => {
    const { ledgerRepo, run } = setup();
    const advance = await run(advancePayment(ref, "advance:cash-d2", "500.00"));
    const wrong = await run(recover("advance:cash-d2", advance.id.value, "250.00"));

    const first = await run(retraction("advance:cash-d2", wrong.id.value, "250.00"));
    expect((await new CashPositionService(ledgerRepo).summarize()).totalCashIn.toString()).toBe("0.00");

    await run(retraction("advance:cash-d2", first.id.value, "250.00"));
    expect((await new CashPositionService(ledgerRepo).summarize()).totalCashIn.toString()).toBe("250.00");
  });
});

describe("REGRESSION — a reversal is not a retraction", () => {
  it("a NON_CASH REVERSES still leaves the cash record untouched (CPREV5 doctrine, narrowed not broken)", async () => {
    const { ledgerRepo, run } = setup();
    const advance = await run(advancePayment(ref, "advance:reversal", "500.00"));
    const recovery = await run(recover("advance:reversal", advance.id.value, "250.00"));

    await run({
      ...retraction("advance:reversal", recovery.id.value, "250.00"),
      sourceReference: ref("reversal"),
      relatedEventId: null,
      objects: [{ objectId: "advance:reversal", objectType: ObjectType.ADVANCE, relation: Relation.REVERSES }],
      reason: {
        type: ReasonType.MANUAL_CORRECTION,
        description: "the recovery was cancelled after the fact",
        confidence: ConfidenceLevel.HIGH,
        requiresFollowup: false,
      },
    });

    // The money DID arrive; a reversal cancels the position, it does not unsay the movement.
    const cash = await new CashPositionService(ledgerRepo).summarize();
    expect(cash.totalCashIn.toString()).toBe("250.00");
    expect(cash.totalCashOut.toString()).toBe("500.00");
  });
});
