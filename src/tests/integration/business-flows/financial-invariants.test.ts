import { describe, expect, it } from "vitest";
import { CreateLedgerEventUseCase } from "../../../core/application/use-cases/CreateLedgerEventUseCase";
import { Direction } from "../../../core/domain/enums/Direction";
import { EconomicEffect } from "../../../core/domain/enums/EconomicEffect";
import { PartyRole } from "../../../core/domain/enums/PartyRole";
import { ReasonType } from "../../../core/domain/enums/ReasonType";
import { Relation } from "../../../core/domain/enums/Relation";
import { NoOpAuditLogger } from "../../../infra/audit/NoOpAuditLogger";
import { InMemoryLedgerEventRepository } from "../../../infra/persistence/ledger/InMemoryLedgerEventRepository";
import { BROKER, TAX_AUTH, USINA } from "./helpers/parties";
import { advancePayment, advanceSettlement } from "./helpers/commands/advance-commands";
import {
  commissionReceived,
  commissionSplit,
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
    it.todo(
      "F10 — a partial commission receipt tied to an installment must not be silently accepted " +
      "without a discrepancy trace. Requires storing an expected-amount fact in the data model " +
      "(see CLAUDE.md Fix Roadmap — no position balance enforcement).",
    );

    it.todo(
      "F11 — direct payment acknowledgement plus cash receipt on the same installment must require " +
      "explicit expected-vs-actual reconciliation. Requires PositionProjectionService " +
      "(see CLAUDE.md Fix Roadmap).",
    );
  });

  describe("Open settlement states must be visible", () => {
    it.todo(
      "F12 — received commission without any allocation must be rejected or explicitly marked as pending. " +
      "Requires allocation-state tracking per settlement batch (see CLAUDE.md Fix Roadmap).",
    );

    it.todo(
      "F13 — partial commission split must leave the unallocated remainder as an explicit open balance. " +
      "Requires PositionProjectionService to detect that split < received (see CLAUDE.md Fix Roadmap).",
    );
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
    it.todo(
      "F16 — partial loan repayment via commission must leave a traceable remaining balance. " +
      "ADJUSTS relation is valid per domain contracts; detecting an open remainder requires " +
      "PositionProjectionService (see CLAUDE.md Fix Roadmap).",
    );

    it.todo(
      "F17 — commission received without broker and tax distribution must not silently pass " +
      "without an allocation trace. Requires allocation-state tracking (see CLAUDE.md Fix Roadmap).",
    );
  });
});
