import { describe, expect, it } from "vitest";
import { assertChain, lifecycleOf } from "./helpers/assertions";
import {
  obligationRecognized,
  payrollPayment,
  retractPayroll,
} from "./helpers/commands/obligation-commands";
import { makeRef } from "./helpers/ref";
import { setup } from "./helpers/setup";
import { PositionProjectionService } from "../../../core/application/services/PositionProjectionService";
import { EventType } from "../../../core/domain/enums/EventType";
import { ObjectType } from "../../../core/domain/enums/ObjectType";
import { ReasonType } from "../../../core/domain/enums/ReasonType";
import { Relation } from "../../../core/domain/enums/Relation";

/**
 * OBLIGATION_RECOGNIZED — an obligation the usina owes, established by an external fact.
 *
 * Until this event existed, an expense only entered the book when the money left: the four cost
 * object types admitted SETTLES alone, so a payroll "was born settled" and there were no structured
 * accounts payable. That was a classification, not a law, and it was too strong — closing a payroll
 * and receiving an invoice are observable facts that create an obligation before any cash moves.
 *
 * This file pins the property the whole design rests on: the two orders of arrival are both
 * legitimate and derive to the same position. The fold reads sums, never order, so the convergence
 * is a consequence of the existing derivation — these tests exist to keep it that way.
 *
 *   forward — recognition ORIGINATES, payment SETTLES later
 *   reverse — payment SETTLES first, recognition ORIGINATES it afterwards (late awareness)
 */

const ref = makeRef();

const AMOUNT = "45000.00";

describe("obligation recognition — the forward order", () => {
  it("a recognized obligation opens a position carrying its full amount, with no cash moved", async () => {
    const { ledgerRepo, run } = setup();
    const positions = new PositionProjectionService(ledgerRepo);

    const recognition = await run(obligationRecognized(ref, "payroll:fwd", AMOUNT));

    expect(recognition.economicEffect).toBe("non_cash");
    expect(recognition.relatedEventId).toBeNull();

    const summary = (await positions.summarize("payroll:fwd"))!;
    expect(summary.status).toBe("open");
    expect(summary.totalOriginated.toString()).toBe(AMOUNT);
    expect(summary.openBalance?.toString()).toBe(AMOUNT);

    // The recognition is NON_CASH: it must not have moved a cent.
    const { cashInUnits, cashOutUnits } = await ledgerRepo.aggregateCashFlows();
    expect(cashInUnits).toBe(0n);
    expect(cashOutUnits).toBe(0n);
  });

  it("the payment settles the recognized obligation and closes it", async () => {
    const { ledgerRepo, run } = setup();
    const positions = new PositionProjectionService(ledgerRepo);

    await run(obligationRecognized(ref, "payroll:fwd2", AMOUNT));
    await run(payrollPayment(ref, "payroll:fwd2", AMOUNT));

    const summary = (await positions.summarize("payroll:fwd2"))!;
    expect(summary.status).toBe("fully_settled");
    expect(summary.openBalance?.toString()).toBe("0.00");

    expect(await lifecycleOf(ledgerRepo, "payroll:fwd2")).toEqual([
      EventType.OBLIGATION_RECOGNIZED,
      EventType.PAYROLL_PAYMENT,
    ]);

    const { cashOutUnits } = await ledgerRepo.aggregateCashFlows();
    expect(cashOutUnits).toBe(4500000n);

    await assertChain(ledgerRepo);
  });

  it("a partial payment leaves the remainder outstanding", async () => {
    const { ledgerRepo, run } = setup();
    const positions = new PositionProjectionService(ledgerRepo);

    await run(obligationRecognized(ref, "payroll:partial", AMOUNT));
    await run(payrollPayment(ref, "payroll:partial", "20000.00"));

    const summary = (await positions.summarize("payroll:partial"))!;
    expect(summary.status).toBe("partially_settled");
    expect(summary.openBalance?.toString()).toBe("25000.00");
  });
});

