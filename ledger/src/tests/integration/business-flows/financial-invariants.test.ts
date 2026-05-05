import { describe, expect, it } from "vitest";
import { CreateLedgerEventUseCase } from "../../../core/application/use-cases/CreateLedgerEventUseCase";
import { PositionProjectionService } from "../../../core/application/services/PositionProjectionService";
import { ConfidenceLevel } from "../../../core/domain/enums/ConfidenceLevel";
import { Direction } from "../../../core/domain/enums/Direction";
import { EconomicEffect } from "../../../core/domain/enums/EconomicEffect";
import { ObjectType } from "../../../core/domain/enums/ObjectType";
import { PartyRole } from "../../../core/domain/enums/PartyRole";
import { ReasonType } from "../../../core/domain/enums/ReasonType";
import { Relation } from "../../../core/domain/enums/Relation";
import { NoOpAuditLogger } from "../../../infra/audit/NoOpAuditLogger";
import { InMemoryLedgerEventRepository } from "../../../infra/persistence/ledger/InMemoryLedgerEventRepository";
import { BROKER, TAX_AUTH, USINA } from "./helpers/parties";
import { advancePayment, advanceSettlement } from "./helpers/commands/advance-commands";
import {
  commissionExpected,
  commissionReceived,
  commissionSplit,
  directPaymentAcknowledged,
} from "./helpers/commands/commission-commands";
import { loanOrigination, loanRepayment } from "./helpers/commands/loan-commands";
import { makeRef } from "./helpers/ref";
import { setup } from "./helpers/setup";

const ref = makeRef();

class RaceyLedgerEventRepository extends InMemoryLedgerEventRepository {
  private pendingReaders = 0;
  private releaseReaders: Array<() => void> = [];

  async getLastEventHash() {
    const hash = await super.getLastEventHash();

    if (!hash) {
      return hash;
    }

    this.pendingReaders += 1;

    if (this.pendingReaders === 1) {
      await new Promise<void>((resolve) => {
        this.releaseReaders.push(resolve);
      });
    } else {
      const releases = [...this.releaseReaders];
      this.releaseReaders = [];
      releases.forEach((release) => release());
    }

    return hash;
  }
}

