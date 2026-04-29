import { describe, it, expect, beforeEach } from "vitest";
import { DashboardService } from "../../../core/application/services/DashboardService";
import { PositionProjectionService } from "../../../core/application/services/PositionProjectionService";
import { InMemoryLedgerEventRepository } from "../../../infra/persistence/ledger/InMemoryLedgerEventRepository";
import { CreateLedgerEventUseCase } from "../../../core/application/use-cases/CreateLedgerEventUseCase";
import { NoOpAuditLogger } from "../../../infra/audit/NoOpAuditLogger";
import { makeValidCommand } from "../../fixtures";
import { EconomicEffect } from "../../../core/domain/enums/EconomicEffect";
import { EventType } from "../../../core/domain/enums/EventType";
import { ObjectType } from "../../../core/domain/enums/ObjectType";
import { Relation } from "../../../core/domain/enums/Relation";
import { Direction } from "../../../core/domain/enums/Direction";
import { PartyRole } from "../../../core/domain/enums/PartyRole";
import { ReasonType } from "../../../core/domain/enums/ReasonType";
import { ConfidenceLevel } from "../../../core/domain/enums/ConfidenceLevel";

// ── Helpers ────────────────────────────────────────────────────────────────────

let _seq = 0;
const ref = () => `ref-ds-${++_seq}`;

function makeSvc(repo: InMemoryLedgerEventRepository) {
  const posSvc = new PositionProjectionService(repo);
  return new DashboardService(repo, posSvc);
}

async function runCmd(
  repo: InMemoryLedgerEventRepository,
  overrides: Parameters<typeof makeValidCommand>[0] = {},
) {
  const uc = new CreateLedgerEventUseCase(repo, new NoOpAuditLogger());
  const cmd = makeValidCommand({ sourceReference: ref(), ...overrides });
  return uc.execute(cmd);
}

/** COMMISSION_RECEIVED (CASH_IN) event with parties and amount kept in sync. */
async function runCashIn(repo: InMemoryLedgerEventRepository, amount: string, occurredAt: Date) {
  const uc = new CreateLedgerEventUseCase(repo, new NoOpAuditLogger());
  return uc.execute(makeValidCommand({
    sourceReference: ref(),
    occurredAt,
    economicEffect: EconomicEffect.CASH_IN,
    amount,
    parties: [{ partyId: "party-1", role: PartyRole.PAYEE, direction: Direction.IN, amount }],
  }));
}

