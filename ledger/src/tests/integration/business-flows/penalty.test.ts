import { describe, expect, it } from "vitest";
import { lifecycleOf } from "./helpers/assertions";
import { USINA, reporter } from "./helpers/parties";
import { makeRef } from "./helpers/ref";
import { setup } from "./helpers/setup";
import { ConfidenceLevel } from "../../../core/domain/enums/ConfidenceLevel";
import { Direction } from "../../../core/domain/enums/Direction";
import { EconomicEffect } from "../../../core/domain/enums/EconomicEffect";
import { EventType } from "../../../core/domain/enums/EventType";
import { ObjectType } from "../../../core/domain/enums/ObjectType";
import { PartyRole } from "../../../core/domain/enums/PartyRole";
import { ReasonType } from "../../../core/domain/enums/ReasonType";
import { Relation } from "../../../core/domain/enums/Relation";

const ref = makeRef();

describe("Penalties", () => {
  it("S10 — penalty payment: Usina pays a penalty imposed by the operator", async () => {
    const { ledgerRepo, run } = setup();

    const penalty = await run({
      eventType: EventType.PENALTY_PAYMENT,
      economicEffect: EconomicEffect.CASH_OUT,
      occurredAt: new Date("2025-04-05"),
      amount: "3000.00",
      currency: "BRL",
      sourceSystem: "normalizer",
      sourceReference: ref("penalty"),
      normalizationVersion: "1.0",
      normalizationWorkerId: "worker-test",
      parties: [
        { partyId: USINA, role: PartyRole.PAYER, direction: Direction.OUT, amount: "3000.00" },
      ],
      objects: [{ objectId: "penalty-apr-2025", objectType: ObjectType.PENALTY, relation: Relation.SETTLES }],
      reason: {
        type: ReasonType.PENALTY_PAYMENT,
        description: "late delivery penalty",
        confidence: ConfidenceLevel.MEDIUM,
        requiresFollowup: false,
      },
      reporter: reporter(),
    });

    expect(penalty.eventType).toBe(EventType.PENALTY_PAYMENT);
    expect(penalty.economicEffect).toBe(EconomicEffect.CASH_OUT);
    expect(penalty.amount.toString()).toBe("3000.00");
    expect(await lifecycleOf(ledgerRepo, "penalty-apr-2025")).toEqual([EventType.PENALTY_PAYMENT]);
  });
});
