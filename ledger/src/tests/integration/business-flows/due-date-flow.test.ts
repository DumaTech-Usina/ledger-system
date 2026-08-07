import { describe, expect, it } from "vitest";
import { obligationRecognized, payrollPayment } from "./helpers/commands/obligation-commands";
import { makeRef } from "./helpers/ref";
import { setup } from "./helpers/setup";
import { PositionProjectionService } from "../../../core/application/services/PositionProjectionService";
import { computeCapitalMetrics, dueStateOf } from "../../../core/application/dtos/positionUtils";

/**
 * The whole life of a due date, over the real create → project path.
 *
 * The property being pinned: a recognized obligation moves from upcoming to overdue with NO event
 * recorded in between, and leaves both the moment it is paid. Nothing about lateness is stored — it
 * is read from the chain against a moment, which is why the same position answers differently to two
 * different `asOf` values without the book changing.
 *
 * The last test is the one that guards the constitution: an obligation whose establishing fact
 * stated no terms never becomes overdue, however long it sits.
 */

const ref = makeRef();

const AMOUNT = "45000.00";
const DUE = new Date("2026-08-20T00:00:00Z");

const BEFORE_DUE = new Date("2026-08-07T00:00:00Z");
const AFTER_DUE = new Date("2026-09-01T00:00:00Z");

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const metricsAt = (aggs: Awaited<ReturnType<typeof allAggregates>>, asOf: Date) =>
  computeCapitalMetrics(aggs, "BRL", asOf.getTime() - THIRTY_DAYS_MS, asOf);

function allAggregates(ledgerRepo: ReturnType<typeof setup>["ledgerRepo"]) {
  return ledgerRepo.findAllPositionAggregates();
}

describe("due date — from recognition to settlement", () => {
  it("carries the stated due date onto the position it originates", async () => {
    const { ledgerRepo, run } = setup();
    const positions = new PositionProjectionService(ledgerRepo);

    await run(obligationRecognized(ref, "payroll-due-1", AMOUNT, { dueAt: DUE }));

    const page = await positions.summarizePaginated({});
    const position = page.data.find((p) => p.objectId === "payroll-due-1")!;

    expect(position.dueAt).toEqual(DUE);
  });

  it("reads upcoming before the date and overdue after it, with nothing recorded in between", async () => {
    const { ledgerRepo, run } = setup();

    await run(obligationRecognized(ref, "payroll-due-2", AMOUNT, { dueAt: DUE }));

    const aggs = await allAggregates(ledgerRepo);
    const agg = aggs.find((a) => a.objectId === "payroll-due-2")!;

    expect(dueStateOf(agg, BEFORE_DUE)).toBe("upcoming");
    expect(dueStateOf(agg, AFTER_DUE)).toBe("overdue");
  });

  it("counts into upcoming, then into overdue, then into neither once paid", async () => {
    const { ledgerRepo, run } = setup();

    await run(obligationRecognized(ref, "payroll-due-3", AMOUNT, { dueAt: DUE }));

    const beforePayment = await allAggregates(ledgerRepo);
    const own = (aggs: typeof beforePayment) => aggs.filter((a) => a.objectId === "payroll-due-3");

    expect(metricsAt(own(beforePayment), BEFORE_DUE).upcomingPayableUnits).toBe(4_500_000n);
    expect(metricsAt(own(beforePayment), BEFORE_DUE).overduePayableUnits).toBe(0n);

    expect(metricsAt(own(beforePayment), AFTER_DUE).overduePayableUnits).toBe(4_500_000n);
    expect(metricsAt(own(beforePayment), AFTER_DUE).upcomingPayableUnits).toBe(0n);

    // The payment settles it in full. A paid debt cannot be late.
    await run(payrollPayment(ref, "payroll-due-3", AMOUNT));

    const afterPayment = own(await allAggregates(ledgerRepo));

    expect(metricsAt(afterPayment, AFTER_DUE).overduePayableUnits).toBe(0n);
    expect(metricsAt(afterPayment, AFTER_DUE).upcomingPayableUnits).toBe(0n);
    expect(metricsAt(afterPayment, AFTER_DUE).undatedPayableUnits).toBe(0n);
  });

  it("an obligation recognized without terms never becomes overdue, however long it sits", async () => {
    const { ledgerRepo, run } = setup();

    // No dueAt: the establishing fact said nothing about when it falls due.
    await run(obligationRecognized(ref, "payroll-undated", AMOUNT));

    const aggs = (await allAggregates(ledgerRepo)).filter((a) => a.objectId === "payroll-undated");

    // Years later, still not late — because nothing ever said it was due.
    const farFuture = new Date("2030-01-01T00:00:00Z");

    expect(dueStateOf(aggs[0], farFuture)).toBe("unknown");
    expect(metricsAt(aggs, farFuture).overduePayableUnits).toBe(0n);
    expect(metricsAt(aggs, farFuture).undatedPayableUnits).toBe(4_500_000n);
  });

  it("orders a listing by due date, nearest first, with undated positions last", async () => {
    const { ledgerRepo, run } = setup();
    const positions = new PositionProjectionService(ledgerRepo);

    await run(obligationRecognized(ref, "due-late", AMOUNT, { dueAt: new Date("2026-12-01") }));
    await run(obligationRecognized(ref, "due-undated", AMOUNT));
    await run(obligationRecognized(ref, "due-soon", AMOUNT, { dueAt: new Date("2026-08-10") }));

    const page = await positions.summarizePaginated({ sortBy: "dueAt", sortOrder: "ASC" });

    expect(page.data.map((p) => p.objectId)).toEqual(["due-soon", "due-late", "due-undated"]);
  });
});
