import { describe, expect, it } from "vitest";
import { assertChain, lifecycleOf } from "./helpers/assertions";
import { BROKER, reporter } from "./helpers/parties";
import { makeRef } from "./helpers/ref";
import { setup } from "./helpers/setup";
import { commissionReceived, directPaymentAcknowledged } from "./helpers/commands/commission-commands";
import { commissionSplit } from "./helpers/commands/commission-commands";
import { advancePayment, advanceSettlement } from "./helpers/commands/advance-commands";
import { ledgerCorrection } from "./helpers/commands/correction-commands";
import { ConfidenceLevel } from "../../../core/domain/enums/ConfidenceLevel";
import { Direction } from "../../../core/domain/enums/Direction";
import { EconomicEffect } from "../../../core/domain/enums/EconomicEffect";
import { EventType } from "../../../core/domain/enums/EventType";
import { ObjectType } from "../../../core/domain/enums/ObjectType";
import { PartyRole } from "../../../core/domain/enums/PartyRole";
import { ReasonType } from "../../../core/domain/enums/ReasonType";
import { Relation } from "../../../core/domain/enums/Relation";

const ref = makeRef();

describe("Intersections — cross-track scenarios", () => {
  it("I1 — commission offsets advance: broker's received commission is used to settle their open advance", async () => {
    const { ledgerRepo, run } = setup();

    const adv = await run(advancePayment(ref, "adv-i1", "500.00"));
    await run(commissionReceived(ref, "com-recv-i1", "500.00"));
    const settlement = await run(
      advanceSettlement(ref, "adv-i1", adv.id.value, Relation.SETTLES, EconomicEffect.NON_CASH, "500.00", ReasonType.ADVANCE_PAYMENT),
    );

    await assertChain(ledgerRepo);
    expect(await ledgerRepo.findAll()).toHaveLength(3);

    expect(settlement.economicEffect).toBe(EconomicEffect.NON_CASH);
    expect(settlement.relatedEventId).toBe(adv.id.value);

    expect(await lifecycleOf(ledgerRepo, "adv-i1")).toEqual([
      EventType.ADVANCE_PAYMENT,
      EventType.ADVANCE_SETTLEMENT,
    ]);

    const brokerHistory = await ledgerRepo.findByPartyId(BROKER);
    expect(brokerHistory).toHaveLength(3);
  });

  it("I2 — advance linked to proposal: contextual object enables full deal traceability", async () => {
    const { ledgerRepo, run } = setup();

    const adv = await run(
      advancePayment(ref, "adv-i2", "500.00", [
        { objectId: "prop-2025-001", objectType: ObjectType.PROPOSAL, relation: Relation.REFERENCES },
      ]),
    );

    await run(
      advanceSettlement(ref, "adv-i2", adv.id.value, Relation.SETTLES, EconomicEffect.CASH_IN, "500.00", ReasonType.ADVANCE_PAYMENT),
    );

    await assertChain(ledgerRepo);

    expect(await lifecycleOf(ledgerRepo, "adv-i2")).toEqual([
      EventType.ADVANCE_PAYMENT,
      EventType.ADVANCE_SETTLEMENT,
    ]);

    const proposalEvents = await ledgerRepo.findByObjectId("prop-2025-001");
    expect(proposalEvents).toHaveLength(1);
    expect(proposalEvents[0].eventType).toBe(EventType.ADVANCE_PAYMENT);
  });

  it("I3 — multi-advance broker: two simultaneous advances have isolated lifecycles but shared party history", async () => {
    const { ledgerRepo, run } = setup();

    const advA = await run(advancePayment(ref, "adv-a-i3", "500.00"));
    const advB = await run(advancePayment(ref, "adv-b-i3", "300.00"));

    await run(
      advanceSettlement(ref, "adv-a-i3", advA.id.value, Relation.SETTLES, EconomicEffect.CASH_IN, "500.00", ReasonType.ADVANCE_PAYMENT),
    );
    await run(
      advanceSettlement(ref, "adv-b-i3", advB.id.value, Relation.ADJUSTS, EconomicEffect.NON_CASH, "300.00", ReasonType.DEBT_RESTRUCTURING),
    );

    await assertChain(ledgerRepo);

    expect(await lifecycleOf(ledgerRepo, "adv-a-i3")).toEqual([EventType.ADVANCE_PAYMENT, EventType.ADVANCE_SETTLEMENT]);
    expect(await lifecycleOf(ledgerRepo, "adv-b-i3")).toEqual([EventType.ADVANCE_PAYMENT, EventType.ADVANCE_SETTLEMENT]);

    expect(await ledgerRepo.findByRelatedEventId(advA.id.value)).toHaveLength(1);
    expect(await ledgerRepo.findByRelatedEventId(advB.id.value)).toHaveLength(1);

    const brokerHistory = await ledgerRepo.findByPartyId(BROKER);
    expect(brokerHistory).toHaveLength(4);
    expect(brokerHistory.map((e) => e.eventType)).toEqual([
      EventType.ADVANCE_PAYMENT,
      EventType.ADVANCE_PAYMENT,
      EventType.ADVANCE_SETTLEMENT,
      EventType.ADVANCE_SETTLEMENT,
    ]);
  });

  it("I4 — correction on wrong split: erroneous commission split is reversed, chain stays valid", async () => {
    const { ledgerRepo, run } = setup();

    await run(commissionReceived(ref, "com-recv-i4"));
    const wrongSplit = await run(commissionSplit(ref, "com-pay-i4"));
    const correction = await run(
      ledgerCorrection(ref, "com-pay-i4", ObjectType.COMMISSION_PAYABLE, Relation.REVERSES, ReasonType.MANUAL_CORRECTION),
    );

    await assertChain(ledgerRepo);
    expect(await ledgerRepo.findAll()).toHaveLength(3);

    expect(correction.previousHash?.value).toBe(wrongSplit.hash.value);

    expect(await lifecycleOf(ledgerRepo, "com-pay-i4")).toEqual([
      EventType.COMMISSION_SPLIT,
      EventType.LEDGER_CORRECTION,
    ]);
    expect(await lifecycleOf(ledgerRepo, "com-recv-i4")).toEqual([EventType.COMMISSION_RECEIVED]);
  });

  it("I5 — direct payment discovered after commission was already recorded: correction + acknowledgement", async () => {
    const { ledgerRepo, run } = setup();

    const wrong = await run(commissionReceived(ref, "com-recv-i5"));
    const correction = await run(
      ledgerCorrection(ref, "com-recv-i5", ObjectType.COMMISSION_RECEIVABLE, Relation.REVERSES, ReasonType.DATA_RECONCILIATION),
    );
    const ack = await run(
      directPaymentAcknowledged(
        ref,
        "com-recv-i5",
        ObjectType.COMMISSION_RECEIVABLE,
        ReasonType.DIRECT_COMMISSION_PAYMENT_AUTHORIZED,
        ConfidenceLevel.HIGH,
        "operator paid broker directly; original receipt entry was incorrect",
      ),
    );

    await assertChain(ledgerRepo);
    expect(await ledgerRepo.findAll()).toHaveLength(3);

    expect(correction.previousHash?.value).toBe(wrong.hash.value);
    expect(ack.previousHash?.value).toBe(correction.hash.value);

    expect(await lifecycleOf(ledgerRepo, "com-recv-i5")).toEqual([
      EventType.COMMISSION_RECEIVED,
      EventType.LEDGER_CORRECTION,
      EventType.DIRECT_PAYMENT_ACKNOWLEDGED,
    ]);
  });
});
