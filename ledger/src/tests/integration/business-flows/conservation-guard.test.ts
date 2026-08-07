import { describe, expect, it } from "vitest";
import {
  obligationRecognized,
  payrollPayment,
  retractPayroll,
} from "./helpers/commands/obligation-commands";
import { advancePayment, advanceSettlement } from "./helpers/commands/advance-commands";
import { commissionExpected, commissionReceived } from "./helpers/commands/commission-commands";
import { makeRef } from "./helpers/ref";
import { setup } from "./helpers/setup";
import { foldObjectTotals } from "../../../core/application/dtos/retractionUtils";
import { PositionProjectionService } from "../../../core/application/services/PositionProjectionService";
import { EconomicEffect } from "../../../core/domain/enums/EconomicEffect";
import { ReasonType } from "../../../core/domain/enums/ReasonType";
import { Relation } from "../../../core/domain/enums/Relation";

/**
 * Conservation (Pillar 1) — nothing closes more than was opened.
 *
 * The guard used to compare a settlement against the amount of the ONE event its `relatedEventId`
 * named, and it only ran when that link was present. Two holes followed from that: a settlement
 * with no lineage was never measured at all, and a position opened by more than one event — or
 * whose origination was retracted and reissued — was measured against the wrong baseline.
 *
 * It now measures the position, because the position is the objectId. These tests pin the rule and,
 * as importantly, pin what it must NOT refuse: a fact whose baseline is absent or unknown is not a
 * fact that exceeds it.
 */

const ref = makeRef();

describe("conservation — what the guard refuses", () => {
  it("refuses a settlement that would close more than the position opened", async () => {
    const { run } = setup();
    await run(obligationRecognized(ref, "payroll:cons1", "45000.00"));
    await run(payrollPayment(ref, "payroll:cons1", "45000.00"));

    await expect(run(payrollPayment(ref, "payroll:cons1", "0.01"))).rejects.toThrow(
      /Over-settlement/,
    );
  });

  it("refuses it even when the settlement carries no lineage at all", async () => {
    const { run } = setup();
    // A payroll payment declares no relatedEventId — the old guard never ran for it.
    await run(obligationRecognized(ref, "payroll:cons2", "45000.00"));

    await expect(run(payrollPayment(ref, "payroll:cons2", "45001.00"))).rejects.toThrow(
      /Over-settlement/,
    );
  });

  it("reports the outstanding balance, not the amount of some origin event", async () => {
    const { run } = setup();
    await run(obligationRecognized(ref, "payroll:cons3", "45000.00"));
    await run(payrollPayment(ref, "payroll:cons3", "20000.00"));

    // 25000 remains. The message must say so — reporting 45000 here is what the old guard did.
    await expect(run(payrollPayment(ref, "payroll:cons3", "30000.00"))).rejects.toThrow(
      /outstanding balance of payroll:cons3 is 25000\.00/,
    );
  });

  it("measures the whole baseline when a position was opened more than once", async () => {
    const { run } = setup();
    // ADVANCE admits ORIGINATES, so a position may legitimately be opened twice.
    await run(advancePayment(ref, "adv:cons4", "300.00"));
    await run(advancePayment(ref, "adv:cons4", "200.00"));

    const origin = await run(advancePayment(ref, "adv:cons5", "500.00"));
    // Against the combined 500 baseline, 500 is admissible...
    await run(
      advanceSettlement(ref, "adv:cons4", origin.id.value, Relation.SETTLES, EconomicEffect.CASH_IN, "500.00", ReasonType.ADVANCE_PAYMENT),
    );
    // ...and a cent more is not. The old guard measured only the event relatedEventId named.
    await expect(
      run(advanceSettlement(ref, "adv:cons4", origin.id.value, Relation.SETTLES, EconomicEffect.CASH_IN, "0.01", ReasonType.ADVANCE_PAYMENT)),
    ).rejects.toThrow(/Over-settlement/);
  });
});