const JAN_01 = new Date("2025-01-01T00:00:00Z");
const JAN_15 = new Date("2025-01-15T00:00:00Z");
const JAN_31 = new Date("2025-01-31T00:00:00Z");
const FEB_01 = new Date("2025-02-01T00:00:00Z");
const PERIOD_JAN = { from: JAN_01, to: JAN_31 };

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("DashboardService.compute()", () => {

  describe("empty ledger", () => {
    it("DS01 — returns all-zero metrics and empty lists", async () => {
      const repo = new InMemoryLedgerEventRepository();
      const svc  = makeSvc(repo);

      const d = await svc.compute(PERIOD_JAN.from, PERIOD_JAN.to);

      expect(d.cashIn.toString()).toBe("0.00");
      expect(d.cashOut.toString()).toBe("0.00");
      expect(d.netCashUnits).toBe(0n);
      expect(d.openExposure.toString()).toBe("0.00");
      expect(d.capitalAtRisk.toString()).toBe("0.00");
      expect(d.recoveryRate).toBe(0);
      expect(d.attentionPositions).toHaveLength(0);
      expect(d.recentMovements).toHaveLength(0);
      expect(Object.keys(d.cashInByType)).toHaveLength(0);
      expect(Object.keys(d.cashOutByType)).toHaveLength(0);
    });
  });

  describe("period cash flow", () => {
    it("DS02 — counts only cash_in events inside period", async () => {
      const repo = new InMemoryLedgerEventRepository();

      await runCashIn(repo, "500.00", JAN_15);
      await runCashIn(repo, "200.00", FEB_01); // outside period — should be excluded

      const d = await makeSvc(repo).compute(JAN_01, JAN_31);

      expect(d.cashIn.toString()).toBe("500.00");
    });

    it("DS03 — counts only cash_out events inside period", async () => {
      const repo = new InMemoryLedgerEventRepository();

      await runCmd(repo, {
        occurredAt:     JAN_15,
        eventType:      EventType.COMMISSION_SPLIT,
        economicEffect: EconomicEffect.CASH_OUT,
        amount:         "300.00",
        objects: [{ objectId: "pool-1", objectType: ObjectType.COMMISSION_PAYABLE, relation: Relation.SETTLES }],
        parties: [
          { partyId: "usina", role: PartyRole.PAYER,  direction: Direction.OUT, amount: "300.00" },
          { partyId: "bkr",   role: PartyRole.PAYEE,  direction: Direction.NEUTRAL, amount: "300.00" },
        ],
        reason: { type: ReasonType.COMMISSION_SPLIT, description: "split", confidence: ConfidenceLevel.HIGH, requiresFollowup: false },
      });

      const d = await makeSvc(repo).compute(JAN_01, JAN_31);
      expect(d.cashOut.toString()).toBe("300.00");
    });

    it("DS04 — non_cash events are excluded from cashIn and cashOut", async () => {
      const repo = new InMemoryLedgerEventRepository();

      await runCmd(repo, {
        occurredAt:     JAN_15,
        eventType:      EventType.COMMISSION_WAIVER,
        economicEffect: EconomicEffect.NON_CASH,
        amount:         "400.00",
        objects: [{ objectId: "ent-1", objectType: ObjectType.COMMISSION_ENTITLEMENT, relation: Relation.SETTLES }],
        parties: [{ partyId: "bkr", role: PartyRole.BENEFICIARY, direction: Direction.NEUTRAL }],
        reason: { type: ReasonType.COMMISSION_WAIVER, description: "waiver", confidence: ConfidenceLevel.HIGH, requiresFollowup: false },
      });

      const d = await makeSvc(repo).compute(JAN_01, JAN_31);
      expect(d.cashIn.toString()).toBe("0.00");
      expect(d.cashOut.toString()).toBe("0.00");
    });

    it("DS05 — period boundary dates are inclusive (from and to)", async () => {
      const repo = new InMemoryLedgerEventRepository();

      await runCashIn(repo, "100.00", JAN_01);
      await runCashIn(repo, "200.00", JAN_31);

      const d = await makeSvc(repo).compute(JAN_01, JAN_31);
      expect(d.cashIn.toString()).toBe("300.00");
    });

    it("DS06 — netCashUnits is positive when cashIn > cashOut", async () => {
      const repo = new InMemoryLedgerEventRepository();

      await runCmd(repo, { occurredAt: JAN_15, economicEffect: EconomicEffect.CASH_IN, amount: "1000.00" });

      const d = await makeSvc(repo).compute(JAN_01, JAN_31);
      expect(d.netCashUnits).toBeGreaterThan(0n);
      expect(d.netCashUnits).toBe(100000n); // 1000.00 in minor units
    });

    it("DS07 — netCashUnits is negative when cashOut > cashIn", async () => {
      const repo = new InMemoryLedgerEventRepository();

      await runCmd(repo, {
        occurredAt:     JAN_15,
        eventType:      EventType.COMMISSION_SPLIT,
        economicEffect: EconomicEffect.CASH_OUT,
        amount:         "800.00",
        objects: [{ objectId: "pool-2", objectType: ObjectType.COMMISSION_PAYABLE, relation: Relation.SETTLES }],
        parties: [
          { partyId: "usina", role: PartyRole.PAYER,  direction: Direction.OUT,     amount: "800.00" },
          { partyId: "bkr",   role: PartyRole.PAYEE,  direction: Direction.NEUTRAL, amount: "800.00" },
        ],
        reason: { type: ReasonType.COMMISSION_SPLIT, description: "split", confidence: ConfidenceLevel.HIGH, requiresFollowup: false },
      });

      const d = await makeSvc(repo).compute(JAN_01, JAN_31);
      expect(d.netCashUnits).toBeLessThan(0n);
    });
  });

  describe("cashInByType / cashOutByType breakdown", () => {
    it("DS08 — aggregates amounts by eventType", async () => {
      const repo = new InMemoryLedgerEventRepository();

      await runCashIn(repo, "300.00", JAN_15);
      await runCashIn(repo, "200.00", JAN_15);

      const d = await makeSvc(repo).compute(JAN_01, JAN_31);
      expect(d.cashInByType[EventType.COMMISSION_RECEIVED]?.toString()).toBe("500.00");
    });
  });

  describe("capitalAtRisk", () => {
    it("DS09 — open position originated < 30 days ago is NOT at risk", async () => {
      const repo = new InMemoryLedgerEventRepository();
      const recentDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago

      await runCmd(repo, {
        occurredAt:     recentDate,
        eventType:      EventType.ADVANCE_PAYMENT,
        economicEffect: EconomicEffect.CASH_OUT,
        amount:         "500.00",
        objects: [{ objectId: "adv-recent", objectType: ObjectType.ADVANCE, relation: Relation.ORIGINATES }],
        parties: [
          { partyId: "usina", role: PartyRole.PAYER,  direction: Direction.OUT,     amount: "500.00" },
          { partyId: "bkr",   role: PartyRole.PAYEE,  direction: Direction.NEUTRAL, amount: "500.00" },
        ],
        reason: { type: ReasonType.ADVANCE_PAYMENT, description: "adv", confidence: ConfidenceLevel.HIGH, requiresFollowup: false },
      });

      const d = await makeSvc(repo).compute(new Date(0), new Date());
      expect(d.capitalAtRisk.toString()).toBe("0.00");
    });

    it("DS10 — open position originated > 30 days ago IS at risk", async () => {
      const repo = new InMemoryLedgerEventRepository();
      const oldDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000); // 45 days ago

      await runCmd(repo, {
        occurredAt:     oldDate,
        eventType:      EventType.ADVANCE_PAYMENT,
        economicEffect: EconomicEffect.CASH_OUT,
        amount:         "700.00",
        objects: [{ objectId: "adv-old", objectType: ObjectType.ADVANCE, relation: Relation.ORIGINATES }],
        parties: [
          { partyId: "usina", role: PartyRole.PAYER,  direction: Direction.OUT,     amount: "700.00" },
          { partyId: "bkr",   role: PartyRole.PAYEE,  direction: Direction.NEUTRAL, amount: "700.00" },
        ],
        reason: { type: ReasonType.ADVANCE_PAYMENT, description: "adv", confidence: ConfidenceLevel.HIGH, requiresFollowup: false },
      });

      const d = await makeSvc(repo).compute(new Date(0), new Date());
      expect(d.capitalAtRisk.toString()).toBe("700.00");
    });

    it("DS11 — partially settled position is NOT capital at risk (has some settlement)", async () => {
      const repo = new InMemoryLedgerEventRepository();
      const uc   = new CreateLedgerEventUseCase(repo, new NoOpAuditLogger());
      const oldDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);

      const orig = await uc.execute(makeValidCommand({
        sourceReference: ref(),
        occurredAt:      oldDate,
        eventType:       EventType.ADVANCE_PAYMENT,
        economicEffect:  EconomicEffect.CASH_OUT,
        amount:          "1000.00",
        objects:  [{ objectId: "adv-partial", objectType: ObjectType.ADVANCE, relation: Relation.ORIGINATES }],
        parties:  [
          { partyId: "usina", role: PartyRole.PAYER,  direction: Direction.OUT,     amount: "1000.00" },
          { partyId: "bkr",   role: PartyRole.PAYEE,  direction: Direction.NEUTRAL, amount: "1000.00" },
        ],
        reason: { type: ReasonType.ADVANCE_PAYMENT, description: "adv", confidence: ConfidenceLevel.HIGH, requiresFollowup: false },
      }));

      await uc.execute(makeValidCommand({
        sourceReference:  ref(),
        occurredAt:       new Date(),
        eventType:        EventType.ADVANCE_SETTLEMENT,
        economicEffect:   EconomicEffect.CASH_IN,
        amount:           "400.00",
        relatedEventId:   orig.id.value,
        objects:  [{ objectId: "adv-partial", objectType: ObjectType.ADVANCE, relation: Relation.SETTLES }],
        parties:  [
          { partyId: "usina", role: PartyRole.PAYEE,  direction: Direction.IN,      amount: "400.00" },
          { partyId: "bkr",   role: PartyRole.PAYER,  direction: Direction.NEUTRAL, amount: "400.00" },
        ],
        reason: { type: ReasonType.ADVANCE_PAYMENT, description: "partial recovery", confidence: ConfidenceLevel.MEDIUM, requiresFollowup: false },
      }));

      const d = await makeSvc(repo).compute(new Date(0), new Date());
      expect(d.capitalAtRisk.toString()).toBe("0.00");
    });
  });

  describe("openExposure", () => {
    it("DS12 — sums open balances across all positions", async () => {
      const repo = new InMemoryLedgerEventRepository();
      const uc   = new CreateLedgerEventUseCase(repo, new NoOpAuditLogger());

      await uc.execute(makeValidCommand({
        sourceReference: ref(),
        occurredAt:      JAN_15,
        eventType:       EventType.ADVANCE_PAYMENT,
        economicEffect:  EconomicEffect.CASH_OUT,
        amount:          "500.00",
        objects:  [{ objectId: "adv-exp-1", objectType: ObjectType.ADVANCE, relation: Relation.ORIGINATES }],
        parties:  [
          { partyId: "usina", role: PartyRole.PAYER,  direction: Direction.OUT,     amount: "500.00" },
          { partyId: "bkr",   role: PartyRole.PAYEE,  direction: Direction.NEUTRAL, amount: "500.00" },
        ],
        reason: { type: ReasonType.ADVANCE_PAYMENT, description: "adv", confidence: ConfidenceLevel.HIGH, requiresFollowup: false },
      }));

      await uc.execute(makeValidCommand({
        sourceReference: ref(),
        occurredAt:      JAN_15,
        eventType:       EventType.ADVANCE_PAYMENT,
        economicEffect:  EconomicEffect.CASH_OUT,
        amount:          "300.00",
        objects:  [{ objectId: "adv-exp-2", objectType: ObjectType.ADVANCE, relation: Relation.ORIGINATES }],
        parties:  [
          { partyId: "usina", role: PartyRole.PAYER,  direction: Direction.OUT,     amount: "300.00" },
          { partyId: "bkr",   role: PartyRole.PAYEE,  direction: Direction.NEUTRAL, amount: "300.00" },
        ],
        reason: { type: ReasonType.ADVANCE_PAYMENT, description: "adv", confidence: ConfidenceLevel.HIGH, requiresFollowup: false },
      }));

      const d = await makeSvc(repo).compute(JAN_01, JAN_31);
      expect(d.openExposure.toString()).toBe("800.00");
    });

    it("DS13 — fully settled position does not contribute to openExposure", async () => {
      const repo = new InMemoryLedgerEventRepository();
      const uc   = new CreateLedgerEventUseCase(repo, new NoOpAuditLogger());

      const orig = await uc.execute(makeValidCommand({
        sourceReference: ref(),
        occurredAt:      JAN_01,
        eventType:       EventType.ADVANCE_PAYMENT,
        economicEffect:  EconomicEffect.CASH_OUT,
        amount:          "600.00",
        objects:  [{ objectId: "adv-settled", objectType: ObjectType.ADVANCE, relation: Relation.ORIGINATES }],
        parties:  [
          { partyId: "usina", role: PartyRole.PAYER,  direction: Direction.OUT,     amount: "600.00" },
          { partyId: "bkr",   role: PartyRole.PAYEE,  direction: Direction.NEUTRAL, amount: "600.00" },
        ],
        reason: { type: ReasonType.ADVANCE_PAYMENT, description: "adv", confidence: ConfidenceLevel.HIGH, requiresFollowup: false },
      }));

      await uc.execute(makeValidCommand({
        sourceReference:  ref(),
        occurredAt:       JAN_15,
        eventType:        EventType.ADVANCE_SETTLEMENT,
        economicEffect:   EconomicEffect.CASH_IN,
        amount:           "600.00",
        relatedEventId:   orig.id.value,
        objects:  [{ objectId: "adv-settled", objectType: ObjectType.ADVANCE, relation: Relation.SETTLES }],
        parties:  [
          { partyId: "usina", role: PartyRole.PAYEE,  direction: Direction.IN,      amount: "600.00" },
          { partyId: "bkr",   role: PartyRole.PAYER,  direction: Direction.NEUTRAL, amount: "600.00" },
        ],
        reason: { type: ReasonType.ADVANCE_PAYMENT, description: "full recovery", confidence: ConfidenceLevel.MEDIUM, requiresFollowup: false },
      }));

      const d = await makeSvc(repo).compute(JAN_01, JAN_31);
      expect(d.openExposure.toString()).toBe("0.00");
    });
  });

  describe("recoveryRate", () => {
    it("DS14 — 0 when nothing originated", async () => {
      const repo = new InMemoryLedgerEventRepository();
      const d = await makeSvc(repo).compute(PERIOD_JAN.from, PERIOD_JAN.to);
      expect(d.recoveryRate).toBe(0);
    });

    it("DS15 — 1.0 when all originated cash was recovered", async () => {
      const repo = new InMemoryLedgerEventRepository();
      const uc   = new CreateLedgerEventUseCase(repo, new NoOpAuditLogger());

      const orig = await uc.execute(makeValidCommand({
        sourceReference: ref(),
        occurredAt:      JAN_01,
        eventType:       EventType.ADVANCE_PAYMENT,
        economicEffect:  EconomicEffect.CASH_OUT,
        amount:          "500.00",
        objects:  [{ objectId: "adv-rec", objectType: ObjectType.ADVANCE, relation: Relation.ORIGINATES }],
        parties:  [
          { partyId: "usina", role: PartyRole.PAYER,  direction: Direction.OUT,     amount: "500.00" },
          { partyId: "bkr",   role: PartyRole.PAYEE,  direction: Direction.NEUTRAL, amount: "500.00" },
        ],
        reason: { type: ReasonType.ADVANCE_PAYMENT, description: "adv", confidence: ConfidenceLevel.HIGH, requiresFollowup: false },
      }));

      await uc.execute(makeValidCommand({
        sourceReference:  ref(),
        occurredAt:       JAN_15,
        eventType:        EventType.ADVANCE_SETTLEMENT,
        economicEffect:   EconomicEffect.CASH_IN,
        amount:           "500.00",
        relatedEventId:   orig.id.value,
        objects:  [{ objectId: "adv-rec", objectType: ObjectType.ADVANCE, relation: Relation.SETTLES }],
        parties:  [
          { partyId: "usina", role: PartyRole.PAYEE,  direction: Direction.IN,      amount: "500.00" },
          { partyId: "bkr",   role: PartyRole.PAYER,  direction: Direction.NEUTRAL, amount: "500.00" },
        ],
        reason: { type: ReasonType.ADVANCE_PAYMENT, description: "full recovery", confidence: ConfidenceLevel.MEDIUM, requiresFollowup: false },
      }));

      const d = await makeSvc(repo).compute(PERIOD_JAN.from, PERIOD_JAN.to);
      expect(d.recoveryRate).toBe(1);
    });

    it("DS16 — partial recovery yields rate between 0 and 1", async () => {
      const repo = new InMemoryLedgerEventRepository();
      const uc   = new CreateLedgerEventUseCase(repo, new NoOpAuditLogger());

      const orig = await uc.execute(makeValidCommand({
        sourceReference: ref(),
        occurredAt:      JAN_01,
        eventType:       EventType.ADVANCE_PAYMENT,
        economicEffect:  EconomicEffect.CASH_OUT,
        amount:          "1000.00",
        objects:  [{ objectId: "adv-partial-rate", objectType: ObjectType.ADVANCE, relation: Relation.ORIGINATES }],
        parties:  [
          { partyId: "usina", role: PartyRole.PAYER,  direction: Direction.OUT,     amount: "1000.00" },
          { partyId: "bkr",   role: PartyRole.PAYEE,  direction: Direction.NEUTRAL, amount: "1000.00" },
        ],
        reason: { type: ReasonType.ADVANCE_PAYMENT, description: "adv", confidence: ConfidenceLevel.HIGH, requiresFollowup: false },
      }));

      await uc.execute(makeValidCommand({
        sourceReference:  ref(),
        occurredAt:       JAN_15,
        eventType:        EventType.ADVANCE_SETTLEMENT,
        economicEffect:   EconomicEffect.CASH_IN,
        amount:           "500.00",
        relatedEventId:   orig.id.value,
        objects:  [{ objectId: "adv-partial-rate", objectType: ObjectType.ADVANCE, relation: Relation.SETTLES }],
        parties:  [
          { partyId: "usina", role: PartyRole.PAYEE,  direction: Direction.IN,      amount: "500.00" },
          { partyId: "bkr",   role: PartyRole.PAYER,  direction: Direction.NEUTRAL, amount: "500.00" },
        ],
        reason: { type: ReasonType.ADVANCE_PAYMENT, description: "partial", confidence: ConfidenceLevel.MEDIUM, requiresFollowup: false },
      }));

      const d = await makeSvc(repo).compute(PERIOD_JAN.from, PERIOD_JAN.to);
      expect(d.recoveryRate).toBeGreaterThan(0);
      expect(d.recoveryRate).toBeLessThan(1);
      expect(d.recoveryRate).toBeCloseTo(0.5, 3);
    });
  });

  describe("attentionPositions", () => {
    it("DS17 — only open and partially_settled positions are included", async () => {
      const repo = new InMemoryLedgerEventRepository();
      const uc   = new CreateLedgerEventUseCase(repo, new NoOpAuditLogger());

      // Open advance
      await uc.execute(makeValidCommand({
        sourceReference: ref(),
        occurredAt:      JAN_01,
        eventType:       EventType.ADVANCE_PAYMENT,
        economicEffect:  EconomicEffect.CASH_OUT,
        amount:          "400.00",
        objects:  [{ objectId: "adv-att", objectType: ObjectType.ADVANCE, relation: Relation.ORIGINATES }],
        parties:  [
          { partyId: "usina", role: PartyRole.PAYER,  direction: Direction.OUT,     amount: "400.00" },
          { partyId: "bkr",   role: PartyRole.PAYEE,  direction: Direction.NEUTRAL, amount: "400.00" },
        ],
        reason: { type: ReasonType.ADVANCE_PAYMENT, description: "adv", confidence: ConfidenceLevel.HIGH, requiresFollowup: false },
      }));

      // Fully settled commission — should NOT appear
      const origComm = await uc.execute(makeValidCommand({
        sourceReference: ref(),
        occurredAt:      JAN_01,
      }));
      await uc.execute(makeValidCommand({
        sourceReference:  ref(),
        occurredAt:       JAN_15,
        amount:           "1000.00",
      }));

      const d = await makeSvc(repo).compute(PERIOD_JAN.from, PERIOD_JAN.to);
      const ids = d.attentionPositions.map((p) => p.objectId);
      expect(ids).toContain("adv-att");
      // fully settled commission position should not be in attention
      d.attentionPositions.forEach((p) => {
        expect(p.status === "open" || p.status === "partially_settled").toBe(true);
      });
    });

    it("DS18 — capped at 6 items", async () => {
      const repo = new InMemoryLedgerEventRepository();
      const uc   = new CreateLedgerEventUseCase(repo, new NoOpAuditLogger());

      for (let i = 0; i < 8; i++) {
        await uc.execute(makeValidCommand({
          sourceReference: ref(),
          occurredAt:      new Date(`2025-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`),
          eventType:       EventType.ADVANCE_PAYMENT,
          economicEffect:  EconomicEffect.CASH_OUT,
          amount:          "100.00",
          objects:  [{ objectId: `adv-cap-${i}`, objectType: ObjectType.ADVANCE, relation: Relation.ORIGINATES }],
          parties:  [
            { partyId: "usina", role: PartyRole.PAYER,  direction: Direction.OUT,     amount: "100.00" },
            { partyId: "bkr",   role: PartyRole.PAYEE,  direction: Direction.NEUTRAL, amount: "100.00" },
          ],
          reason: { type: ReasonType.ADVANCE_PAYMENT, description: "adv", confidence: ConfidenceLevel.HIGH, requiresFollowup: false },
        }));
      }

      const d = await makeSvc(repo).compute(PERIOD_JAN.from, PERIOD_JAN.to);
      expect(d.attentionPositions.length).toBeLessThanOrEqual(6);
    });

    it("DS19 — sorted by originatedAt ascending (oldest first)", async () => {
      const repo = new InMemoryLedgerEventRepository();
      const uc   = new CreateLedgerEventUseCase(repo, new NoOpAuditLogger());

      const dates = ["2025-01-10", "2025-01-05", "2025-01-20"];
      for (const [i, dateStr] of dates.entries()) {
        await uc.execute(makeValidCommand({
          sourceReference: ref(),
          occurredAt:      new Date(`${dateStr}T00:00:00Z`),
          eventType:       EventType.ADVANCE_PAYMENT,
          economicEffect:  EconomicEffect.CASH_OUT,
          amount:          "100.00",
          objects:  [{ objectId: `adv-sort-${i}`, objectType: ObjectType.ADVANCE, relation: Relation.ORIGINATES }],
          parties:  [
            { partyId: "usina", role: PartyRole.PAYER,  direction: Direction.OUT,     amount: "100.00" },
            { partyId: "bkr",   role: PartyRole.PAYEE,  direction: Direction.NEUTRAL, amount: "100.00" },
          ],
          reason: { type: ReasonType.ADVANCE_PAYMENT, description: "adv", confidence: ConfidenceLevel.HIGH, requiresFollowup: false },
        }));
      }

      const d = await makeSvc(repo).compute(PERIOD_JAN.from, PERIOD_JAN.to);
      const origDates = d.attentionPositions.map((p) => p.originatedAt?.getTime() ?? 0);
      for (let i = 1; i < origDates.length; i++) {
        expect(origDates[i]).toBeGreaterThanOrEqual(origDates[i - 1]);
      }
    });
  });

  describe("recentMovements", () => {
    it("DS20 — only cash_in and cash_out events are included", async () => {
      const repo = new InMemoryLedgerEventRepository();

      // cash_in
      await runCashIn(repo, "100.00", JAN_15);
      // non_cash — should be excluded
      await runCmd(repo, {
        occurredAt:     JAN_15,
        eventType:      EventType.COMMISSION_WAIVER,
        economicEffect: EconomicEffect.NON_CASH,
        amount:         "50.00",
        objects: [{ objectId: "ent-mv", objectType: ObjectType.COMMISSION_ENTITLEMENT, relation: Relation.SETTLES }],
        parties: [{ partyId: "bkr", role: PartyRole.BENEFICIARY, direction: Direction.NEUTRAL }],
        reason:  { type: ReasonType.COMMISSION_WAIVER, description: "w", confidence: ConfidenceLevel.HIGH, requiresFollowup: false },
      });

      const d = await makeSvc(repo).compute(PERIOD_JAN.from, PERIOD_JAN.to);
      d.recentMovements.forEach((ev) => {
        expect(
          ev.economicEffect === EconomicEffect.CASH_IN ||
          ev.economicEffect === EconomicEffect.CASH_OUT,
        ).toBe(true);
      });
    });

    it("DS21 — capped at 8 items", async () => {
      const repo = new InMemoryLedgerEventRepository();
      for (let i = 0; i < 12; i++) {
        await runCashIn(repo, "100.00", new Date(`2025-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`));
      }
      const d = await makeSvc(repo).compute(new Date(0), new Date());
      expect(d.recentMovements.length).toBeLessThanOrEqual(8);
    });
  });

  describe("period returns correct metadata", () => {
    it("DS22 — period.from and period.to match the input", async () => {
      const repo = new InMemoryLedgerEventRepository();
      const d = await makeSvc(repo).compute(JAN_01, JAN_31);
      expect(d.period.from).toEqual(JAN_01);
      expect(d.period.to).toEqual(JAN_31);
    });
  });
});
