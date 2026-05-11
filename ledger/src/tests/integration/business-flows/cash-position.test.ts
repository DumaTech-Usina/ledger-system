import { describe, it, expect } from "vitest";
import { setup } from "./helpers/setup";
import { makeRef } from "./helpers/ref";
import { loanOrigination, loanRepayment } from "./helpers/commands/loan-commands";
import { advancePayment } from "./helpers/commands/advance-commands";
import { commissionReceived } from "./helpers/commands/commission-commands";
import { CashPositionService } from "../../../core/application/services/CashPositionService";
import { EconomicEffect } from "../../../core/domain/enums/EconomicEffect";
import { Relation } from "../../../core/domain/enums/Relation";
import { ReasonType } from "../../../core/domain/enums/ReasonType";

const ref = makeRef();

describe("CashPositionService — integration", () => {
  it("CPS1 — loan originated + partially repaid: openReceivables > 0, both cash flows reflected", async () => {
    const { ledgerRepo, run } = setup();
    const svc = new CashPositionService(ledgerRepo);

    const loan = await run(loanOrigination(ref, "cps1-loan", "5000.00"));
    await run(loanRepayment(ref, "cps1-loan", loan.id.value, EconomicEffect.CASH_IN, Relation.SETTLES, ReasonType.LOAN_REPAYMENT, "2000.00"));

    const result = await svc.summarize();

    expect(result.totalCashOut.toString()).toBe("5000.00");
    expect(result.totalCashIn.toString()).toBe("2000.00");
    expect(result.openReceivables.toString()).toBe("3000.00");
  });

  it("CPS2 — loan fully repaid via cash: openReceivables = 0", async () => {
    const { ledgerRepo, run } = setup();
    const svc = new CashPositionService(ledgerRepo);

    const loan = await run(loanOrigination(ref, "cps2-loan", "3000.00"));
    await run(loanRepayment(ref, "cps2-loan", loan.id.value, EconomicEffect.CASH_IN, Relation.SETTLES, ReasonType.LOAN_REPAYMENT, "3000.00"));

    const result = await svc.summarize();

    expect(result.openReceivables.toString()).toBe("0.00");
    expect(result.totalCashIn.toString()).toBe("3000.00");
  });

  it("CPS3 — advance disbursed, not recovered: totalCashOut reflects disbursement, openReceivables = full balance", async () => {
    const { ledgerRepo, run } = setup();
    const svc = new CashPositionService(ledgerRepo);

    await run(advancePayment(ref, "cps3-adv", "4000.00"));

    const result = await svc.summarize();

    expect(result.totalCashOut.toString()).toBe("4000.00");
    expect(result.totalCashIn.toString()).toBe("0.00");
    expect(result.openReceivables.toString()).toBe("4000.00");
  });

  it("CPS4 — commission received: goes to totalCashIn only, NOT openReceivables", async () => {
    const { ledgerRepo, run } = setup();
    const svc = new CashPositionService(ledgerRepo);

    await run(commissionReceived(ref, "cps4-com", "2000.00"));

    const result = await svc.summarize();

    expect(result.totalCashIn.toString()).toBe("2000.00");
    expect(result.openReceivables.toString()).toBe("0.00");
  });

  it("CPS5 — multiple loans in mixed states: only open / partially_settled ones contribute", async () => {
    const { ledgerRepo, run } = setup();
    const svc = new CashPositionService(ledgerRepo);

    // Loan 1: fully repaid → should NOT contribute to openReceivables
    const loan1 = await run(loanOrigination(ref, "cps5-loan1", "1000.00"));
    await run(loanRepayment(ref, "cps5-loan1", loan1.id.value, EconomicEffect.CASH_IN, Relation.SETTLES, ReasonType.LOAN_REPAYMENT, "1000.00"));

    // Loan 2: open → should contribute
    await run(loanOrigination(ref, "cps5-loan2", "2000.00"));

    // Loan 3: partially repaid → should contribute (open balance = 1500)
    const loan3 = await run(loanOrigination(ref, "cps5-loan3", "2500.00"));
    await run(loanRepayment(ref, "cps5-loan3", loan3.id.value, EconomicEffect.CASH_IN, Relation.SETTLES, ReasonType.LOAN_REPAYMENT, "1000.00"));

    const result = await svc.summarize();

    // openReceivables = loan2 (2000) + loan3 open balance (1500) = 3500
    expect(result.openReceivables.toString()).toBe("3500.00");
  });
});
