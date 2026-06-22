import { describe, it, expect } from "vitest";
import { CashStatementService } from "../../../core/application/services/CashStatementService";
import { InMemoryLedgerEventRepository } from "../../../infra/persistence/memory/InMemoryLedgerEventRepository";
import { CreateLedgerEventUseCase } from "../../../core/application/use-cases/CreateLedgerEventUseCase";
import { NoOpAuditLogger } from "../../../infra/audit/NoOpAuditLogger";
import { makeExpectedCommand, makeValidCommand } from "../../fixtures";
import { EconomicEffect } from "../../../core/domain/enums/EconomicEffect";
import { EventType } from "../../../core/domain/enums/EventType";
import { ObjectType } from "../../../core/domain/enums/ObjectType";
import { Relation } from "../../../core/domain/enums/Relation";
import { Direction } from "../../../core/domain/enums/Direction";
import { PartyRole } from "../../../core/domain/enums/PartyRole";
import { ReasonType } from "../../../core/domain/enums/ReasonType";
import { ConfidenceLevel } from "../../../core/domain/enums/ConfidenceLevel";

const USINA = "usina";

let _seq = 0;
const ref = () => `ref-cs-${++_seq}`;

function makeSvc(repo: InMemoryLedgerEventRepository) {
  return new CashStatementService(repo, USINA);
}

async function createCashIn(
  repo: InMemoryLedgerEventRepository,
  amount: string,
  occurredAt: Date,
  objectId = `obj-cs-${++_seq}`,
) {
  const uc = new CreateLedgerEventUseCase(repo, new NoOpAuditLogger());
  const expected = await uc.execute(makeExpectedCommand({
    sourceReference: ref(),
    amount,
    objects: [{ objectId, objectType: ObjectType.COMMISSION_RECEIVABLE, relation: Relation.ORIGINATES }],
  }));
  return uc.execute(makeValidCommand({
    sourceReference: ref(),
    occurredAt,
    eventType: EventType.COMMISSION_RECEIVED,
    economicEffect: EconomicEffect.CASH_IN,
    amount,
    relatedEventId: expected.id.value,
    objects: [{ objectId, objectType: ObjectType.COMMISSION_RECEIVABLE, relation: Relation.SETTLES }],
    parties: [
      { partyId: USINA, role: PartyRole.PAYEE, direction: Direction.IN, amount },
      { partyId: "broker", role: PartyRole.BENEFICIARY, direction: Direction.NEUTRAL, amount },
    ],
    reason: { type: ReasonType.COMMISSION_PAYMENT, description: "comm", confidence: ConfidenceLevel.HIGH, requiresFollowup: false },
  }));
}

async function createCashOut(
  repo: InMemoryLedgerEventRepository,
  amount: string,
  occurredAt: Date,
  objectId = `obj-cs-${++_seq}`,
) {
  const uc = new CreateLedgerEventUseCase(repo, new NoOpAuditLogger());
  return uc.execute(makeValidCommand({
    sourceReference: ref(),
    occurredAt,
    eventType: EventType.ADVANCE_PAYMENT,
    economicEffect: EconomicEffect.CASH_OUT,
    amount,
    objects: [{ objectId, objectType: ObjectType.ADVANCE, relation: Relation.ORIGINATES }],
    parties: [
      { partyId: USINA, role: PartyRole.PAYER, direction: Direction.OUT, amount },
      { partyId: "broker", role: PartyRole.PAYEE, direction: Direction.NEUTRAL, amount },
    ],
    reason: { type: ReasonType.ADVANCE_PAYMENT, description: "advance", confidence: ConfidenceLevel.HIGH, requiresFollowup: false },
  }));
}

