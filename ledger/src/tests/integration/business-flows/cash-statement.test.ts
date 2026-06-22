import { describe, it, expect } from "vitest";
import { setup } from "./helpers/setup";
import { makeRef } from "./helpers/ref";
import { loanOrigination, loanRepayment } from "./helpers/commands/loan-commands";
import { commissionExpected, commissionReceived, commissionSplit } from "./helpers/commands/commission-commands";
import { USINA } from "./helpers/parties";
import { CashStatementService } from "../../../core/application/services/CashStatementService";
import { EconomicEffect } from "../../../core/domain/enums/EconomicEffect";
import { Relation } from "../../../core/domain/enums/Relation";
import { ReasonType } from "../../../core/domain/enums/ReasonType";

const ref = makeRef();

// Loan commands with specific occurredAt dates
function loanOut(ref: (l: string) => string, objectId: string, amount: string, occurredAt: Date) {
  return { ...loanOrigination(ref, objectId, amount), occurredAt };
}

function loanIn(ref: (l: string) => string, objectId: string, relatedId: string, amount: string, occurredAt: Date) {
  return {
    ...loanRepayment(ref, objectId, relatedId, EconomicEffect.CASH_IN, Relation.SETTLES, ReasonType.LOAN_REPAYMENT, amount),
    occurredAt,
  };
}

const PRIOR    = new Date("2026-01-15T00:00:00Z");
const PERIOD_FROM = new Date("2026-02-01T00:00:00Z");
const PERIOD_TO   = new Date("2026-02-28T23:59:59Z");
const IN_PERIOD = new Date("2026-02-10T00:00:00Z");

describe("CashStatementService — integration", () => {
  it("CSS1 — loan originated + repaid in period: openingBalance + netFlow = closingBalance", async () => {
    const { ledgerRepo, run } = setup();
    const svc = new CashStatementService(ledgerRepo, USINA);

    const loan = await run(loanOut(ref, "css1-loan", "5000.00", IN_PERIOD));
    await run(loanIn(ref, "css1-loan", loan.id.value, "5000.00", new Date("2026-02-20T00:00:00Z")));

    const result = await svc.summarize(PERIOD_FROM, PERIOD_TO);

    expect(result.totalCashOut.toString()).toBe("5000.00");
    expect(result.totalCashIn.toString()).toBe("5000.00");
    // openingBalance + cashIn - cashOut = closingBalance
    // 0 + 5000 - 5000 = 0
    expect(result.closingBalance.toString()).toBe("0.00");
    expect(result.openingBalance.toString()).toBe("0.00");
  });

  it("CSS2 — commission received then split: both sides reflected, net correct", async () => {
    const { ledgerRepo, run } = setup();
    const svc = new CashStatementService(ledgerRepo, USINA);

    const periodFrom = new Date("2026-03-01T00:00:00Z");
    const periodTo   = new Date("2026-03-31T23:59:59Z");
    const inPeriod   = new Date("2026-03-10T00:00:00Z");

    const css2Expected = await run(commissionExpected(ref, "css2-com-recv", "1000.00"));
    await run({ ...commissionReceived(ref, "css2-com-recv", css2Expected.id.value, "1000.00"), occurredAt: inPeriod });
    await run({ ...commissionSplit(ref, "css2-com-split", "700.00"), occurredAt: inPeriod });

    const result = await svc.summarize(periodFrom, periodTo);

    expect(result.totalCashIn.toString()).toBe("1000.00");
    expect(result.totalCashOut.toString()).toBe("700.00");
    // net = 1000 - 700 = 300
    expect(result.netFlow.toString()).toBe("300.00");
    // closing = 0 + 1000 - 700 = 300
    expect(result.closingBalance.toString()).toBe("300.00");
  });

  it("CSS4 — prior CASH_OUT exceeds prior CASH_IN: openingBalance carries the deficit as negative", async () => {
    const { ledgerRepo, run } = setup();
    const svc = new CashStatementService(ledgerRepo, USINA);

    // Prior: 3000 out, 1000 in → net = -2000
    await run(loanOut(ref, "css4-loan-prior", "3000.00", PRIOR));
    const css4Expected = await run(commissionExpected(ref, "css4-comm-prior", "1000.00"));
    await run({ ...commissionReceived(ref, "css4-comm-prior", css4Expected.id.value, "1000.00"), occurredAt: PRIOR });

    const result = await svc.summarize(PERIOD_FROM, PERIOD_TO);

    expect(result.openingBalance.toString()).toBe("2000.00");
    expect(result.openingBalanceNegative).toBe(true);
    expect(result.totalCashIn.toString()).toBe("0.00");
    expect(result.totalCashOut.toString()).toBe("0.00");
    // closing = opening (-2000) + 0 in - 0 out = -2000
    expect(result.closingBalance.toString()).toBe("2000.00");
    expect(result.closingBalanceNegative).toBe(true);
  });

  it("CSS3 — events span multiple periods: prior events feed openingBalance; period totals only count [from, to]", async () => {
    const { ledgerRepo, run } = setup();
    const svc = new CashStatementService(ledgerRepo, USINA);

    // Prior: CASH_IN 4000 (commission)
    const css3PriorExpected = await run(commissionExpected(ref, "css3-com-prior", "4000.00"));
    await run({
      ...commissionReceived(ref, "css3-com-prior", css3PriorExpected.id.value, "4000.00"),
      occurredAt: PRIOR,
    });

    // Prior: CASH_OUT 1000 (loan)
    await run({
      ...loanOrigination(ref, "css3-loan-prior2", "1000.00"),
      occurredAt: PRIOR,
    });

    // In-period: CASH_IN 2000
    const css3PeriodExpected = await run(commissionExpected(ref, "css3-com-period", "2000.00"));
    await run({
      ...commissionReceived(ref, "css3-com-period", css3PeriodExpected.id.value, "2000.00"),
      occurredAt: IN_PERIOD,
    });

    const result = await svc.summarize(PERIOD_FROM, PERIOD_TO);

    // openingBalance = 4000 - 1000 = 3000 (prior cash net)
    expect(result.openingBalance.toString()).toBe("3000.00");
    // period totalCashIn = 2000, totalCashOut = 0
    expect(result.totalCashIn.toString()).toBe("2000.00");
    expect(result.totalCashOut.toString()).toBe("0.00");
    // closingBalance = 3000 + 2000 - 0 = 5000
    expect(result.closingBalance.toString()).toBe("5000.00");
  });
});