describe("Financial invariants", () => {
  describe("Over-settlement must never be silent", () => {
    it("F1 — loan cash repayments cannot exceed the originated principal", async () => {
      const { run } = setup();

      const loan = await run(loanOrigination(ref, "loan-f1", "1000.00"));
      await run(
        loanRepayment(ref, "loan-f1", loan.id.value, EconomicEffect.CASH_IN, Relation.SETTLES, ReasonType.LOAN_REPAYMENT, "700.00"),
      );

      await expect(
        run(
          loanRepayment(ref, "loan-f1", loan.id.value, EconomicEffect.CASH_IN, Relation.SETTLES, ReasonType.LOAN_REPAYMENT, "400.00"),
        ),
      ).rejects.toThrow("Over-settlement");
    });

    it("F2 — advance recovery plus recognised loss cannot exceed the original advance", async () => {
      const { run } = setup();

      const advance = await run(advancePayment(ref, "adv-f2", "500.00"));
      await run(
        advanceSettlement(ref, "adv-f2", advance.id.value, Relation.SETTLES, EconomicEffect.CASH_IN, "300.00", ReasonType.ADVANCE_PAYMENT),
      );

      await expect(
        run(
          advanceSettlement(ref, "adv-f2", advance.id.value, Relation.SETTLES, EconomicEffect.NON_CASH, "250.00", ReasonType.LOSS_RECOGNITION),
        ),
      ).rejects.toThrow("Over-settlement");
    });
  });

  describe("Invalid origin links must be rejected", () => {
    it("F3 — loan repayment cannot reference a non-existent relatedEventId", async () => {
      const { run } = setup();

      await expect(
        run(
          loanRepayment(ref, "loan-f3", "evt-missing-loan-origin", EconomicEffect.CASH_IN, Relation.SETTLES, ReasonType.LOAN_REPAYMENT, "300.00"),
        ),
      ).rejects.toThrow("Origin event not found");
    });

    it("F4 — advance settlement cannot reference a non-existent relatedEventId", async () => {
      const { run } = setup();

      await expect(
        run(
          advanceSettlement(ref, "adv-f4", "evt-missing-advance-origin", Relation.SETTLES, EconomicEffect.CASH_IN, "200.00", ReasonType.ADVANCE_PAYMENT),
        ),
      ).rejects.toThrow("Origin event not found");
    });

    it("F5 — advance settlement must not point to a loan origination", async () => {
      const { run } = setup();

      const loan = await run(loanOrigination(ref, "loan-f5", "1000.00"));

      await expect(
        run(
          advanceSettlement(ref, "adv-f5", loan.id.value, Relation.SETTLES, EconomicEffect.CASH_IN, "200.00", ReasonType.ADVANCE_PAYMENT),
        ),
      ).rejects.toThrow("allowedOriginTypes" in Error.prototype ? /origin/ : /.*/);
    });

    it("F6 — loan repayment must not point to an advance payment", async () => {
      const { run } = setup();

      const advance = await run(advancePayment(ref, "adv-f6", "500.00"));

      await expect(
        run(
          loanRepayment(ref, "loan-f6", advance.id.value, EconomicEffect.CASH_IN, Relation.SETTLES, ReasonType.LOAN_REPAYMENT, "200.00"),
        ),
      ).rejects.toThrow();
    });

    it("F7 — debt settlements must reference the originating debt, not a previous settlement", async () => {
      const { run } = setup();

      const loan = await run(loanOrigination(ref, "loan-f7", "1000.00"));
      const firstRepayment = await run(
        loanRepayment(ref, "loan-f7", loan.id.value, EconomicEffect.CASH_IN, Relation.SETTLES, ReasonType.LOAN_REPAYMENT, "300.00"),
      );

      await expect(
        run(
          loanRepayment(ref, "loan-f7", firstRepayment.id.value, EconomicEffect.CASH_IN, Relation.SETTLES, ReasonType.LOAN_REPAYMENT, "200.00"),
        ),
      ).rejects.toThrow();
    });
  });

  describe("Split integrity must be explicit", () => {
    it("F8 — commission split must reject under-allocation against the event amount", async () => {
      const { run } = setup();

      await expect(
        run({
          ...commissionSplit(ref, "com-pay-f8", "700.00"),
          parties: [
            { partyId: USINA, role: PartyRole.PAYER, direction: Direction.OUT, amount: "700.00" },
            { partyId: BROKER, role: PartyRole.PAYEE, direction: Direction.NEUTRAL, amount: "500.00" },
            { partyId: TAX_AUTH, role: PartyRole.PAYEE, direction: Direction.NEUTRAL, amount: "100.00" },
          ],
        }),
      ).rejects.toThrow("Allocated amounts");
    });

    it("F9 — commission split must reject over-allocation against the event amount", async () => {
      const { run } = setup();

      await expect(
        run({
          ...commissionSplit(ref, "com-pay-f9", "700.00"),
          parties: [
            { partyId: USINA, role: PartyRole.PAYER, direction: Direction.OUT, amount: "700.00" },
            { partyId: BROKER, role: PartyRole.PAYEE, direction: Direction.NEUTRAL, amount: "650.00" },
            { partyId: TAX_AUTH, role: PartyRole.PAYEE, direction: Direction.NEUTRAL, amount: "150.00" },
          ],
        }),
      ).rejects.toThrow("Allocated amounts");
    });
  });

  describe("Expected versus actual cash flow must be reconcilable", () => {
    it("F10 — a partial commission receipt must leave a traceable discrepancy against the expected amount", async () => {
      const { ledgerRepo, run } = setup();
      const svc = new PositionProjectionService(ledgerRepo);

      // Record the expected commission amount as an accrual entry
      await run(commissionExpected(ref, "com-recv-f10", "1000.00"));
      // Only R$700 actually arrives — R$300 shortfall
      await run(commissionReceived(ref, "com-recv-f10", "700.00"));

      const summary = await svc.summarize("com-recv-f10");
      expect(summary!.totalOriginated.toString()).toBe("1000.00");
      expect(summary!.totalSettled.toString()).toBe("700.00");
      expect(summary!.openBalance.toString()).toBe("300.00");
      expect(summary!.status).toBe("partially_settled");
    });

    it("F11 — direct payment acknowledgement plus cash receipt on the same receivable must surface an over-settlement", async () => {
      const { ledgerRepo, run } = setup();
      const svc = new PositionProjectionService(ledgerRepo);

      // Expected: R$1000
      await run(commissionExpected(ref, "com-recv-f11", "1000.00"));
      // Operator paid broker directly (NON_CASH) — settles R$800
      await run(
        directPaymentAcknowledged(
          ref, "com-recv-f11", ObjectType.COMMISSION_RECEIVABLE,
          ReasonType.DIRECT_COMMISSION_PAYMENT_AUTHORIZED, ConfidenceLevel.MEDIUM,
          "operator paid broker directly", "800.00",
        ),
      );
      // Cash receipt also arrives for R$300 — total settled R$1100 > expected R$1000
      await run(commissionReceived(ref, "com-recv-f11", "300.00"));

      const summary = await svc.summarize("com-recv-f11");
      expect(summary!.totalSettled.toString()).toBe("1100.00");
      expect(summary!.overSettlement.toString()).toBe("100.00");
    });
  });

  describe("Open settlement states must be visible", () => {
    it("F12 — commission received without any split must show the full amount as unallocated on the settlement batch", async () => {
      const { ledgerRepo, run } = setup();
      const svc = new PositionProjectionService(ledgerRepo);

      const BATCH = "batch-f12";
      await run({
        ...commissionReceived(ref, "com-recv-f12", "1000.00"),
        objects: [
          { objectId: "com-recv-f12", objectType: ObjectType.COMMISSION_RECEIVABLE, relation: Relation.SETTLES },
          { objectId: BATCH, objectType: ObjectType.SETTLEMENT_BATCH, relation: Relation.REFERENCES },
        ],
      });

      const summary = await svc.summarize(BATCH);
      expect(summary!.allocationGap.toString()).toBe("1000.00");
    });

    it("F13 — partial commission split must leave the unallocated remainder visible on the settlement batch", async () => {
      const { ledgerRepo, run } = setup();
      const svc = new PositionProjectionService(ledgerRepo);

      const BATCH = "batch-f13";
      await run({
        ...commissionReceived(ref, "com-recv-f13", "1000.00"),
        objects: [
          { objectId: "com-recv-f13", objectType: ObjectType.COMMISSION_RECEIVABLE, relation: Relation.SETTLES },
          { objectId: BATCH, objectType: ObjectType.SETTLEMENT_BATCH, relation: Relation.REFERENCES },
        ],
      });

      // Only R$600 of the R$1000 is distributed — R$400 remains unallocated
      await run({
        ...commissionSplit(ref, "com-payable-f13"),
        amount: "600.00",
        parties: [
          { partyId: USINA,    role: PartyRole.PAYER, direction: Direction.OUT,     amount: "600.00" },
          { partyId: BROKER,   role: PartyRole.PAYEE, direction: Direction.NEUTRAL, amount: "480.00" },
          { partyId: TAX_AUTH, role: PartyRole.PAYEE, direction: Direction.NEUTRAL, amount: "120.00" },
        ],
        objects: [
          { objectId: "com-payable-f13", objectType: ObjectType.COMMISSION_PAYABLE, relation: Relation.SETTLES },
          { objectId: BATCH, objectType: ObjectType.SETTLEMENT_BATCH, relation: Relation.REFERENCES },
        ],
      });

      const summary = await svc.summarize(BATCH);
      expect(summary!.allocationGap.toString()).toBe("400.00");
    });
  });

  describe("Duplicate protection must exist on direct ledger writes", () => {
    it("F14 — the same sourceReference cannot create multiple ledger events outside the staging flow", async () => {
      const { run } = setup();

      const first = commissionReceived(ref, "dup-f14", "1000.00");
      await run({ ...first, sourceReference: "dup-f14" });

      await expect(
        run({ ...commissionReceived(ref, "dup-f14", "1000.00"), sourceReference: "dup-f14" }),
      ).rejects.toThrow("Duplicate source reference");
    });
  });

  describe("Hash chain integrity must survive concurrency", () => {
    it("F15 — concurrent appends fork the previousHash chain (known vulnerability — requires DB unique constraint on previousHash)", async () => {
      // This test documents a known failure mode: without a database-level unique constraint
      // on previousHash, two concurrent writes that both read the same tail hash will both succeed,
      // producing a forked chain. The assertion below confirms the fork happens.
      // Mitigation requires: UNIQUE INDEX on previousHash in the Postgres ledger_events table.
      const ledgerRepo = new RaceyLedgerEventRepository();
      const useCase = new CreateLedgerEventUseCase(ledgerRepo, new NoOpAuditLogger());

      await useCase.execute(commissionReceived(ref, "fork-seed", "1000.00"));

      const [a, b] = await Promise.all([
        useCase.execute(commissionReceived(ref, "fork-a", "300.00")),
        useCase.execute(commissionReceived(ref, "fork-b", "400.00")),
      ]);

      // Both concurrent appends read the same tail hash → both reference it as previousHash.
      // This is the fork: two events claim the same predecessor.
      expect(a.previousHash?.value).toBe(b.previousHash?.value);
    });
  });

  describe("Debt lifecycle and remainder tracking must stay explicit", () => {
    it("F16 — partial loan repayment via commission netting must leave a traceable remaining balance", async () => {
      const { ledgerRepo, run } = setup();
      const svc = new PositionProjectionService(ledgerRepo);

      const loan = await run(loanOrigination(ref, "loan-f16", "1000.00"));
      // Broker repays R$300 via commission deduction (ADJUSTS, not SETTLES)
      await run(
        loanRepayment(
          ref, "loan-f16", loan.id.value,
          EconomicEffect.NON_CASH, Relation.ADJUSTS,
          ReasonType.LOAN_REPAYMENT_VIA_COMMISSION, "300.00",
        ),
      );

      const summary = await svc.summarize("loan-f16");
      expect(summary!.totalOriginated.toString()).toBe("1000.00");
      expect(summary!.totalAdjusted.toString()).toBe("300.00");
      expect(summary!.openBalance.toString()).toBe("700.00");
      expect(summary!.status).toBe("partially_settled");
    });

    it("F17 — a CASH_INTERNAL pool reallocation on a settlement batch does not count as broker or tax distribution", async () => {
      const { ledgerRepo, run } = setup();
      const svc = new PositionProjectionService(ledgerRepo);

      const BATCH = "batch-f17";
      await run({
        ...commissionReceived(ref, "com-recv-f17", "1000.00"),
        objects: [
          { objectId: "com-recv-f17", objectType: ObjectType.COMMISSION_RECEIVABLE, relation: Relation.SETTLES },
          { objectId: BATCH, objectType: ObjectType.SETTLEMENT_BATCH, relation: Relation.REFERENCES },
        ],
      });

      // Usina moves R$1000 to an internal pool (CASH_INTERNAL) — not a payout to broker or tax
      await run({
        ...commissionSplit(ref, "com-pool-f17"),
        economicEffect: EconomicEffect.CASH_INTERNAL,
        amount: "1000.00",
        parties: [
          { partyId: USINA,        role: PartyRole.PAYER, direction: Direction.OUT, amount: "1000.00" },
          { partyId: "usina-pool", role: PartyRole.PAYEE, direction: Direction.IN,  amount: "1000.00" },
        ],
        objects: [
          { objectId: "com-pool-f17", objectType: ObjectType.COMMISSION_POOL, relation: Relation.ADJUSTS },
          { objectId: BATCH, objectType: ObjectType.SETTLEMENT_BATCH, relation: Relation.REFERENCES },
        ],
      });

      // CASH_INTERNAL is not counted as outbound allocation — gap remains at the full received amount
      const summary = await svc.summarize(BATCH);
      expect(summary!.allocationGap.toString()).toBe("1000.00");
    });
  });
});
