import { describe, expect, it } from "vitest";
import { assertChain, lifecycleOf } from "./helpers/assertions";
import { makeRef } from "./helpers/ref";
import { setup } from "./helpers/setup";
import { advancePayment, advanceSettlement } from "./helpers/commands/advance-commands";
import { EconomicEffect } from "../../../core/domain/enums/EconomicEffect";
import { EventType } from "../../../core/domain/enums/EventType";
import { ReasonType } from "../../../core/domain/enums/ReasonType";
import { Relation } from "../../../core/domain/enums/Relation";

const ref = makeRef();

describe("Advance payment lifecycles", () => {
  it("S4 — full recovery: advance disbursed and fully repaid in cash", async () => {
    const { ledgerRepo, run } = setup();

    const adv = await run(advancePayment(ref, "adv-s4", "500.00"));
    const settlement = await run(
      advanceSettlement(ref, "adv-s4", adv.id.value, Relation.SETTLES, EconomicEffect.CASH_IN, "500.00", ReasonType.ADVANCE_PAYMENT),
    );

    await assertChain(ledgerRepo);

    expect(settlement.relatedEventId).toBe(adv.id.value);
    expect(await lifecycleOf(ledgerRepo, "adv-s4")).toEqual([
      EventType.ADVANCE_PAYMENT,
      EventType.ADVANCE_SETTLEMENT,
    ]);

    const caused = await ledgerRepo.findByRelatedEventId(adv.id.value);
    expect(caused).toHaveLength(1);
    expect(caused[0].id.value).toBe(settlement.id.value);

    expect(adv.amount.toString()).toBe("500.00");
    expect(settlement.amount.toString()).toBe("500.00");
  });

  it("S5 — partial recovery + loss: partial cash returned, remainder recognised as loss", async () => {
    const { ledgerRepo, run } = setup();

    const adv = await run(advancePayment(ref, "adv-s5", "500.00"));

    const partial = await run(
      advanceSettlement(ref, "adv-s5", adv.id.value, Relation.SETTLES, EconomicEffect.CASH_IN, "300.00", ReasonType.ADVANCE_PAYMENT),
    );
    const loss = await run(
      advanceSettlement(ref, "adv-s5", adv.id.value, Relation.SETTLES, EconomicEffect.NON_CASH, "200.00", ReasonType.LOSS_RECOGNITION),
    );

    await assertChain(ledgerRepo);

    expect(await lifecycleOf(ledgerRepo, "adv-s5")).toEqual([
      EventType.ADVANCE_PAYMENT,
      EventType.ADVANCE_SETTLEMENT,
      EventType.ADVANCE_SETTLEMENT,
    ]);

    expect(await ledgerRepo.findByRelatedEventId(adv.id.value)).toHaveLength(2);

    expect(partial.economicEffect).toBe(EconomicEffect.CASH_IN);
    expect(loss.economicEffect).toBe(EconomicEffect.NON_CASH);
    expect(loss.getReason()?.type).toBe(ReasonType.LOSS_RECOGNITION);
  });

  it("S6 — renegotiation: advance terms restructured, obligation deferred", async () => {
    const { ledgerRepo, run } = setup();

    const adv = await run(advancePayment(ref, "adv-s6", "500.00"));
    const restructured = await run(
      advanceSettlement(ref, "adv-s6", adv.id.value, Relation.ADJUSTS, EconomicEffect.NON_CASH, "500.00", ReasonType.DEBT_RESTRUCTURING),
    );

    await assertChain(ledgerRepo);

    expect(restructured.economicEffect).toBe(EconomicEffect.NON_CASH);
    expect(restructured.getReason()?.type).toBe(ReasonType.DEBT_RESTRUCTURING);
    expect(restructured.relatedEventId).toBe(adv.id.value);

    expect(await lifecycleOf(ledgerRepo, "adv-s6")).toEqual([
      EventType.ADVANCE_PAYMENT,
      EventType.ADVANCE_SETTLEMENT,
    ]);
  });
});
