import { describe, expect, it } from "vitest";
import { assertChain, lifecycleOf } from "./helpers/assertions";
import { BROKER } from "./helpers/parties";
import { makeRef } from "./helpers/ref";
import { setup } from "./helpers/setup";
import {
  commissionExpected,
  commissionReceived,
  commissionSplit,
  commissionWaiver,
  directPaymentAcknowledged,
} from "./helpers/commands/commission-commands";
import { EconomicEffect } from "../../../core/domain/enums/EconomicEffect";
import { EventType } from "../../../core/domain/enums/EventType";
import { ObjectType } from "../../../core/domain/enums/ObjectType";
import { ReasonType } from "../../../core/domain/enums/ReasonType";
import { ConfidenceLevel } from "../../../core/domain/enums/ConfidenceLevel";

const ref = makeRef();

describe("Commission flows", () => {
  it("S1 — normal commission cycle: expected → received → split", async () => {
    const { ledgerRepo, run } = setup();

    // The expected is the commission's ignition point — it ORIGINATES the receivable
    // that the received later SETTLES. A received can never exist without it.
    const expected = await run(commissionExpected(ref, "com-recv-s1"));
    const recv  = await run(commissionReceived(ref, "com-recv-s1", expected.id.value));
    const split = await run(commissionSplit(ref, "com-pay-s1"));

    expect(await ledgerRepo.findAll()).toHaveLength(3);

    expect(recv.relatedEventId).toBe(expected.id.value);
    expect(recv.previousHash?.value).toBe(expected.hash.value);
    expect(split.previousHash?.value).toBe(recv.hash.value);
    await assertChain(ledgerRepo);

    expect(await lifecycleOf(ledgerRepo, "com-recv-s1")).toEqual([
      EventType.COMMISSION_EXPECTED,
      EventType.COMMISSION_RECEIVED,
    ]);
    expect(await lifecycleOf(ledgerRepo, "com-pay-s1")).toEqual([EventType.COMMISSION_SPLIT]);

    expect(recv.amount.toString()).toBe("1000.00");
    expect(split.amount.toString()).toBe("700.00");

    const splitParties = split.getParties();
    expect(splitParties.find((p) => p.partyId.value === BROKER)?.amount?.toString()).toBe("560.00");
  });

  it("S1b — a commission_received whose ignition point does not exist is rejected", async () => {
    const { run } = setup();

    await expect(
      run(commissionReceived(ref, "com-orphan", "evt-does-not-exist")),
    ).rejects.toThrow("Origin event not found");
  });

  it("S1c — a commission_received must point to a COMMISSION_EXPECTED, not another event type", async () => {
    const { run } = setup();

    const waiver = await run(commissionWaiver(ref, "com-ent-s1c"));

    await expect(
      run(commissionReceived(ref, "com-recv-s1c", waiver.id.value)),
    ).rejects.toThrow("must point to a commission_expected");
  });

  it("S2 — direct payment acknowledged: operator paid broker directly, Usina records the bypass", async () => {
    const { ledgerRepo, run } = setup();

    const event = await run(
      directPaymentAcknowledged(
        ref,
        "com-recv-s2",
        ObjectType.COMMISSION_RECEIVABLE,
        ReasonType.LATE_AWARENESS,
        ConfidenceLevel.LOW,
        "operator paid broker directly — discovered late",
      ),
    );

    expect(event.economicEffect).toBe(EconomicEffect.NON_CASH);
    expect(event.previousHash).toBeNull();

    expect(await lifecycleOf(ledgerRepo, "com-recv-s2")).toEqual([
      EventType.DIRECT_PAYMENT_ACKNOWLEDGED,
    ]);
  });

  it("S3 — commission waiver: Usina forgoes its receivable from broker", async () => {
    const { ledgerRepo, run } = setup();

    const event = await run(commissionWaiver(ref, "com-ent-s3"));

    expect(event.eventType).toBe(EventType.COMMISSION_WAIVER);
    expect(event.economicEffect).toBe(EconomicEffect.NON_CASH);
    expect(await lifecycleOf(ledgerRepo, "com-ent-s3")).toEqual([EventType.COMMISSION_WAIVER]);
  });
});
