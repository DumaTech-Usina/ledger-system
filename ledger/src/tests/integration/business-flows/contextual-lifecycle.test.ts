import { describe, it, expect, beforeAll } from "vitest";
import { setup } from "./helpers/setup";
import { makeRef } from "./helpers/ref";
import { commissionExpected, commissionReceived, commissionSplit } from "./helpers/commands/commission-commands";
import { InMemoryLedgerEventRepository } from "../../../infra/persistence/memory/InMemoryLedgerEventRepository";
import { PositionProjectionService } from "../../../core/application/services/PositionProjectionService";
import { serializePositionSummary } from "../../../presentation/web/api/serializers/positionSerializer";
import { ObjectType } from "../../../core/domain/enums/ObjectType";
import { Relation } from "../../../core/domain/enums/Relation";
import { EventType } from "../../../core/domain/enums/EventType";

/**
 * The life of a CONTEXTUAL object, all the way to the consumer.
 *
 * Contextual objects — a settlement batch, an installment, a proposal — are never moved by an event;
 * they are only REFERENCED by it. Their lifecycle is therefore made entirely of events that change
 * no arithmetic, and until now that was only ever proven at the repository (`findByObjectId`). These
 * tests carry the same claim through `summarize()` and through the serialized API payload, so the
 * two surfaces cannot drift from the repository they are supposed to reflect.
 *
 * The scenarios are the ones the suite already uses: a settlement batch that a COMMISSION_RECEIVED
 * and a COMMISSION_SPLIT both reference, and an installment referenced by the commission that pays it.
 */

const ref = makeRef();
const BATCH = "batch-ctx";
const INSTALLMENT = "inst-ctx";
const RECEIVABLE = "com-recv:ctx";
const PAYABLE = "com-pay:ctx";

let repo: InMemoryLedgerEventRepository;
let positions: PositionProjectionService;

beforeAll(async () => {
  const s = setup();
  repo = s.ledgerRepo;
  positions = new PositionProjectionService(repo);
  const { run } = s;

  // CASH_IN 1000 settling a receivable, referencing both the batch and the installment it pays.
  const expected = await run(commissionExpected(ref, RECEIVABLE, "1000.00"));
  await run({
    ...commissionReceived(ref, RECEIVABLE, expected.id.value, "1000.00"),
    objects: [
      { objectId: RECEIVABLE, objectType: ObjectType.COMMISSION_RECEIVABLE, relation: Relation.SETTLES },
      { objectId: BATCH, objectType: ObjectType.SETTLEMENT_BATCH, relation: Relation.REFERENCES },
      { objectId: INSTALLMENT, objectType: ObjectType.INSTALLMENT, relation: Relation.REFERENCES },
    ],
  });

  // CASH_OUT 700 distributing part of it, referencing the same batch.
  await run({
    ...commissionSplit(ref, PAYABLE, "700.00"),
    objects: [
      { objectId: PAYABLE, objectType: ObjectType.COMMISSION_PAYABLE, relation: Relation.SETTLES },
      { objectId: BATCH, objectType: ObjectType.SETTLEMENT_BATCH, relation: Relation.REFERENCES },
    ],
  });
});

describe("summarize() exposes a contextual object's referencing events", () => {
  it("the batch has a projected life made of the two events that reference it", async () => {
    const summary = (await positions.summarize(BATCH))!;

    expect(summary).toBeTruthy();
    expect(summary.objectType).toBe(ObjectType.SETTLEMENT_BATCH);
    expect(summary.events).toHaveLength(2);
    expect(summary.eventCount).toBe(2);
    expect(summary.events.map((e) => e.eventType)).toEqual([
      EventType.COMMISSION_RECEIVED,
      EventType.COMMISSION_SPLIT,
    ]);
  });

  it("an installment referenced by a single commission exposes exactly that event", async () => {
    const summary = (await positions.summarize(INSTALLMENT))!;

    expect(summary.objectType).toBe(ObjectType.INSTALLMENT);
    expect(summary.events).toHaveLength(1);
    expect(summary.events[0].eventType).toBe(EventType.COMMISSION_RECEIVED);
  });

  it("referencing events move no arithmetic — the position's own figures stay empty", async () => {
    const summary = (await positions.summarize(BATCH))!;

    expect(summary.totalOriginated.toString()).toBe("0.00");
    expect(summary.totalSettled.toString()).toBe("0.00");
    expect(summary.totalAdjusted.toString()).toBe("0.00");
    expect(summary.openBalance!.toString()).toBe("0.00");
    expect(summary.overSettlement!.toString()).toBe("0.00");
    // 1000 referenced in, 700 referenced out: the allocation gap is what the batch is FOR.
    expect(summary.allocationGap.toString()).toBe("300.00");
  });

  it("the projected life is exactly what the repository holds — same events, same order", async () => {
    const fromRepo = await repo.findByObjectId(BATCH);
    const summary = (await positions.summarize(BATCH))!;

    expect(summary.events.map((e) => e.id.value)).toEqual(fromRepo.map((e) => e.id.value));
  });
});