async function createNonCash(
  repo: InMemoryLedgerEventRepository,
  occurredAt: Date,
) {
  const uc = new CreateLedgerEventUseCase(repo, new NoOpAuditLogger());
  return uc.execute(makeValidCommand({
    sourceReference: ref(),
    occurredAt,
    eventType: EventType.COMMISSION_WAIVER,
    economicEffect: EconomicEffect.NON_CASH,
    amount: "500.00",
    objects: [{ objectId: `obj-cs-${++_seq}`, objectType: ObjectType.COMMISSION_ENTITLEMENT, relation: Relation.SETTLES }],
    parties: [{ partyId: "broker", role: PartyRole.BENEFICIARY, direction: Direction.NEUTRAL }],
    reason: { type: ReasonType.COMMISSION_WAIVER, description: "waiver", confidence: ConfidenceLevel.HIGH, requiresFollowup: false },
  }));
}

const PERIOD_FROM = new Date("2026-03-01T00:00:00Z");
const PERIOD_TO   = new Date("2026-03-31T23:59:59Z");
const BEFORE      = new Date("2026-02-15T00:00:00Z");
const IN_PERIOD   = new Date("2026-03-10T00:00:00Z");

describe("CashStatementService", () => {
  it("CS1 — empty ledger: all Money fields = 0, openingBalance = 0", async () => {
    const repo = new InMemoryLedgerEventRepository();
    const result = await makeSvc(repo).summarize(PERIOD_FROM, PERIOD_TO);

    expect(result.openingBalance.toString()).toBe("0.00");
    expect(result.closingBalance.toString()).toBe("0.00");
    expect(result.totalCashIn.toString()).toBe("0.00");
    expect(result.totalCashOut.toString()).toBe("0.00");
    expect(result.netFlow.toString()).toBe("0.00");
    expect(result.currency).toBe("BRL");
  });

  it("CS2 — events strictly before from: openingBalance reflects them, period totals = 0", async () => {
    const repo = new InMemoryLedgerEventRepository();
    await createCashIn(repo, "4000.00", BEFORE);
    await createCashOut(repo, "1000.00", BEFORE);

    const result = await makeSvc(repo).summarize(PERIOD_FROM, PERIOD_TO);

    // openingBalance = net before period = 4000 - 1000 = 3000
    expect(result.openingBalance.toString()).toBe("3000.00");
    expect(result.totalCashIn.toString()).toBe("0.00");
    expect(result.totalCashOut.toString()).toBe("0.00");
    expect(result.closingBalance.toString()).toBe("3000.00");
  });

  it("CS3 — CASH_IN in period: totalCashIn reflects it; closingBalance = openingBalance + cashIn", async () => {
    const repo = new InMemoryLedgerEventRepository();
    await createCashIn(repo, "2000.00", BEFORE);   // opening
    await createCashIn(repo, "3000.00", IN_PERIOD); // period

    const result = await makeSvc(repo).summarize(PERIOD_FROM, PERIOD_TO);

    expect(result.openingBalance.toString()).toBe("2000.00");
    expect(result.totalCashIn.toString()).toBe("3000.00");
    expect(result.totalCashOut.toString()).toBe("0.00");
    expect(result.closingBalance.toString()).toBe("5000.00");
  });

  it("CS4 — CASH_OUT in period: totalCashOut reflects it", async () => {
    const repo = new InMemoryLedgerEventRepository();
    await createCashOut(repo, "1500.00", IN_PERIOD);

    const result = await makeSvc(repo).summarize(PERIOD_FROM, PERIOD_TO);

    expect(result.totalCashOut.toString()).toBe("1500.00");
    expect(result.totalCashIn.toString()).toBe("0.00");
  });

  it("CS5 — NON_CASH in period: not reflected in any Money field", async () => {
    const repo = new InMemoryLedgerEventRepository();
    await createNonCash(repo, IN_PERIOD);

    const result = await makeSvc(repo).summarize(PERIOD_FROM, PERIOD_TO);

    expect(result.totalCashIn.toString()).toBe("0.00");
    expect(result.totalCashOut.toString()).toBe("0.00");
    expect(result.netFlow.toString()).toBe("0.00");
  });
});
