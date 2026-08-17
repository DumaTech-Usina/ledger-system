import { describe, expect, it } from "vitest";
import { assertChain, lifecycleOf } from "./helpers/assertions";
import {
  obligationRecognized,
  serviceFeePayment,
  taxPayment,
} from "./helpers/commands/obligation-commands";
import { makeRef } from "./helpers/ref";
import { setup } from "./helpers/setup";
import { PositionProjectionService } from "../../../core/application/services/PositionProjectionService";
import { CashPositionService } from "../../../core/application/services/CashPositionService";
import { EventType } from "../../../core/domain/enums/EventType";
import { ObjectType } from "../../../core/domain/enums/ObjectType";
import { ReasonType } from "../../../core/domain/enums/ReasonType";
import { Relation } from "../../../core/domain/enums/Relation";

/**
 * SERVICE_FEE_PAYMENT and TAX_PAYMENT — closing the two obligations that could only be opened.
 *
 * OBLIGATION_RECOGNIZED admits five cost categories, but only three of them had a settlement:
 * PAYROLL (payroll_payment), INFRASTRUCTURE_COST (infrastructure_expense) and PAYABLE
 * (outbound_payment). SERVICE_FEE and TAX appeared only under ORIGINATES and under
 * LEDGER_CORRECTION, so a recognized fee or tax opened a position with no event type able to close
 * it — the obligation stayed in `openPayableExposure` forever and the interface offered nothing.
 *
 * The gap was in the contracts alone: OBJECT_RELATION_MATRIX already admitted SETTLES for both, and
 * `ReasonType.TAX_PAYMENT` already existed, classified as cash_out · settles, reachable by no
 * contract at all. The category rides on the event type here rather than on the generic
 * OUTBOUND_PAYMENT, so that a fee paid reads as a fee in the reason and not only in the position.
 *
 * These flows mirror `obligation-recognition.test.ts` for the two new categories: both orders of
 * arrival are legitimate and converge, because the fold reads sums and never order.
 */

const ref = makeRef();

const FEE = "12000.00";
const TAX = "8500.00";

/** The recognition, pointed at a category other than the payroll the helper defaults to. */
const recognize = (objectId: string, objectType: ObjectType, amount: string, description: string) =>
  obligationRecognized(ref, objectId, amount, {
    objects: [{ objectId, objectType, relation: Relation.ORIGINATES }],
    reason: {
      type: ReasonType.OBLIGATION_RECOGNITION,
      description,
      confidence: "high" as never,
      requiresFollowup: false,
    },
  });

describe("service fee — recognition and settlement", () => {
  it("a recognized service fee opens a position that the payment can now close", async () => {
    const { ledgerRepo, run } = setup();
    const positions = new PositionProjectionService(ledgerRepo);

    await run(recognize("service_fee:fwd", ObjectType.SERVICE_FEE, FEE, "invoice issued by supplier"));

    const opened = (await positions.summarize("service_fee:fwd"))!;
    expect(opened.status).toBe("open");
    expect(opened.totalOriginated.toString()).toBe(FEE);
    expect(opened.openBalance?.toString()).toBe(FEE);

    await run(serviceFeePayment(ref, "service_fee:fwd", FEE));

    const closed = (await positions.summarize("service_fee:fwd"))!;
    expect(closed.status).toBe("fully_settled");
    expect(closed.openBalance?.toString()).toBe("0.00");

    expect(await lifecycleOf(ledgerRepo, "service_fee:fwd")).toEqual([
      EventType.OBLIGATION_RECOGNIZED,
      EventType.SERVICE_FEE_PAYMENT,
    ]);

    await assertChain(ledgerRepo);
  });

  it("the payment moves cash while the recognition did not", async () => {
    const { ledgerRepo, run } = setup();

    await run(recognize("service_fee:cash", ObjectType.SERVICE_FEE, FEE, "invoice issued"));
    const afterRecognition = await ledgerRepo.aggregateCashFlows();
    expect(afterRecognition.cashOutUnits).toBe(0n);

    await run(serviceFeePayment(ref, "service_fee:cash", FEE));
    const afterPayment = await ledgerRepo.aggregateCashFlows();
    expect(afterPayment.cashOutUnits).toBe(1200000n);
    expect(afterPayment.cashInUnits).toBe(0n);
  });

  it("a partial payment leaves the remainder outstanding", async () => {
    const { ledgerRepo, run } = setup();
    const positions = new PositionProjectionService(ledgerRepo);

    await run(recognize("service_fee:partial", ObjectType.SERVICE_FEE, FEE, "invoice issued"));
    await run(serviceFeePayment(ref, "service_fee:partial", "5000.00"));

    const summary = (await positions.summarize("service_fee:partial"))!;
    expect(summary.status).toBe("partially_settled");
    expect(summary.openBalance?.toString()).toBe("7000.00");
  });

  it("a fee paid with no recognition is the ordinary cash-basis fact — never gated on lineage", async () => {
    const { ledgerRepo, run } = setup();
    const positions = new PositionProjectionService(ledgerRepo);

    // Premise 5: the right to record an observed fact never depends on a prior related event.
    await run(serviceFeePayment(ref, "service_fee:rev", FEE));

    const summary = (await positions.summarize("service_fee:rev"))!;
    expect(summary.status).toBe("open");
    expect(summary.totalOriginated.toString()).toBe("0.00");
    expect(summary.openBalance?.toString()).toBe("0.00");
  });

  it("a recognition arriving after the payment originates the same position and closes it", async () => {
    const { ledgerRepo, run } = setup();
    const positions = new PositionProjectionService(ledgerRepo);

    await run(serviceFeePayment(ref, "service_fee:late", FEE));
    const late = await run(
      obligationRecognized(ref, "service_fee:late", FEE, {
        occurredAt: new Date("2025-04-15"),
        objects: [
          { objectId: "service_fee:late", objectType: ObjectType.SERVICE_FEE, relation: Relation.ORIGINATES },
        ],
        reason: {
          type: ReasonType.LATE_AWARENESS,
          description: "invoice located: it is what established this fee",
          confidence: "high" as never,
          requiresFollowup: false,
        },
      }),
    );

    // The recognition is not caused by the payment it explains: no lineage is asserted backwards.
    expect(late.relatedEventId).toBeNull();

    const summary = (await positions.summarize("service_fee:late"))!;
    expect(summary.status).toBe("fully_settled");
    expect(summary.totalOriginated.toString()).toBe(FEE);
    expect(summary.openBalance?.toString()).toBe("0.00");
  });
});

