import { describe, expect, it } from "vitest";
import { PositionProjectionService } from "../../../core/application/services/PositionProjectionService";
import { EconomicEffect } from "../../../core/domain/enums/EconomicEffect";
import { ObjectType } from "../../../core/domain/enums/ObjectType";
import { ReasonType } from "../../../core/domain/enums/ReasonType";
import { Relation } from "../../../core/domain/enums/Relation";
import { advancePayment, advanceSettlement } from "./helpers/commands/advance-commands";
import { ledgerCorrection } from "./helpers/commands/correction-commands";
import { loanOrigination, loanRepayment } from "./helpers/commands/loan-commands";
import { makeRef } from "./helpers/ref";
import { setup } from "./helpers/setup";

const ref = makeRef();

function makeService(ledgerRepo: ReturnType<typeof setup>["ledgerRepo"]) {
  return new PositionProjectionService(ledgerRepo);
}

describe("PositionProjectionService.summarizePaginated() — business flows", () => {
  it("PA1 — empty ledger returns empty page with zero total", async () => {
    const { ledgerRepo } = setup();

    const result = await makeService(ledgerRepo).summarizePaginated({});

    expect(result.data).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it("PA2 — loan originated but not repaid: open, pending, openBalance = totalOriginated", async () => {
    const { ledgerRepo, run } = setup();
    await run(loanOrigination(ref, "loan-pa2", "2000.00"));

    const result = await makeService(ledgerRepo).summarizePaginated({});
    const pos = result.data.find((p) => p.objectId === "loan-pa2")!;

    expect(pos.status).toBe("open");
    expect(pos.outcome).toBe("pending");
    expect(pos.totalOriginated.toString()).toBe("2000.00");
    expect(pos.openBalance.toString()).toBe("2000.00");
    expect(pos.cashRecovered.toString()).toBe("0.00");
    expect(pos.overSettlement.toString()).toBe("0.00");
    expect(pos.eventCount).toBe(1);
  });

  it("PA3 — loan fully repaid via CASH_IN: fully_settled, gain, openBalance = 0", async () => {
    const { ledgerRepo, run } = setup();
    const loan = await run(loanOrigination(ref, "loan-pa3", "2000.00"));
    await run(loanRepayment(ref, "loan-pa3", loan.id.value, EconomicEffect.CASH_IN, Relation.SETTLES, ReasonType.LOAN_REPAYMENT, "2000.00"));

    const result = await makeService(ledgerRepo).summarizePaginated({});
    const pos = result.data.find((p) => p.objectId === "loan-pa3")!;

    expect(pos.status).toBe("fully_settled");
    expect(pos.outcome).toBe("gain");
    expect(pos.openBalance.toString()).toBe("0.00");
    expect(pos.cashRecovered.toString()).toBe("2000.00");
    expect(pos.nonCashClosed.toString()).toBe("0.00");
    expect(pos.eventCount).toBe(2);
  });

  it("PA4 — loan partially repaid: partially_settled, pending, openBalance reflects remainder", async () => {
    const { ledgerRepo, run } = setup();
    const loan = await run(loanOrigination(ref, "loan-pa4", "2000.00"));
    await run(loanRepayment(ref, "loan-pa4", loan.id.value, EconomicEffect.CASH_IN, Relation.SETTLES, ReasonType.LOAN_REPAYMENT, "800.00"));

    const result = await makeService(ledgerRepo).summarizePaginated({});
    const pos = result.data.find((p) => p.objectId === "loan-pa4")!;

    expect(pos.status).toBe("partially_settled");
    expect(pos.outcome).toBe("pending");
    expect(pos.totalOriginated.toString()).toBe("2000.00");
    expect(pos.totalSettled.toString()).toBe("800.00");
    expect(pos.openBalance.toString()).toBe("1200.00");
  });

  it("PA5 — advance settled via NON_CASH loss recognition: fully_settled, full_loss", async () => {
    const { ledgerRepo, run } = setup();
    const adv = await run(advancePayment(ref, "adv-pa5", "500.00"));
    await run(advanceSettlement(ref, "adv-pa5", adv.id.value, Relation.SETTLES, EconomicEffect.NON_CASH, "500.00", ReasonType.LOSS_RECOGNITION));

    const result = await makeService(ledgerRepo).summarizePaginated({});
    const pos = result.data.find((p) => p.objectId === "adv-pa5")!;

    expect(pos.status).toBe("fully_settled");
    expect(pos.outcome).toBe("full_loss");
    expect(pos.cashRecovered.toString()).toBe("0.00");
    expect(pos.nonCashClosed.toString()).toBe("500.00");
  });

  it("PA6 — advance partially recovered in cash, remainder written off: partial_loss", async () => {
    const { ledgerRepo, run } = setup();
    const adv = await run(advancePayment(ref, "adv-pa6", "500.00"));
    await run(advanceSettlement(ref, "adv-pa6", adv.id.value, Relation.SETTLES, EconomicEffect.CASH_IN, "200.00", ReasonType.ADVANCE_PAYMENT));
    await run(advanceSettlement(ref, "adv-pa6", adv.id.value, Relation.SETTLES, EconomicEffect.NON_CASH, "300.00", ReasonType.LOSS_RECOGNITION));

    const result = await makeService(ledgerRepo).summarizePaginated({});
    const pos = result.data.find((p) => p.objectId === "adv-pa6")!;

    expect(pos.status).toBe("fully_settled");
    expect(pos.outcome).toBe("partial_loss");
    expect(pos.cashRecovered.toString()).toBe("200.00");
    expect(pos.nonCashClosed.toString()).toBe("300.00");
  });

  it("PA7 — position reversed via LEDGER_CORRECTION: reversed, cancelled", async () => {
    const { ledgerRepo, run } = setup();
    await run(loanOrigination(ref, "loan-pa7", "1000.00"));
    await run(ledgerCorrection(ref, "loan-pa7", ObjectType.LOAN, Relation.REVERSES, ReasonType.MANUAL_CORRECTION));

    const result = await makeService(ledgerRepo).summarizePaginated({});
    const pos = result.data.find((p) => p.objectId === "loan-pa7")!;

    expect(pos.status).toBe("reversed");
    expect(pos.outcome).toBe("cancelled");
  });

  it("PA8 — status=open in a mixed set returns only open, total reflects the filter", async () => {
    const { ledgerRepo, run } = setup();
    await run(loanOrigination(ref, "loan-pa8-open", "1000.00"));
    const settled = await run(loanOrigination(ref, "loan-pa8-settled", "500.00"));
    await run(loanRepayment(ref, "loan-pa8-settled", settled.id.value, EconomicEffect.CASH_IN, Relation.SETTLES, ReasonType.LOAN_REPAYMENT, "500.00"));
    const partial = await run(loanOrigination(ref, "loan-pa8-partial", "1000.00"));
    await run(loanRepayment(ref, "loan-pa8-partial", partial.id.value, EconomicEffect.CASH_IN, Relation.SETTLES, ReasonType.LOAN_REPAYMENT, "400.00"));

    const result = await makeService(ledgerRepo).summarizePaginated({ status: "open" });
    const ids = result.data.map((p) => p.objectId);

    expect(result.total).toBe(1);
    expect(ids).toContain("loan-pa8-open");
    expect(ids).not.toContain("loan-pa8-settled");
    expect(ids).not.toContain("loan-pa8-partial");
  });

  it("PA9 — objectType=advance excludes loans, total reflects the filter", async () => {
    const { ledgerRepo, run } = setup();
    await run(loanOrigination(ref, "loan-pa9", "1000.00"));
    await run(advancePayment(ref, "adv-pa9", "500.00"));

    const result = await makeService(ledgerRepo).summarizePaginated({ objectType: ObjectType.ADVANCE });
    const ids = result.data.map((p) => p.objectId);

    expect(result.total).toBe(1);
    expect(ids).toContain("adv-pa9");
    expect(ids).not.toContain("loan-pa9");
  });

  it("PA10 — status=open and objectType=advance returns only the intersection", async () => {
    const { ledgerRepo, run } = setup();
    await run(loanOrigination(ref, "loan-pa10-open", "1000.00"));
    await run(advancePayment(ref, "adv-pa10-open", "500.00"));
    const settledAdv = await run(advancePayment(ref, "adv-pa10-settled", "300.00"));
    await run(advanceSettlement(ref, "adv-pa10-settled", settledAdv.id.value, Relation.SETTLES, EconomicEffect.CASH_IN, "300.00", ReasonType.ADVANCE_PAYMENT));

    const result = await makeService(ledgerRepo).summarizePaginated({ status: "open", objectType: ObjectType.ADVANCE });
    const ids = result.data.map((p) => p.objectId);

    expect(result.total).toBe(1);
    expect(ids).toContain("adv-pa10-open");
    expect(ids).not.toContain("loan-pa10-open");
    expect(ids).not.toContain("adv-pa10-settled");
  });

  it("PA11 — overSettlement is detected when ADJUSTS + SETTLES exceed totalOriginated", async () => {
    const { ledgerRepo, run } = setup();
    const adv = await run(advancePayment(ref, "adv-pa11", "1000.00"));
    // NON_CASH + ADJUSTS bypasses the over-settlement guard (guard only sums SETTLES events)
    // NON_CASH is required: ECONOMIC_EFFECT_RELATION_MATRIX[CASH_IN] does not include ADJUSTS
    await run(advanceSettlement(ref, "adv-pa11", adv.id.value, Relation.ADJUSTS, EconomicEffect.NON_CASH, "800.00", ReasonType.ADVANCE_PAYMENT));
    await run(advanceSettlement(ref, "adv-pa11", adv.id.value, Relation.SETTLES, EconomicEffect.CASH_IN, "500.00", ReasonType.ADVANCE_PAYMENT));

    const result = await makeService(ledgerRepo).summarizePaginated({});
    const pos = result.data.find((p) => p.objectId === "adv-pa11")!;

    // totalClosed = 800 (adjusts) + 500 (settles) = 1300 > 1000 (originated)
    expect(pos.overSettlement.toString()).toBe("300.00");
    expect(pos.openBalance.toString()).toBe("0.00");
    expect(pos.totalAdjusted.toString()).toBe("800.00");
    expect(pos.totalSettled.toString()).toBe("500.00");
  });

  it("PA12 — pagination is correctly applied: 4 positions, page=1 and page=2 cover all with no duplicates", async () => {
    const { ledgerRepo, run } = setup();
    await run(loanOrigination(ref, "loan-pa12-1", "100.00"));
    await run(loanOrigination(ref, "loan-pa12-2", "200.00"));
    await run(loanOrigination(ref, "loan-pa12-3", "300.00"));
    await run(loanOrigination(ref, "loan-pa12-4", "400.00"));

    const svc = makeService(ledgerRepo);
    const page1 = await svc.summarizePaginated({ page: 1, limit: 2 });
    const page2 = await svc.summarizePaginated({ page: 2, limit: 2 });

    expect(page1.total).toBe(4);
    expect(page1.totalPages).toBe(2);
    expect(page1.data).toHaveLength(2);
    expect(page2.data).toHaveLength(2);

    const allIds = [...page1.data, ...page2.data].map((p) => p.objectId);
    expect(new Set(allIds).size).toBe(4);
  });
});
