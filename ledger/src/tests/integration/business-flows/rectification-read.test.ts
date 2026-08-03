import { describe, it, expect } from "vitest";
import { setup } from "./helpers/setup";
import { makeRef } from "./helpers/ref";
import { USINA, reporter } from "./helpers/parties";
import { advancePayment, advanceSettlement } from "./helpers/commands/advance-commands";
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
 * ETAPA 3 — the READ path of rectification, position axis.
 *
 * A retracted event stays in the chain and stops counting. This file proves that for the projection,
 * the aggregates and the over-settlement guard, and pins the two paths against each other so the
 * rule cannot drift between them. The cash axis is Etapa 4 and is deliberately not asserted here.
 *
 * The motivating scenario runs end to end: an advance of 500, a settlement wrongly recorded as 250,
 * a retraction, and the true settlement of 215.
 */

const ref = makeRef();
const ADV = "advance:motivating";

const retraction = (
  objectId: string,
  relatedEventId: string,
  amount: string,
  objectType: ObjectType = ObjectType.ADVANCE,
): CreateLedgerEventCommand => ({
  eventType: EventType.LEDGER_CORRECTION,
  economicEffect: EconomicEffect.NON_CASH,
  occurredAt: new Date("2025-04-20"),
  amount,
  currency: "BRL",
  sourceSystem: "manual-import",
  sourceReference: ref("retraction"),
  normalizationVersion: "1.0",
  normalizationWorkerId: "worker-test",
  relatedEventId,
  parties: [{ partyId: USINA, role: PartyRole.PLATFORM, direction: Direction.NEUTRAL }],
  objects: [{ objectId, objectType, relation: Relation.RETRACTS }],
  reason: {
    type: ReasonType.DATA_RECONCILIATION,
    description: "verified by accounting: the recorded amount never arrived",
    confidence: ConfidenceLevel.HIGH,
    requiresFollowup: false,
  },
  reporter: reporter(),
});

const recover = (objectId: string, originId: string, amount: string) =>
  advanceSettlement(ref, objectId, originId, Relation.SETTLES, EconomicEffect.CASH_IN, amount, ReasonType.ADVANCE_PAYMENT);

describe("the motivating scenario — 250 recorded, 215 true", () => {
  it("the position reports the corrected amount, and the wrong one stops counting", async () => {
    const { ledgerRepo, run } = setup();
    const positions = new PositionProjectionService(ledgerRepo);

    const advance = await run(advancePayment(ref, ADV, "500.00"));
    const wrong = await run(recover(ADV, advance.id.value, "250.00"));

    const before = (await positions.summarize(ADV))!;
    expect(before.totalSettled.toString()).toBe("250.00");
    expect(before.openBalance!.toString()).toBe("250.00");

    await run(retraction(ADV, wrong.id.value, "250.00"));
    await run(recover(ADV, advance.id.value, "215.00"));

    const after = (await positions.summarize(ADV))!;
    expect(after.totalOriginated.toString()).toBe("500.00");
    expect(after.totalSettled.toString()).toBe("215.00");
    expect(after.openBalance!.toString()).toBe("285.00");
    expect(after.status).toBe("partially_settled");
  });

  it("the whole history survives — the retracted event is still on the object's life", async () => {
    const { ledgerRepo, run } = setup();
    const advance = await run(advancePayment(ref, "advance:history", "500.00"));
    const wrong = await run(recover("advance:history", advance.id.value, "250.00"));
    await run(retraction("advance:history", wrong.id.value, "250.00"));
    await run(recover("advance:history", advance.id.value, "215.00"));

    const events = await ledgerRepo.findByObjectId("advance:history");
    expect(events).toHaveLength(4);
    expect((await ledgerRepo.getById(wrong.id.value))!.amount.toString()).toBe("250.00");
  });

  it("the true remaining balance can now be settled — the guard counts only what stands", async () => {
    const { ledgerRepo, run } = setup();
    const positions = new PositionProjectionService(ledgerRepo);

    const advance = await run(advancePayment(ref, "advance:guard", "500.00"));
    const wrong = await run(recover("advance:guard", advance.id.value, "250.00"));
    await run(retraction("advance:guard", wrong.id.value, "250.00"));
    await run(recover("advance:guard", advance.id.value, "215.00"));

    // Before the fix this was rejected as over-settlement (250 + 215 + 285 > 500).
    await run(recover("advance:guard", advance.id.value, "285.00"));

    const summary = (await positions.summarize("advance:guard"))!;
    expect(summary.totalSettled.toString()).toBe("500.00");
    expect(summary.status).toBe("fully_settled");
  });
});