describe("tax — recognition and settlement", () => {
  it("a recognized tax opens a position that the payment can now close", async () => {
    const { ledgerRepo, run } = setup();
    const positions = new PositionProjectionService(ledgerRepo);

    await run(recognize("tax:fwd", ObjectType.TAX, TAX, "tax assessed for March"));
    await run(taxPayment(ref, "tax:fwd", TAX));

    const summary = (await positions.summarize("tax:fwd"))!;
    expect(summary.status).toBe("fully_settled");
    expect(summary.openBalance?.toString()).toBe("0.00");

    expect(await lifecycleOf(ledgerRepo, "tax:fwd")).toEqual([
      EventType.OBLIGATION_RECOGNIZED,
      EventType.TAX_PAYMENT,
    ]);

    await assertChain(ledgerRepo);
  });

  it("a tax paid with no assessment on the book is still recordable", async () => {
    const { ledgerRepo, run } = setup();
    const positions = new PositionProjectionService(ledgerRepo);

    await run(taxPayment(ref, "tax:rev", TAX));

    const summary = (await positions.summarize("tax:rev"))!;
    expect(summary.status).toBe("open");
    expect(summary.totalOriginated.toString()).toBe("0.00");
  });
});

describe("the settled obligation leaves the payable exposure", () => {
  it("a recognized fee counts as payable exposure until it is paid", async () => {
    const { ledgerRepo, run } = setup();
    const cash = new CashPositionService(ledgerRepo);

    await run(recognize("service_fee:exposure", ObjectType.SERVICE_FEE, FEE, "invoice issued"));
    const owed = await cash.summarize();
    expect(owed.openPayables.toString()).toBe(FEE);
    expect(owed.openPayablesByType).toEqual([
      { objectType: ObjectType.SERVICE_FEE, openBalance: expect.objectContaining({}) },
    ]);

    await run(serviceFeePayment(ref, "service_fee:exposure", FEE));
    const settled = await cash.summarize();
    // The whole point of the settlement existing: the obligation can now leave the figure.
    expect(settled.openPayables.toString()).toBe("0.00");
    // Receivables are the opposite direction and must not have moved — the two never sum.
    expect(settled.openReceivables.toString()).toBe("0.00");
  });
});

describe("the over-settlement guard now reaches these categories", () => {
  it("refuses to settle more than the fee that was recognized", async () => {
    const { run } = setup();

    await run(recognize("service_fee:over", ObjectType.SERVICE_FEE, FEE, "invoice issued"));

    // Originating a base is what makes the guard measurable: before the settlement contract
    // existed, no SETTLES could reach a SERVICE_FEE position at all.
    await expect(run(serviceFeePayment(ref, "service_fee:over", "20000.00"))).rejects.toThrow();
  });
});