describe("obligation recognition — the reverse order", () => {
  it("a payment with no recognition is a cash-basis fact: open, nothing originated, zero balance", async () => {
    const { ledgerRepo, run } = setup();
    const positions = new PositionProjectionService(ledgerRepo);

    await run(payrollPayment(ref, "payroll:rev", AMOUNT));

    // The pre-existing reading, unchanged: nothing was originated and none is claimed.
    const summary = (await positions.summarize("payroll:rev"))!;
    expect(summary.status).toBe("open");
    expect(summary.totalOriginated.toString()).toBe("0.00");
    expect(summary.openBalance?.toString()).toBe("0.00");
  });

  it("the recognition arriving after the payment originates the same position and closes it", async () => {
    const { ledgerRepo, run } = setup();
    const positions = new PositionProjectionService(ledgerRepo);

    await run(payrollPayment(ref, "payroll:rev2", AMOUNT));
    // The invoice was only identified afterwards — LATE_AWARENESS is the honest reason.
    const late = await run(
      obligationRecognized(ref, "payroll:rev2", AMOUNT, {
        occurredAt: new Date("2025-04-15"),
        reason: {
          type: ReasonType.LATE_AWARENESS,
          description: "invoice located: it is what established the March payroll obligation",
          confidence: "high" as never,
          requiresFollowup: false,
        },
      }),
    );

    expect(late.getReason()?.type).toBe(ReasonType.LATE_AWARENESS);
    // Nothing was rewritten: the recognition names the position, it does not point at the payment.
    expect(late.relatedEventId).toBeNull();

    const summary = (await positions.summarize("payroll:rev2"))!;
    expect(summary.status).toBe("fully_settled");
    expect(summary.totalOriginated.toString()).toBe(AMOUNT);
    expect(summary.openBalance?.toString()).toBe("0.00");

    expect(await lifecycleOf(ledgerRepo, "payroll:rev2")).toEqual([
      EventType.PAYROLL_PAYMENT,
      EventType.OBLIGATION_RECOGNIZED,
    ]);

    await assertChain(ledgerRepo);
  });
});

describe("obligation recognition — convergence", () => {
  it("both orders of arrival derive to the same position", async () => {
    const { ledgerRepo, run } = setup();
    const positions = new PositionProjectionService(ledgerRepo);

    await run(obligationRecognized(ref, "payroll:c-fwd", AMOUNT));
    await run(payrollPayment(ref, "payroll:c-fwd", AMOUNT));

    await run(payrollPayment(ref, "payroll:c-rev", AMOUNT));
    await run(obligationRecognized(ref, "payroll:c-rev", AMOUNT));

    const forward = (await positions.summarize("payroll:c-fwd"))!;
    const reverse = (await positions.summarize("payroll:c-rev"))!;

    // The fold reads sums, never order. Everything the position asserts must match.
    expect(reverse.status).toBe(forward.status);
    expect(reverse.outcome).toBe(forward.outcome);
    expect(reverse.objectType).toBe(forward.objectType);
    expect(reverse.totalOriginated.toString()).toBe(forward.totalOriginated.toString());
    expect(reverse.totalSettled.toString()).toBe(forward.totalSettled.toString());
    expect(reverse.openBalance?.toString()).toBe(forward.openBalance?.toString());
    expect(reverse.overSettlement?.toString()).toBe(forward.overSettlement?.toString());
  });

  it("the aggregate read path agrees with the detail read path on both orders", async () => {
    const { ledgerRepo, run } = setup();
    const positions = new PositionProjectionService(ledgerRepo);

    await run(obligationRecognized(ref, "payroll:agg-fwd", AMOUNT));
    await run(payrollPayment(ref, "payroll:agg-fwd", "20000.00"));
    await run(payrollPayment(ref, "payroll:agg-rev", "20000.00"));
    await run(obligationRecognized(ref, "payroll:agg-rev", AMOUNT));

    const aggregates = await ledgerRepo.findPositionAggregates({ limit: 200 });

    for (const objectId of ["payroll:agg-fwd", "payroll:agg-rev"]) {
      const detail = (await positions.summarize(objectId))!;
      const listed = aggregates.data.find((a) => a.objectId === objectId)!;
      const item = positions.aggregateToListItem(listed);

      expect(item.status).toBe(detail.status);
      expect(item.objectType).toBe(detail.objectType);
      expect(item.openBalance?.toString()).toBe(detail.openBalance?.toString());
      expect(item.totalOriginated.toString()).toBe(detail.totalOriginated.toString());
    }
  });
});