describe("retraction of a retraction restores the original (D2, depth 1)", () => {
  it("the first assertion counts again once its retraction is itself retracted", async () => {
    const { ledgerRepo, run } = setup();
    const positions = new PositionProjectionService(ledgerRepo);

    const advance = await run(advancePayment(ref, "advance:d2", "500.00"));
    const settlement = await run(recover("advance:d2", advance.id.value, "250.00"));

    const first = await run(retraction("advance:d2", settlement.id.value, "250.00"));
    expect((await positions.summarize("advance:d2"))!.totalSettled.toString()).toBe("0.00");

    await run(retraction("advance:d2", first.id.value, "250.00"));
    const restored = (await positions.summarize("advance:d2"))!;
    expect(restored.totalSettled.toString()).toBe("250.00");
    expect(restored.openBalance!.toString()).toBe("250.00");
  });
});

describe("every read path agrees about a retracted event", () => {
  it("projection, aggregate list item and the status filter tell the same story", async () => {
    const { ledgerRepo, run } = setup();
    const positions = new PositionProjectionService(ledgerRepo);

    const advance = await run(advancePayment(ref, "advance:paths", "500.00"));
    const wrong = await run(recover("advance:paths", advance.id.value, "250.00"));
    await run(retraction("advance:paths", wrong.id.value, "250.00"));
    await run(recover("advance:paths", advance.id.value, "215.00"));

    const summary = (await positions.summarize("advance:paths"))!;
    const { data } = await ledgerRepo.findPositionAggregates({ limit: 200 });
    const item = positions.aggregateToListItem(data.find((a) => a.objectId === "advance:paths")!);

    expect(item.status).toBe(summary.status);
    expect(item.totalSettled.toString()).toBe(summary.totalSettled.toString());
    expect(item.openBalance!.toString()).toBe(summary.openBalance!.toString());

    const filtered = await ledgerRepo.findPositionAggregates({ status: summary.status, limit: 200 });
    expect(filtered.data.some((a) => a.objectId === "advance:paths")).toBe(true);
  });

  it("open receivables count the corrected balance, not the retracted one", async () => {
    const { ledgerRepo, run } = setup();
    const advance = await run(advancePayment(ref, "advance:recv", "500.00"));
    const wrong = await run(recover("advance:recv", advance.id.value, "250.00"));
    await run(retraction("advance:recv", wrong.id.value, "250.00"));
    await run(recover("advance:recv", advance.id.value, "215.00"));

    const rows = await ledgerRepo.aggregateOpenBalancesByObjectType();
    const advanceRow = rows.find((r) => r.objectType === ObjectType.ADVANCE)!;
    expect(advanceRow.openBalanceUnits).toBe(28500n);
  });

  it("closure statistics ignore a settlement that never happened", async () => {
    const { ledgerRepo, run } = setup();
    const advance = await run(advancePayment(ref, "advance:closure", "500.00"));
    const wrong = await run(recover("advance:closure", advance.id.value, "250.00"));
    await run(retraction("advance:closure", wrong.id.value, "250.00"));
    await run(recover("advance:closure", advance.id.value, "215.00"));

    const stats = await ledgerRepo.aggregateClosureStats(new Date("2020-01-01"), new Date("2100-01-01"), "BRL");
    expect(stats.totalSettledUnits).toBe(21500n);
    expect(stats.cashInSettledUnits).toBe(21500n);
  });
});
