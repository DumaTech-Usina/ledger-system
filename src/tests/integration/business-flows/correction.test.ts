import { describe, expect, it } from "vitest";
import { assertChain, lifecycleOf } from "./helpers/assertions";
import { makeRef } from "./helpers/ref";
import { setup } from "./helpers/setup";
import { commissionReceived } from "./helpers/commands/commission-commands";
import { ledgerCorrection } from "./helpers/commands/correction-commands";
import { EconomicEffect } from "../../../core/domain/enums/EconomicEffect";
import { EventType } from "../../../core/domain/enums/EventType";
import { ObjectType } from "../../../core/domain/enums/ObjectType";
import { ReasonType } from "../../../core/domain/enums/ReasonType";
import { Relation } from "../../../core/domain/enums/Relation";

const ref = makeRef();

describe("Ledger corrections", () => {
  it("S11 — correction reverses a wrong event, chain remains valid", async () => {
    const { ledgerRepo, run } = setup();

    const wrong = await run(commissionReceived(ref, "com-recv-s11"));
    const correction = await run(
      ledgerCorrection(ref, "com-recv-s11", ObjectType.COMMISSION_RECEIVABLE, Relation.REVERSES, ReasonType.MANUAL_CORRECTION),
    );

    await assertChain(ledgerRepo);

    expect(correction.previousHash?.value).toBe(wrong.hash.value);
    expect(correction.economicEffect).toBe(EconomicEffect.NON_CASH);

    expect(await lifecycleOf(ledgerRepo, "com-recv-s11")).toEqual([
      EventType.COMMISSION_RECEIVED,
      EventType.LEDGER_CORRECTION,
    ]);
  });

  it("S11b — partial correction adjusts without fully reversing the original", async () => {
    const { ledgerRepo, run } = setup();

    await run(commissionReceived(ref, "com-recv-s11b"));
    const correction = await run(
      ledgerCorrection(ref, "com-recv-s11b", ObjectType.COMMISSION_RECEIVABLE, Relation.ADJUSTS, ReasonType.DATA_RECONCILIATION),
    );

    expect(correction.getReason()?.type).toBe(ReasonType.DATA_RECONCILIATION);
    expect(await lifecycleOf(ledgerRepo, "com-recv-s11b")).toHaveLength(2);
    await assertChain(ledgerRepo);
  });
});