describe("GET /api/positions/:objectId serializes the same life, losing nothing", () => {
  it("every referencing event survives serialization, in order", async () => {
    const fromRepo = await repo.findByObjectId(BATCH);
    const payload = serializePositionSummary((await positions.summarize(BATCH))!);

    expect(payload.events).toHaveLength(fromRepo.length);
    expect(payload.events.map((e) => e.id)).toEqual(fromRepo.map((e) => e.id.value));
    expect(payload.events.map((e) => e.eventType)).toEqual(fromRepo.map((e) => e.eventType));
    expect(payload.events.map((e) => e.amount)).toEqual(fromRepo.map((e) => e.amount.toString()));
  });

  it("each serialized event still declares REFERENCES for the contextual object", async () => {
    const payload = serializePositionSummary((await positions.summarize(BATCH))!);

    for (const event of payload.events) {
      const own = event.objects.find((o) => o.objectId === BATCH)!;
      expect(own.relation).toBe(Relation.REFERENCES);
      expect(own.objectType).toBe(ObjectType.SETTLEMENT_BATCH);
    }
  });

  it("the serialized figures agree with the projection, including the allocation gap", async () => {
    const summary = (await positions.summarize(BATCH))!;
    const payload = serializePositionSummary(summary);

    expect(payload.objectId).toBe(BATCH);
    expect(payload.status).toBe(summary.status);
    expect(payload.totalOriginated).toBe("0.00");
    expect(payload.openBalance).toBe("0.00");
    expect(payload.allocationGap).toBe("300.00");
    expect(payload.eventCount).toBe(2);
  });

  it("no event is marked retracted — nothing was rectified on this object", async () => {
    const payload = serializePositionSummary((await positions.summarize(BATCH))!);
    expect(payload.events.every((e) => e.retracted === false)).toBe(true);
  });
});

describe("REGRESSION — the positional objects of the same events are unaffected", () => {
  it("the receivable and the payable keep their own arithmetic", async () => {
    const receivable = (await positions.summarize(RECEIVABLE))!;
    expect(receivable.totalOriginated.toString()).toBe("1000.00");
    expect(receivable.totalSettled.toString()).toBe("1000.00");
    expect(receivable.status).toBe("fully_settled");

    const payable = (await positions.summarize(PAYABLE))!;
    expect(payable.totalSettled.toString()).toBe("700.00");
  });

  it("one event feeds three different lifecycles without any of them borrowing the others' figures", async () => {
    const received = (await repo.findByObjectId(RECEIVABLE)).find(
      (e) => e.eventType === EventType.COMMISSION_RECEIVED,
    )!;

    for (const objectId of [BATCH, INSTALLMENT, RECEIVABLE]) {
      const summary = (await positions.summarize(objectId))!;
      expect(summary.events.some((e) => e.id.value === received.id.value)).toBe(true);
    }

    // Same event, three positions: only the receivable counted it.
    expect((await positions.summarize(BATCH))!.totalSettled.toString()).toBe("0.00");
    expect((await positions.summarize(INSTALLMENT))!.totalSettled.toString()).toBe("0.00");
    expect((await positions.summarize(RECEIVABLE))!.totalSettled.toString()).toBe("1000.00");
  });
});
