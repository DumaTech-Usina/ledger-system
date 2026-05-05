import { describe, expect, it } from "vitest";
import { PositionProjectionService } from "../../../core/application/services/PositionProjectionService";
import { EconomicEffect } from "../../../core/domain/enums/EconomicEffect";
import { ObjectType } from "../../../core/domain/enums/ObjectType";
import { ReasonType } from "../../../core/domain/enums/ReasonType";
import { Relation } from "../../../core/domain/enums/Relation";
import { advancePayment, advanceSettlement } from "../../integration/business-flows/helpers/commands/advance-commands";
import { ledgerCorrection } from "../../integration/business-flows/helpers/commands/correction-commands";
import { loanOrigination, loanRepayment } from "../../integration/business-flows/helpers/commands/loan-commands";
import { makeRef } from "../../integration/business-flows/helpers/ref";
import { setup } from "../../integration/business-flows/helpers/setup";

const ref = makeRef();

function svc(ledgerRepo: ReturnType<typeof setup>["ledgerRepo"]) {
  return new PositionProjectionService(ledgerRepo);
}

describe("PositionProjectionService.summarizePaginated()", () => {
  it("U1 — empty ledger returns empty page", async () => {
    const { ledgerRepo } = setup();
    const result = await svc(ledgerRepo).summarizePaginated({});

    expect(result.data).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(1);
  });

  it("U2 — page=1 limit=2 of 5 positions: 2 items, correct meta", async () => {
    const { ledgerRepo, run } = setup();
    for (let i = 1; i <= 5; i++) {
      await run(loanOrigination(ref, `loan-u2-${i}`, "100.00"));
    }

    const result = await svc(ledgerRepo).summarizePaginated({ page: 1, limit: 2 });

    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(5);
    expect(result.totalPages).toBe(3);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(2);
  });

  it("U3 — page=3 limit=2 of 5 returns the single remaining item", async () => {
    const { ledgerRepo, run } = setup();
    for (let i = 1; i <= 5; i++) {
      await run(loanOrigination(ref, `loan-u3-${i}`, "100.00"));
    }

    const result = await svc(ledgerRepo).summarizePaginated({ page: 3, limit: 2 });

    expect(result.data).toHaveLength(1);
    expect(result.page).toBe(3);
  });

  it("U4 — status=open excludes fully settled positions", async () => {
    const { ledgerRepo, run } = setup();
    await run(loanOrigination(ref, "loan-u4-open", "1000.00"));
    const settled = await run(loanOrigination(ref, "loan-u4-settled", "500.00"));
    await run(loanRepayment(ref, "loan-u4-settled", settled.id.value, EconomicEffect.CASH_IN, Relation.SETTLES, ReasonType.LOAN_REPAYMENT, "500.00"));

    const result = await svc(ledgerRepo).summarizePaginated({ status: "open" });
    const ids = result.data.map((p) => p.objectId);

    expect(ids).toContain("loan-u4-open");
    expect(ids).not.toContain("loan-u4-settled");
  });

  it("U5 — status=fully_settled excludes open positions", async () => {
    const { ledgerRepo, run } = setup();
    await run(loanOrigination(ref, "loan-u5-open", "1000.00"));
    const settled = await run(loanOrigination(ref, "loan-u5-settled", "500.00"));
    await run(loanRepayment(ref, "loan-u5-settled", settled.id.value, EconomicEffect.CASH_IN, Relation.SETTLES, ReasonType.LOAN_REPAYMENT, "500.00"));

    const result = await svc(ledgerRepo).summarizePaginated({ status: "fully_settled" });
    const ids = result.data.map((p) => p.objectId);

    expect(ids).toContain("loan-u5-settled");
    expect(ids).not.toContain("loan-u5-open");
  });

  it("U6 — status=partially_settled returns only partial settlements", async () => {
    const { ledgerRepo, run } = setup();
    await run(loanOrigination(ref, "loan-u6-open", "1000.00"));
    const partial = await run(loanOrigination(ref, "loan-u6-partial", "1000.00"));
    await run(loanRepayment(ref, "loan-u6-partial", partial.id.value, EconomicEffect.CASH_IN, Relation.SETTLES, ReasonType.LOAN_REPAYMENT, "400.00"));

    const result = await svc(ledgerRepo).summarizePaginated({ status: "partially_settled" });
    const ids = result.data.map((p) => p.objectId);

    expect(ids).toContain("loan-u6-partial");
    expect(ids).not.toContain("loan-u6-open");
  });

  it("U7 — status=reversed returns only reversed positions", async () => {
    const { ledgerRepo, run } = setup();
    await run(loanOrigination(ref, "loan-u7-open", "1000.00"));
    await run(loanOrigination(ref, "loan-u7-to-reverse", "500.00"));
    await run(ledgerCorrection(ref, "loan-u7-to-reverse", ObjectType.LOAN, Relation.REVERSES, ReasonType.MANUAL_CORRECTION));

    const result = await svc(ledgerRepo).summarizePaginated({ status: "reversed" });
    const ids = result.data.map((p) => p.objectId);

    expect(ids).toContain("loan-u7-to-reverse");
    expect(ids).not.toContain("loan-u7-open");
  });

  it("U8 — objectType=loan excludes advances", async () => {
    const { ledgerRepo, run } = setup();
    await run(loanOrigination(ref, "loan-u8", "1000.00"));
    await run(advancePayment(ref, "adv-u8", "500.00"));

    const result = await svc(ledgerRepo).summarizePaginated({ objectType: ObjectType.LOAN });
    const ids = result.data.map((p) => p.objectId);

    expect(ids).toContain("loan-u8");
    expect(ids).not.toContain("adv-u8");
  });

  it("U9 — status=open and objectType=advance returns only open advances", async () => {
    const { ledgerRepo, run } = setup();
    await run(loanOrigination(ref, "loan-u9-open", "1000.00"));
    await run(advancePayment(ref, "adv-u9-open", "500.00"));
    const settledAdv = await run(advancePayment(ref, "adv-u9-settled", "300.00"));
    await run(advanceSettlement(ref, "adv-u9-settled", settledAdv.id.value, Relation.SETTLES, EconomicEffect.CASH_IN, "300.00", ReasonType.ADVANCE_PAYMENT));

    const result = await svc(ledgerRepo).summarizePaginated({ status: "open", objectType: ObjectType.ADVANCE });
    const ids = result.data.map((p) => p.objectId);

    expect(result.total).toBe(1);
    expect(ids).toContain("adv-u9-open");
    expect(ids).not.toContain("loan-u9-open");
    expect(ids).not.toContain("adv-u9-settled");
  });

  it("U10 — no filters returns all positions", async () => {
    const { ledgerRepo, run } = setup();
    await run(loanOrigination(ref, "loan-u10", "1000.00"));
    await run(advancePayment(ref, "adv-u10", "500.00"));

    const result = await svc(ledgerRepo).summarizePaginated({});

    expect(result.total).toBe(2);
  });

  it("U11 — overSettlement is non-zero when totalClosed exceeds totalOriginated", async () => {
    const { ledgerRepo, run } = setup();
    const adv = await run(advancePayment(ref, "adv-u11", "1000.00"));
    // NON_CASH + ADJUSTS bypasses the over-settlement guard (guard only sums SETTLES events)
    // NON_CASH is required: ECONOMIC_EFFECT_RELATION_MATRIX[CASH_IN] does not include ADJUSTS
    await run(advanceSettlement(ref, "adv-u11", adv.id.value, Relation.ADJUSTS, EconomicEffect.NON_CASH, "800.00", ReasonType.ADVANCE_PAYMENT));
    await run(advanceSettlement(ref, "adv-u11", adv.id.value, Relation.SETTLES, EconomicEffect.CASH_IN, "500.00", ReasonType.ADVANCE_PAYMENT));

    const result = await svc(ledgerRepo).summarizePaginated({ objectType: ObjectType.ADVANCE });
    const pos = result.data.find((p) => p.objectId === "adv-u11")!;

    expect(pos.overSettlement.toString()).toBe("300.00");
    expect(pos.openBalance.toString()).toBe("0.00");
  });

  it("U12 — openBalance is zero when position is fully settled", async () => {
    const { ledgerRepo, run } = setup();
    const loan = await run(loanOrigination(ref, "loan-u12", "1000.00"));
    await run(loanRepayment(ref, "loan-u12", loan.id.value, EconomicEffect.CASH_IN, Relation.SETTLES, ReasonType.LOAN_REPAYMENT, "1000.00"));

    const result = await svc(ledgerRepo).summarizePaginated({});
    const pos = result.data.find((p) => p.objectId === "loan-u12")!;

    expect(pos.openBalance.toString()).toBe("0.00");
    expect(pos.status).toBe("fully_settled");
  });
});
