import { describe, expect, it } from "vitest";
import { PositionProjectionService } from "../../../core/application/services/PositionProjectionService";
import { EconomicEffect } from "../../../core/domain/enums/EconomicEffect";
import { ObjectType } from "../../../core/domain/enums/ObjectType";
import { ReasonType } from "../../../core/domain/enums/ReasonType";
import { Relation } from "../../../core/domain/enums/Relation";
import { advancePayment, advanceSettlement } from "../../integration/business-flows/helpers/commands/advance-commands";
import { ledgerCorrection } from "../../integration/business-flows/helpers/commands/correction-commands";
import { loanOrigination, loanRepayment } from "../../integration/business-flows/helpers/commands/loan-commands";
import { obligationRecognized, payrollPayment, retractPayroll } from "../../integration/business-flows/helpers/commands/obligation-commands";
import { BROKER, SUPPLIER, TAX_AUTH, USINA } from "../../integration/business-flows/helpers/parties";
import { Direction } from "../../../core/domain/enums/Direction";
import { PartyRole } from "../../../core/domain/enums/PartyRole";
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
    // The settlement comes first and is within the baseline, so the conservation guard admits it.
    await run(advanceSettlement(ref, "adv-u11", adv.id.value, Relation.SETTLES, EconomicEffect.CASH_IN, "500.00", ReasonType.ADVANCE_PAYMENT));
    // The ADJUSTS is what carries the position past its baseline. The guard triggers on SETTLES
    // only — an adjustment is how a debt is restructured or a loss recognized, and refusing one for
    // exceeding the original amount would refuse the very facts that relation exists to record.
    // NON_CASH is required: ECONOMIC_EFFECT_RELATION_MATRIX[CASH_IN] does not include ADJUSTS.
    await run(advanceSettlement(ref, "adv-u11", adv.id.value, Relation.ADJUSTS, EconomicEffect.NON_CASH, "800.00", ReasonType.ADVANCE_PAYMENT));

    const result = await svc(ledgerRepo).summarizePaginated({ objectType: ObjectType.ADVANCE });
    const pos = result.data.find((p) => p.objectId === "adv-u11")!;

    expect(pos.overSettlement!.toString()).toBe("300.00");
    expect(pos.openBalance!.toString()).toBe("0.00");
  });

  it("U12 — openBalance is zero when position is fully settled", async () => {
    const { ledgerRepo, run } = setup();
    const loan = await run(loanOrigination(ref, "loan-u12", "1000.00"));
    await run(loanRepayment(ref, "loan-u12", loan.id.value, EconomicEffect.CASH_IN, Relation.SETTLES, ReasonType.LOAN_REPAYMENT, "1000.00"));

    const result = await svc(ledgerRepo).summarizePaginated({});
    const pos = result.data.find((p) => p.objectId === "loan-u12")!;

    expect(pos.openBalance!.toString()).toBe("0.00");
    expect(pos.status).toBe("fully_settled");
  });

  // `recordedAt` is stamped with `new Date()` at creation, so positions minted inside the same
  // millisecond are genuinely tied. The pause buys distinct recording times, which is what these
  // two tests are about — the tiebreaker is exercised by neither.
  const tick = () => new Promise((resolve) => setTimeout(resolve, 2));

  it("U13 — the listing comes back newest-created first", async () => {
    const { ledgerRepo, run } = setup();
    await run(loanOrigination(ref, "loan-u13-first", "100.00"));
    await tick();
    await run(loanOrigination(ref, "loan-u13-second", "100.00"));
    await tick();
    await run(loanOrigination(ref, "loan-u13-third", "100.00"));

    const result = await svc(ledgerRepo).summarizePaginated({});

    expect(result.data.map((p) => p.objectId)).toEqual([
      "loan-u13-third",
      "loan-u13-second",
      "loan-u13-first",
    ]);
  });

  it("U14 — a new event on an old position does not move it to the top: creation is not last activity", async () => {
    const { ledgerRepo, run } = setup();
    const old = await run(loanOrigination(ref, "loan-u14-old", "1000.00"));
    await tick();
    await run(loanOrigination(ref, "loan-u14-new", "100.00"));
    await tick();
    // The oldest position gets the most recent event. Under the previous `last_event_at` ordering
    // this alone put it first; under creation ordering it stays where it entered the book.
    await run(
      loanRepayment(ref, "loan-u14-old", old.id.value, EconomicEffect.CASH_IN, Relation.SETTLES, ReasonType.LOAN_REPAYMENT, "400.00"),
    );

    const result = await svc(ledgerRepo).summarizePaginated({});

    expect(result.data.map((p) => p.objectId)).toEqual(["loan-u14-new", "loan-u14-old"]);
  });

  it("U15 — several objectTypes are read as OR, not as an impossible AND", async () => {
    const { ledgerRepo, run } = setup();
    await run(loanOrigination(ref, "loan-u15", "1000.00"));
    await run(advancePayment(ref, "adv-u15", "500.00"));

    const result = await svc(ledgerRepo).summarizePaginated({
      objectType: [ObjectType.LOAN, ObjectType.ADVANCE],
    });
    const ids = result.data.map((p) => p.objectId);

    expect(ids).toContain("loan-u15");
    expect(ids).toContain("adv-u15");
  });

  it("U16 — several statuses are read as OR; a status outside the selection stays out", async () => {
    const { ledgerRepo, run } = setup();
    await run(loanOrigination(ref, "loan-u16-open", "1000.00"));
    const settled = await run(loanOrigination(ref, "loan-u16-settled", "500.00"));
    await run(loanRepayment(ref, "loan-u16-settled", settled.id.value, EconomicEffect.CASH_IN, Relation.SETTLES, ReasonType.LOAN_REPAYMENT, "500.00"));
    const partial = await run(loanOrigination(ref, "loan-u16-partial", "800.00"));
    await run(loanRepayment(ref, "loan-u16-partial", partial.id.value, EconomicEffect.CASH_IN, Relation.SETTLES, ReasonType.LOAN_REPAYMENT, "300.00"));

    const result = await svc(ledgerRepo).summarizePaginated({ status: ["open", "fully_settled"] });
    const ids = result.data.map((p) => p.objectId);

    expect(ids).toContain("loan-u16-open");
    expect(ids).toContain("loan-u16-settled");
    expect(ids).not.toContain("loan-u16-partial");
  });

  it("U17 — a one-element selection answers exactly what the single value answered", async () => {
    const { ledgerRepo, run } = setup();
    await run(loanOrigination(ref, "loan-u17", "1000.00"));
    await run(advancePayment(ref, "adv-u17", "500.00"));

    const single = await svc(ledgerRepo).summarizePaginated({ objectType: ObjectType.LOAN });
    const asList = await svc(ledgerRepo).summarizePaginated({ objectType: [ObjectType.LOAN] });

    expect(asList.data.map((p) => p.objectId)).toEqual(single.data.map((p) => p.objectId));
  });

  it("U18 — a period around now returns the book; a period ahead of it returns nothing", async () => {
    const { ledgerRepo, run } = setup();
    await run(loanOrigination(ref, "loan-u18", "1000.00"));

    const hour = 60 * 60 * 1000;
    const around = await svc(ledgerRepo).summarizePaginated({
      from: new Date(Date.now() - hour),
      to: new Date(Date.now() + hour),
    });
    const ahead = await svc(ledgerRepo).summarizePaginated({ from: new Date(Date.now() + hour) });

    expect(around.data.map((p) => p.objectId)).toContain("loan-u18");
    expect(ahead.total).toBe(0);
  });

  it("U20 — a party is matched by INVOLVEMENT: the one who paid counts as much as the one owed", async () => {
    const { ledgerRepo, run } = setup();
    // Recognized against the supplier, paid by someone else entirely — a third party settling for
    // the debtor. Both took part in this position's life.
    await run(obligationRecognized(ref, "payroll-u20", "1000.00"));
    await run(
      payrollPayment(ref, "payroll-u20", "400.00", {
        parties: [
          { partyId: USINA, role: PartyRole.PAYER, direction: Direction.OUT, amount: "400.00" },
          { partyId: TAX_AUTH, role: PartyRole.PAYEE, direction: Direction.NEUTRAL, amount: "400.00" },
        ],
      }),
    );
    await run(loanOrigination(ref, "loan-u20", "500.00"));

    const bySupplier = await svc(ledgerRepo).summarizePaginated({ partyId: SUPPLIER });
    const byPayer = await svc(ledgerRepo).summarizePaginated({ partyId: TAX_AUTH });
    const byStranger = await svc(ledgerRepo).summarizePaginated({ partyId: "nobody-here" });

    // The party of the origination finds it…
    expect(bySupplier.data.map((p) => p.objectId)).toEqual(["payroll-u20"]);
    // …and so does the party of the settlement, which is the whole point: involvement, not
    // protagonism. A listing that only answered for the origination would hide the position from
    // the party that actually moved the money.
    expect(byPayer.data.map((p) => p.objectId)).toEqual(["payroll-u20"]);
    expect(byStranger.total).toBe(0);
  });

  it("U21 — several parties are read as OR, and the whole position comes back either way", async () => {
    const { ledgerRepo, run } = setup();
    await run(obligationRecognized(ref, "payroll-u21", "1000.00"));
    await run(loanOrigination(ref, "loan-u21", "500.00"));

    const result = await svc(ledgerRepo).summarizePaginated({ partyId: [SUPPLIER, BROKER] });

    expect(result.data.map((p) => p.objectId).sort()).toEqual(["loan-u21", "payroll-u21"]);
  });

  it("U22 — a party that appears only on a retracted event is not involved in anything standing", async () => {
    const { ledgerRepo, run } = setup();
    await run(obligationRecognized(ref, "payroll-u22", "1000.00"));
    const payment = await run(
      payrollPayment(ref, "payroll-u22", "400.00", {
        parties: [
          { partyId: USINA, role: PartyRole.PAYER, direction: Direction.OUT, amount: "400.00" },
          { partyId: TAX_AUTH, role: PartyRole.PAYEE, direction: Direction.NEUTRAL, amount: "400.00" },
        ],
      }),
    );
    await run(retractPayroll(ref, "payroll-u22", payment.id.value, "400.00"));

    const byPayer = await svc(ledgerRepo).summarizePaginated({ partyId: TAX_AUTH });
    const bySupplier = await svc(ledgerRepo).summarizePaginated({ partyId: SUPPLIER });

    // The payment never happened, so the party that only ever appeared on it took part in nothing
    // that still stands. The origination is untouched, so the supplier still finds the position.
    expect(byPayer.total).toBe(0);
    expect(bySupplier.data.map((p) => p.objectId)).toEqual(["payroll-u22"]);
  });

  it("U23 — the listing publishes everyone involved, deduplicated, including our own side", async () => {
    const { ledgerRepo, run } = setup();
    await run(obligationRecognized(ref, "payroll-u23", "1000.00"));
    await run(payrollPayment(ref, "payroll-u23", "400.00"));

    const result = await svc(ledgerRepo).summarizePaginated({ objectType: ObjectType.PAYROLL });
    const position = result.data.find((p) => p.objectId === "payroll-u23")!;

    // The usina is in the list: the ledger does not know which side is "us" and publishes what it
    // recorded. Whoever reads it may know, and may hide it — that is the reader's knowledge, not
    // the book's. USINA appears on both events and is named once.
    expect([...position.parties!].sort()).toEqual([SUPPLIER, USINA].sort());
  });

  it("U19 — the period is over creation, so a position stays in a window its later events left", async () => {
    const { ledgerRepo, run } = setup();
    const loan = await run(loanOrigination(ref, "loan-u19", "1000.00"));
    // The settlement OCCURRED years earlier than the position was recorded. A period over occurrence
    // or last activity would move the position out of the window; the axis is when it entered the
    // book, which no later fact can rewrite.
    await run(loanRepayment(ref, "loan-u19", loan.id.value, EconomicEffect.CASH_IN, Relation.SETTLES, ReasonType.LOAN_REPAYMENT, "400.00"));

    const hour = 60 * 60 * 1000;
    const result = await svc(ledgerRepo).summarizePaginated({
      from: new Date(Date.now() - hour),
      to: new Date(Date.now() + hour),
    });

    expect(result.data.map((p) => p.objectId)).toContain("loan-u19");
  });
});
