import { describe, expect, it } from "vitest";
import { assertChain, lifecycleOf } from "./helpers/assertions";
import { BROKER, USINA, reporter } from "./helpers/parties";
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

describe("Operational costs", () => {
  it("S9 — payroll, infrastructure and incentive run as independent events with no cross-dependencies", async () => {
    const { ledgerRepo, run } = setup();

    const payroll = await run({
      eventType: EventType.PAYROLL_PAYMENT,
      economicEffect: EconomicEffect.CASH_OUT,
      occurredAt: new Date("2025-03-31"),
      amount: "10000.00",
      currency: "BRL",
      sourceSystem: "normalizer",
      sourceReference: ref("payroll"),
      normalizationVersion: "1.0",
      normalizationWorkerId: "worker-test",
      parties: [
        { partyId: USINA, role: PartyRole.PAYER, direction: Direction.OUT, amount: "10000.00" },
      ],
      objects: [{ objectId: "payroll-mar-2025", objectType: ObjectType.PAYROLL, relation: Relation.SETTLES }],
      reason: {
        type: ReasonType.PAYROLL_PAYMENT,
        description: "March 2025 payroll",
        confidence: ConfidenceLevel.HIGH,
        requiresFollowup: false,
      },
      reporter: reporter(),
    });

    const infra = await run({
      eventType: EventType.INFRASTRUCTURE_EXPENSE,
      economicEffect: EconomicEffect.CASH_OUT,
      occurredAt: new Date("2025-03-31"),
      amount: "1500.00",
      currency: "BRL",
      sourceSystem: "normalizer",
      sourceReference: ref("infra"),
      normalizationVersion: "1.0",
      normalizationWorkerId: "worker-test",
      parties: [
        { partyId: USINA, role: PartyRole.PAYER, direction: Direction.OUT, amount: "1500.00" },
      ],
      objects: [{ objectId: "infra-mar-2025", objectType: ObjectType.INFRASTRUCTURE_COST, relation: Relation.SETTLES }],
      reason: {
        type: ReasonType.INFRASTRUCTURE_EXPENSE,
        description: "March infrastructure costs",
        confidence: ConfidenceLevel.HIGH,
        requiresFollowup: false,
      },
      reporter: reporter(),
    });

    const incentive = await run({
      eventType: EventType.INCENTIVE_PAYMENT,
      economicEffect: EconomicEffect.CASH_OUT,
      occurredAt: new Date("2025-03-31"),
      amount: "2000.00",
      currency: "BRL",
      sourceSystem: "normalizer",
      sourceReference: ref("incentive"),
      normalizationVersion: "1.0",
      normalizationWorkerId: "worker-test",
      parties: [
        { partyId: USINA,  role: PartyRole.PAYER, direction: Direction.OUT,     amount: "2000.00" },
        { partyId: BROKER, role: PartyRole.PAYEE, direction: Direction.NEUTRAL, amount: "2000.00" },
      ],
      objects: [{ objectId: "incentive-q1-2025", objectType: ObjectType.INCENTIVE, relation: Relation.SETTLES }],
      reason: {
        type: ReasonType.INCENTIVE_PAYMENT,
        description: "Q1 sales incentive",
        confidence: ConfidenceLevel.HIGH,
        requiresFollowup: false,
      },
      reporter: reporter(),
    });

    await assertChain(ledgerRepo);
    expect(await ledgerRepo.findAll()).toHaveLength(3);

    expect(await lifecycleOf(ledgerRepo, "payroll-mar-2025")).toEqual([EventType.PAYROLL_PAYMENT]);
    expect(await lifecycleOf(ledgerRepo, "infra-mar-2025")).toEqual([EventType.INFRASTRUCTURE_EXPENSE]);
    expect(await lifecycleOf(ledgerRepo, "incentive-q1-2025")).toEqual([EventType.INCENTIVE_PAYMENT]);

    expect(payroll.amount.toString()).toBe("10000.00");
    expect(infra.amount.toString()).toBe("1500.00");
    expect(incentive.amount.toString()).toBe("2000.00");
  });
});
