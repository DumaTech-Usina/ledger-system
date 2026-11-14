import { describe, it, expect } from "vitest";
import { setup } from "./helpers/setup";
import { makeRef } from "./helpers/ref";
import { commissionExpected, commissionReceived, commissionSplit } from "./helpers/commands/commission-commands";
import { obligationRecognized, payrollPayment } from "./helpers/commands/obligation-commands";
import { USINA } from "./helpers/parties";
import { PositionProjectionService } from "../../../core/application/services/PositionProjectionService";
import { Direction } from "../../../core/domain/enums/Direction";
import { EconomicEffect } from "../../../core/domain/enums/EconomicEffect";
import { ObjectType } from "../../../core/domain/enums/ObjectType";
import { PartyRole } from "../../../core/domain/enums/PartyRole";
import { Relation } from "../../../core/domain/enums/Relation";

/**
 * REQ-650 (DEC-044): the institution the money moved in is an observed fact, cited by the cash event as
 * a context — exactly as a settlement batch is. Nothing about the event's shape or its arithmetic
 * changes; an event that cites none is of an unknown institution, never one assigned by assumption.
 */

const ref = makeRef();
const itau = { objectId: "instituicao:itau", objectType: ObjectType.CASH_ACCOUNT, relation: Relation.REFERENCES };
const bradesco = { objectId: "instituicao:bradesco", objectType: ObjectType.CASH_ACCOUNT, relation: Relation.REFERENCES };

describe("the institution on a cash fact (REQ-650)", () => {
  it("CA-650 — a payment cites the institution, and settles its obligation exactly as before", async () => {
    const { run, ledgerRepo } = setup();
    await run(obligationRecognized(ref, "payroll:inst-1", "500.00"));
    const paid = await run({
      ...payrollPayment(ref, "payroll:inst-1", "500.00"),
      objects: [{ objectId: "payroll:inst-1", objectType: ObjectType.PAYROLL, relation: Relation.SETTLES }, itau],
    });

    expect(paid.getObjects().map((o) => [o.objectId.value, o.objectType, o.relation])).toContainEqual([
      "instituicao:itau",
      ObjectType.CASH_ACCOUNT,
      Relation.REFERENCES,
    ]);
    const position = (await new PositionProjectionService(ledgerRepo).summarize("payroll:inst-1"))!;
    expect(position.openBalance?.toString()).toBe("0.00");
    const flows = await ledgerRepo.aggregateCashFlows();
    expect(flows.cashOutUnits).toBe(50000n);
  });

  it("a receipt cites the institution the money came into", async () => {
    const { run } = setup();
    const expected = await run(commissionExpected(ref, "recv:inst-2", "1000.00"));
    const received = await run({
      ...commissionReceived(ref, "recv:inst-2", expected.id.value, "1000.00"),
      objects: [{ objectId: "recv:inst-2", objectType: ObjectType.COMMISSION_RECEIVABLE, relation: Relation.SETTLES }, bradesco],
    });
    expect(received.getObjects().some((o) => o.objectType === ObjectType.CASH_ACCOUNT)).toBe(true);
  });

  it("CA-650b — a payment that cites no institution is still recorded: the institution is unknown, not refused", async () => {
    const { run } = setup();
    const paid = await run(payrollPayment(ref, "payroll:inst-3", "80.00"));
    expect(paid.getObjects().some((o) => o.objectType === ObjectType.CASH_ACCOUNT)).toBe(false);
  });

  it("REJ-650b — money leaves one institution: a cash fact citing two is refused", async () => {
    const { run } = setup();
    await expect(
      run({
        ...payrollPayment(ref, "payroll:inst-4", "80.00"),
        objects: [{ objectId: "payroll:inst-4", objectType: ObjectType.PAYROLL, relation: Relation.SETTLES }, itau, bradesco],
      }),
    ).rejects.toThrow("at most one institution");
  });

  it("REJ-650b — a fact without money cites no institution", async () => {
    const { run } = setup();
    await expect(
      run({
        ...obligationRecognized(ref, "payroll:inst-5", "80.00"),
        objects: [{ objectId: "payroll:inst-5", objectType: ObjectType.PAYROLL, relation: Relation.ORIGINATES }, itau],
      }),
    ).rejects.toThrow("only by a fact that moves money");
  });

  it("an internal transfer cannot cite an institution yet: it needs an origin and a destination (E6)", async () => {
    const { run } = setup();
    await expect(
      run({
        ...commissionSplit(ref, "pool:inst-6"),
        economicEffect: EconomicEffect.CASH_INTERNAL,
        amount: "100.00",
        parties: [
          { partyId: USINA, role: PartyRole.PAYER, direction: Direction.OUT, amount: "100.00" },
          { partyId: "usina-pool", role: PartyRole.PAYEE, direction: Direction.IN, amount: "100.00" },
        ],
        objects: [{ objectId: "pool:inst-6", objectType: ObjectType.COMMISSION_POOL, relation: Relation.ADJUSTS }, itau],
      }),
    ).rejects.toThrow("only by a fact that moves money");
  });

  it("the institution is a context: it must be referenced, never moved", async () => {
    const { run } = setup();
    await expect(
      run({
        ...payrollPayment(ref, "payroll:inst-7", "80.00"),
        objects: [
          { objectId: "payroll:inst-7", objectType: ObjectType.PAYROLL, relation: Relation.SETTLES },
          { ...itau, relation: Relation.SETTLES },
        ],
      }),
    ).rejects.toThrow();
  });
});