describe("conservation — what the guard must never refuse", () => {
  it("a cash-basis expense: nothing was originated, so there is no baseline to exceed", async () => {
    const { run } = setup();
    // Every payroll paid without a prior recognition takes this path. Refusing it would break the
    // ordinary case in the name of a baseline that does not exist.
    await run(payrollPayment(ref, "payroll:cash1", "45000.00"));
    await run(payrollPayment(ref, "payroll:cash1", "45000.00"));
  });

  it("a settlement on a position whose origination is unknown", async () => {
    const { run } = setup();
    const expected = await run(commissionExpected(ref, "com:orphan-origin", "1000.00"));
    // The orphan settles a DIFFERENT position, one nothing originated: unknown is not zero, and an
    // unknown baseline cannot be exceeded.
    await run(commissionReceived(ref, "com:orphan", expected.id.value, "5000.00"));
  });

  it("a settlement that lands exactly on the remaining balance", async () => {
    const { ledgerRepo, run } = setup();
    const positions = new PositionProjectionService(ledgerRepo);

    await run(obligationRecognized(ref, "payroll:exact", "45000.00"));
    await run(payrollPayment(ref, "payroll:exact", "20000.00"));
    await run(payrollPayment(ref, "payroll:exact", "25000.00"));

    const summary = (await positions.summarize("payroll:exact"))!;
    expect(summary.status).toBe("fully_settled");
    expect(summary.openBalance?.toString()).toBe("0.00");
  });

  it("a settlement whose earlier sibling was retracted — the retracted one never happened", async () => {
    const { run } = setup();
    await run(obligationRecognized(ref, "payroll:retr", "45000.00"));
    const wrong = await run(payrollPayment(ref, "payroll:retr", "45000.00"));
    await run(retractPayroll(ref, "payroll:retr", wrong.id.value, "45000.00"));

    // The baseline is intact and nothing stands against it, so the true payment is admissible.
    await run(payrollPayment(ref, "payroll:retr", "45000.00"));
  });
});

describe("conservation — the fold agrees with the projection", () => {
  /**
   * `foldObjectTotals` is a fourth expression of a rule the projection, the in-memory aggregate and
   * the SQL aggregate also express. The project's convention is that a duplicated rule needs a test
   * fixing the copies against each other — this is that test for the pair that can be compared in
   * process.
   */
  it("originated and closed match totalOriginated and totalSettled + totalAdjusted", async () => {
    const { ledgerRepo, run } = setup();
    const positions = new PositionProjectionService(ledgerRepo);

    const origin = await run(advancePayment(ref, "adv:fold", "1000.00"));
    await run(
      advanceSettlement(ref, "adv:fold", origin.id.value, Relation.SETTLES, EconomicEffect.CASH_IN, "300.00", ReasonType.ADVANCE_PAYMENT),
    );
    await run(
      advanceSettlement(ref, "adv:fold", origin.id.value, Relation.ADJUSTS, EconomicEffect.NON_CASH, "200.00", ReasonType.DEBT_RESTRUCTURING),
    );

    const summary = (await positions.summarize("adv:fold"))!;
    const totals = foldObjectTotals(await ledgerRepo.findByObjectId("adv:fold"), "adv:fold");

    expect(totals.originatedUnits).toBe(summary.totalOriginated.toUnits());
    expect(totals.closedUnits).toBe(
      summary.totalSettled.toUnits() + summary.totalAdjusted.toUnits(),
    );
    expect(totals.hasReversal).toBe(false);
  });

  it("both exclude a retracted event, and neither rewrites it", async () => {
    const { ledgerRepo, run } = setup();
    const positions = new PositionProjectionService(ledgerRepo);

    await run(obligationRecognized(ref, "payroll:fold2", "45000.00"));
    const wrong = await run(payrollPayment(ref, "payroll:fold2", "20000.00"));
    await run(retractPayroll(ref, "payroll:fold2", wrong.id.value, "20000.00"));

    const summary = (await positions.summarize("payroll:fold2"))!;
    const totals = foldObjectTotals(await ledgerRepo.findByObjectId("payroll:fold2"), "payroll:fold2");

    expect(totals.closedUnits).toBe(0n);
    expect(totals.closedUnits).toBe(
      summary.totalSettled.toUnits() + summary.totalAdjusted.toUnits(),
    );
    // The retracted event is still in the object's life — it stopped counting, it did not vanish.
    expect(summary.eventCount).toBe(3);
  });
});
