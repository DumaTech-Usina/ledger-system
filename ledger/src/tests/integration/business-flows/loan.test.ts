import { describe, expect, it } from "vitest";
import { assertChain, lifecycleOf } from "./helpers/assertions";
import { makeRef } from "./helpers/ref";
import { setup } from "./helpers/setup";
import { loanOrigination, loanRepayment } from "./helpers/commands/loan-commands";
import { EconomicEffect } from "../../../core/domain/enums/EconomicEffect";
import { EventType } from "../../../core/domain/enums/EventType";
import { ReasonType } from "../../../core/domain/enums/ReasonType";
import { Relation } from "../../../core/domain/enums/Relation";

const ref = makeRef();

describe("Loan lifecycles", () => {
  it("S7 — cash repayment: loan originated and fully repaid in cash", async () => {
    const { ledgerRepo, run } = setup();

    const loan = await run(loanOrigination(ref, "loan-s7", "2000.00"));
    const repayment = await run(
      loanRepayment(ref, "loan-s7", loan.id.value, EconomicEffect.CASH_IN, Relation.SETTLES, ReasonType.LOAN_REPAYMENT, "2000.00"),
    );

    await assertChain(ledgerRepo);

    expect(repayment.relatedEventId).toBe(loan.id.value);
    expect(repayment.economicEffect).toBe(EconomicEffect.CASH_IN);

    expect(await lifecycleOf(ledgerRepo, "loan-s7")).toEqual([
      EventType.LOAN_ORIGINATION,
      EventType.LOAN_REPAYMENT,
    ]);

    const caused = await ledgerRepo.findByRelatedEventId(loan.id.value);
    expect(caused).toHaveLength(1);
    expect(caused[0].eventType).toBe(EventType.LOAN_REPAYMENT);
  });

  it("S8 — repayment via commission deduction: broker's future commission offsets the loan balance", async () => {
    const { ledgerRepo, run } = setup();

    const loan = await run(loanOrigination(ref, "loan-s8", "2000.00"));

    const repay1 = await run(
      loanRepayment(ref, "loan-s8", loan.id.value, EconomicEffect.NON_CASH, Relation.ADJUSTS, ReasonType.LOAN_REPAYMENT_VIA_COMMISSION, "800.00"),
    );
    const repay2 = await run(
      loanRepayment(ref, "loan-s8", loan.id.value, EconomicEffect.NON_CASH, Relation.SETTLES, ReasonType.LOAN_REPAYMENT_VIA_COMMISSION, "1200.00"),
    );

    await assertChain(ledgerRepo);

    expect(repay1.economicEffect).toBe(EconomicEffect.NON_CASH);
    expect(repay2.economicEffect).toBe(EconomicEffect.NON_CASH);

    expect(await lifecycleOf(ledgerRepo, "loan-s8")).toEqual([
      EventType.LOAN_ORIGINATION,
      EventType.LOAN_REPAYMENT,
      EventType.LOAN_REPAYMENT,
    ]);

    expect(await ledgerRepo.findByRelatedEventId(loan.id.value)).toHaveLength(2);
  });
});
