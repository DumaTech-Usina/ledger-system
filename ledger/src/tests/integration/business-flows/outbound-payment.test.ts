import { describe, it, expect } from "vitest";
import { setup } from "./helpers/setup";
import { makeRef } from "./helpers/ref";
import { USINA, reporter } from "./helpers/parties";
import { CashPositionService } from "../../../core/application/services/CashPositionService";
import { CreateLedgerEventCommand } from "../../../core/application/dtos/CreateLedgerEventInput";
import { ConfidenceLevel } from "../../../core/domain/enums/ConfidenceLevel";
import { Direction } from "../../../core/domain/enums/Direction";
import { EconomicEffect } from "../../../core/domain/enums/EconomicEffect";
import { EventType } from "../../../core/domain/enums/EventType";
import { ObjectType } from "../../../core/domain/enums/ObjectType";
import { PartyRole } from "../../../core/domain/enums/PartyRole";
import { ReasonType } from "../../../core/domain/enums/ReasonType";
import { Relation } from "../../../core/domain/enums/Relation";

const ref = makeRef();

// The ratified tuple: OUTBOUND_PAYMENT · PAYABLE · SETTLES · CASH_OUT · ORDINARY_SETTLEMENT.
// The counterparty is a Party (payee); it never enters the Object.
const outboundPayment = (objectId: string, amount: string): CreateLedgerEventCommand => ({
  eventType: EventType.OUTBOUND_PAYMENT,
  economicEffect: EconomicEffect.CASH_OUT,
  occurredAt: new Date("2026-07-09"),
  amount,
  currency: "BRL",
  sourceSystem: "integration",
  sourceReference: ref("outbound"),
  normalizationVersion: "1.0",
  normalizationWorkerId: "user-app-submit",
  parties: [
    { partyId: USINA, role: PartyRole.PAYER, direction: Direction.OUT, amount },
    { partyId: "supplier-acme", role: PartyRole.PAYEE, direction: Direction.NEUTRAL },
  ],
  objects: [{ objectId, objectType: ObjectType.PAYABLE, relation: Relation.SETTLES }],
  reason: {
    type: ReasonType.ORDINARY_SETTLEMENT,
    description: "ordinary settlement of a payable",
    confidence: ConfidenceLevel.HIGH,
    requiresFollowup: false,
  },
  reporter: reporter(),
});

describe("OUTBOUND_PAYMENT — cash-basis integration with CashPositionService", () => {
  it("a single outbound payment is accepted and shows up as totalCashOut", async () => {
    const { ledgerRepo, run } = setup();
    const svc = new CashPositionService(ledgerRepo);

    await run(outboundPayment("payable-1", "1500.00"));

    const result = await svc.summarize();
    expect(result.totalCashOut.toString()).toBe("1500.00");
    expect(result.totalCashIn.toString()).toBe("0.00");
    // It settles a payable (not a receivable), so it must not inflate open receivables.
    expect(result.openReceivables.toString()).toBe("0.00");
  });
});