describe("obligation recognition — a position named with more than one objectType", () => {
  /**
   * Continuity is the producer's assertion and the Ledger deliberately does not police it, so a
   * payment that settled a PAYROLL and a recognition that later originated the same objectId as a
   * PAYABLE is recordable. It is not what Treasury produces, but the read paths must still agree on
   * which type the position is — and store order is not a rule. Both resolve it with MAX, the rule
   * the SQL aggregate has always used.
   */
  const mixed = (objectId: string) => ({
    objects: [
      { objectId, objectType: ObjectType.PAYABLE, relation: Relation.ORIGINATES },
    ],
  });

  it.each([
    ["settlement first", ["pay", "recognize"]],
    ["recognition first", ["recognize", "pay"]],
  ] as const)(
    "the detail and aggregate read paths agree on the objectType — %s",
    async (_name, order) => {
      const { ledgerRepo, run } = setup();
      const positions = new PositionProjectionService(ledgerRepo);
      const objectId = `payroll:mixed-${_name.replace(/\s/g, "-")}`;

      for (const step of order) {
        if (step === "pay") await run(payrollPayment(ref, objectId, AMOUNT));
        else await run(obligationRecognized(ref, objectId, AMOUNT, mixed(objectId)));
      }

      const detail = (await positions.summarize(objectId))!;
      const aggregates = await ledgerRepo.findPositionAggregates({ limit: 200 });
      const listed = aggregates.data.find((a) => a.objectId === objectId)!;

      expect(detail.objectType).toBe(listed.objectType);
      // MAX over {payable, payroll} — the same tie-break the SQL aggregate applies.
      expect(detail.objectType).toBe(ObjectType.PAYROLL);
      // And the figures converge exactly as when both events name one type.
      expect(detail.status).toBe("fully_settled");
      expect(detail.openBalance?.toString()).toBe("0.00");
    },
  );
});

describe("obligation recognition — what the recognition may not do", () => {
  it("a recognition cannot settle: only ORIGINATES is admitted for the cost types", async () => {
    const { run } = setup();

    await expect(
      run(
        obligationRecognized(ref, "payroll:bad", AMOUNT, {
          objects: [
            {
              objectId: "payroll:bad",
              objectType: ObjectType.PAYROLL,
              relation: Relation.SETTLES,
            },
          ],
        }),
      ),
    ).rejects.toThrow();
  });

  it("a recognition cannot move cash: the payment that follows is a separate fact", async () => {
    const { run } = setup();

    await expect(
      run(
        obligationRecognized(ref, "payroll:bad2", AMOUNT, {
          economicEffect: "cash_out" as never,
        }),
      ),
    ).rejects.toThrow();
  });

  it("a recognition is accepted with no relatedEventId — validity never depends on lineage", async () => {
    const { run } = setup();
    const recognition = await run(obligationRecognized(ref, "payroll:nolineage", AMOUNT));
    expect(recognition.relatedEventId).toBeNull();
  });
});

describe("obligation recognition — correcting one", () => {
  it("retracting the recognition takes the origination back out of the derivation", async () => {
    const { ledgerRepo, run } = setup();
    const positions = new PositionProjectionService(ledgerRepo);

    const recognition = await run(obligationRecognized(ref, "payroll:retract", AMOUNT));
    await run(payrollPayment(ref, "payroll:retract", "20000.00"));

    const before = (await positions.summarize("payroll:retract"))!;
    expect(before.status).toBe("partially_settled");
    expect(before.openBalance?.toString()).toBe("25000.00");

    await run(retractPayroll(ref, "payroll:retract", recognition.id.value, AMOUNT));

    // Nothing was rewritten: the recognition is still on record, it just stops counting. With no
    // standing origination the position falls back to what a cash-basis expense reads.
    const after = (await positions.summarize("payroll:retract"))!;
    expect(after.status).toBe("open");
    expect(after.totalOriginated.toString()).toBe("0.00");
    expect(after.openBalance?.toString()).toBe("0.00");

    const stored = await ledgerRepo.getById(recognition.id.value);
    expect(stored!.hash.value).toBe(recognition.hash.value);

    expect(await lifecycleOf(ledgerRepo, "payroll:retract")).toEqual([
      EventType.OBLIGATION_RECOGNIZED,
      EventType.PAYROLL_PAYMENT,
      EventType.LEDGER_CORRECTION,
    ]);

    await assertChain(ledgerRepo);
  });
});
