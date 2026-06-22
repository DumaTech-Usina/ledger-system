/**
 * Fraud reversal scenarios for CashPositionService and PositionProjectionService.
 *
 * Real-world context: the ReceiptStagingBuilder (infra/etl) turns each BAIXADO receipt into
 * a COMMISSION_RECEIVED (CASH_IN) event. A single fraudulent proposal that passes ETL validation
 * can generate one receipt per installment — N CASH_IN events injected from a single fake source.
 * The reversal path uses LEDGER_CORRECTION (NON_CASH + REVERSES) to annotate those events.
 *
 * These tests verify what the services surface after reversals, and document the boundary between
 * semantic cancellation (position tracking) and physical cash records (cash flow totals).
 */

import { describe, it, expect } from "vitest";
import { setup } from "./helpers/setup";
import { makeRef } from "./helpers/ref";
import { OPERATOR, USINA, reporter } from "./helpers/parties";
import { loanOrigination } from "./helpers/commands/loan-commands";
import { advancePayment } from "./helpers/commands/advance-commands";
import { CashPositionService } from "../../../core/application/services/CashPositionService";
import { PositionProjectionService } from "../../../core/application/services/PositionProjectionService";
import { CreateLedgerEventCommand } from "../../../core/application/dtos/CreateLedgerEventInput";
import { ConfidenceLevel } from "../../../core/domain/enums/ConfidenceLevel";
import { Direction } from "../../../core/domain/enums/Direction";
import { EconomicEffect } from "../../../core/domain/enums/EconomicEffect";
import { EventType } from "../../../core/domain/enums/EventType";
import { ObjectType } from "../../../core/domain/enums/ObjectType";
import { PartyRole } from "../../../core/domain/enums/PartyRole";
import { ReasonType } from "../../../core/domain/enums/ReasonType";
import { Relation } from "../../../core/domain/enums/Relation";

// ── Command builders ─────────────────────────────────────────────────────────

/**
 * Mirrors ReceiptStagingBuilder's BAIXADO (discharged) path: one COMMISSION_RECEIVED
 * per installment, CASH_IN, with PROPOSAL and INSTALLMENT as contextual references.
 */
function fraudulentReceipt(
  ref: (label: string) => string,
  receiptId: string,
  proposalId: string,
  installmentNumber: number,
  amount = "500.00",
): CreateLedgerEventCommand {
  return {
    eventType: EventType.COMMISSION_RECEIVED,
    economicEffect: EconomicEffect.CASH_IN,
    occurredAt: new Date("2025-03-01"),
    amount,
    currency: "BRL",
    sourceSystem: "receipt-etl",
    sourceReference: ref(`receipt:${receiptId}:receivable`),
    normalizationVersion: "1.0",
    normalizationWorkerId: "receipt-etl",
    parties: [
      { partyId: OPERATOR, role: PartyRole.PAYER,  direction: Direction.OUT },
      { partyId: USINA,    role: PartyRole.PAYEE,  direction: Direction.IN, amount },
    ],
    objects: [
      {
        objectId:   `receivable:${receiptId}`,
        objectType: ObjectType.COMMISSION_RECEIVABLE,
        relation:   Relation.SETTLES,
      },
      {
        objectId:   proposalId,
        objectType: ObjectType.PROPOSAL,
        relation:   Relation.REFERENCES,
      },
      {
        objectId:   `${proposalId}:${installmentNumber}`,
        objectType: ObjectType.INSTALLMENT,
        relation:   Relation.REFERENCES,
      },
    ],
    reason: {
      type:            ReasonType.COMMISSION_PAYMENT,
      description:     "Receipt receivable recognition",
      confidence:      ConfidenceLevel.MEDIUM,
      requiresFollowup: false,
    },
    reporter: reporter(),
  };
}

/**
 * The ignition point for a receipt: a COMMISSION_EXPECTED that ORIGINATES the receivable
 * a fraudulentReceipt later settles. The real ReceiptStagingBuilder must produce this same
 * accrual leg so the received is never an orphan settlement.
 */
function expectedReceipt(
  ref: (label: string) => string,
  receiptId: string,
  amount = "500.00",
): CreateLedgerEventCommand {
  return {
    eventType: EventType.COMMISSION_EXPECTED,
    economicEffect: EconomicEffect.NON_CASH,
    occurredAt: new Date("2025-02-15"),
    amount,
    currency: "BRL",
    sourceSystem: "receipt-etl",
    sourceReference: ref(`receipt:${receiptId}:expected`),
    normalizationVersion: "1.0",
    normalizationWorkerId: "receipt-etl",
    parties: [
      { partyId: USINA, role: PartyRole.BENEFICIARY, direction: Direction.NEUTRAL },
    ],
    objects: [
      {
        objectId: `receivable:${receiptId}`,
        objectType: ObjectType.COMMISSION_RECEIVABLE,
        relation: Relation.ORIGINATES,
      },
    ],
    reason: {
      type: ReasonType.LATE_IDENTIFIED_COMMISSION,
      description: "expected commission accrual",
      confidence: ConfidenceLevel.MEDIUM,
      requiresFollowup: false,
    },
    reporter: reporter(),
  };
}

/** Runs the ignition point then the linked fraudulent receipt. */
async function runFraudulentReceipt(
  run: (cmd: CreateLedgerEventCommand) => Promise<{ id: { value: string } }>,
  ref: (label: string) => string,
  receiptId: string,
  proposalId: string,
  installmentNumber: number,
  amount = "500.00",
) {
  const expected = await run(expectedReceipt(ref, receiptId, amount));
  return run({
    ...fraudulentReceipt(ref, receiptId, proposalId, installmentNumber, amount),
    relatedEventId: expected.id.value,
  });
}

/**
 * LEDGER_CORRECTION that reverses a specific object.
 * The use case automatically chains previousHash from the repository, so
 * LEDGER_CORRECTION's requiresPreviousHash constraint is always satisfied
 * as long as at least one event precedes this correction.
 */
function ledgerReversal(
  ref: (label: string) => string,
  tag: string,
  objectId: string,
  objectType: ObjectType,
  amount: string,
): CreateLedgerEventCommand {
  return {
    eventType:       EventType.LEDGER_CORRECTION,
    economicEffect:  EconomicEffect.NON_CASH,
    occurredAt:      new Date("2025-04-01"),
    amount,
    currency:        "BRL",
    sourceSystem:    "manual-import",
    sourceReference: ref(`reversal:${tag}`),
    normalizationVersion:  "1.0",
    normalizationWorkerId: "worker-test",
    parties: [
      { partyId: USINA, role: PartyRole.PLATFORM, direction: Direction.NEUTRAL },
    ],
    objects: [
      { objectId, objectType, relation: Relation.REVERSES },
    ],
    reason: {
      type:            ReasonType.MANUAL_CORRECTION,
      description:     "Fraudulent entry from fake proposal",
      confidence:      ConfidenceLevel.HIGH,
      requiresFollowup: false,
    },
    reporter: reporter(),
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

const PROPOSAL = "fraud-proposal-xyz";

describe("Reversal — position tracking (PositionProjectionService)", () => {
  it("CPREV1 — single fraudulent receipt reversed: position becomes 'reversed' with outcome 'cancelled'", async () => {
    const ref = makeRef();
    const { ledgerRepo, run } = setup();
    const svc = new PositionProjectionService(ledgerRepo);

    await runFraudulentReceipt(run, ref, "r-001", PROPOSAL, 1);
    await run(ledgerReversal(ref, "r-001", "receivable:r-001", ObjectType.COMMISSION_RECEIVABLE, "500.00"));

    const position = await svc.summarize("receivable:r-001");

    expect(position).not.toBeNull();
    expect(position!.status).toBe("reversed");
    expect(position!.outcome).toBe("cancelled");
  });

  it("CPREV2 — one fraudulent proposal generates 3 receipts; each receivable is independently reversed", async () => {
    const ref = makeRef();
    const { ledgerRepo, run } = setup();
    const svc = new PositionProjectionService(ledgerRepo);

    await runFraudulentReceipt(run, ref, "r-001", PROPOSAL, 1);
    await runFraudulentReceipt(run, ref, "r-002", PROPOSAL, 2);
    await runFraudulentReceipt(run, ref, "r-003", PROPOSAL, 3);

    await run(ledgerReversal(ref, "r-001", "receivable:r-001", ObjectType.COMMISSION_RECEIVABLE, "500.00"));
    await run(ledgerReversal(ref, "r-002", "receivable:r-002", ObjectType.COMMISSION_RECEIVABLE, "500.00"));
    await run(ledgerReversal(ref, "r-003", "receivable:r-003", ObjectType.COMMISSION_RECEIVABLE, "500.00"));

    const [p1, p2, p3] = await Promise.all([
      svc.summarize("receivable:r-001"),
      svc.summarize("receivable:r-002"),
      svc.summarize("receivable:r-003"),
    ]);

    expect(p1!.status).toBe("reversed");
    expect(p2!.status).toBe("reversed");
    expect(p3!.status).toBe("reversed");

    expect(p1!.outcome).toBe("cancelled");
    expect(p2!.outcome).toBe("cancelled");
    expect(p3!.outcome).toBe("cancelled");
  });

  it("CPREV3 — partial reversal: 2 of 3 receipts reversed, the 3rd keeps its original position", async () => {
    const ref = makeRef();
    const { ledgerRepo, run } = setup();
    const svc = new PositionProjectionService(ledgerRepo);

    await runFraudulentReceipt(run, ref, "r-001", PROPOSAL, 1);
    await runFraudulentReceipt(run, ref, "r-002", PROPOSAL, 2);
    await runFraudulentReceipt(run, ref, "r-003", PROPOSAL, 3);

    await run(ledgerReversal(ref, "r-001", "receivable:r-001", ObjectType.COMMISSION_RECEIVABLE, "500.00"));
    await run(ledgerReversal(ref, "r-002", "receivable:r-002", ObjectType.COMMISSION_RECEIVABLE, "500.00"));
    // r-003 intentionally left without a correction

    const reversed1 = await svc.summarize("receivable:r-001");
    const reversed2 = await svc.summarize("receivable:r-002");
    const untouched  = await svc.summarize("receivable:r-003");

    expect(reversed1!.status).toBe("reversed");
    expect(reversed2!.status).toBe("reversed");
    expect(untouched!.status).not.toBe("reversed");
  });

  it("CPREV4 — the proposal reference itself remains visible in the ledger after all its receipts are reversed", async () => {
    const ref = makeRef();
    const { ledgerRepo, run } = setup();

    await runFraudulentReceipt(run, ref, "r-001", PROPOSAL, 1);
    await runFraudulentReceipt(run, ref, "r-002", PROPOSAL, 2);

    await run(ledgerReversal(ref, "r-001", "receivable:r-001", ObjectType.COMMISSION_RECEIVABLE, "500.00"));
    await run(ledgerReversal(ref, "r-002", "receivable:r-002", ObjectType.COMMISSION_RECEIVABLE, "500.00"));

    // The proposal objectId is a REFERENCES annotation on every receipt event.
    // Reversals target the COMMISSION_RECEIVABLE, not the PROPOSAL, so the proposal
    // remains visible as an audit trail of all events that cited it.
    const eventsForProposal = await ledgerRepo.findByObjectId(PROPOSAL);
    expect(eventsForProposal).toHaveLength(2); // both fraudulent receipts still reference it
  });
});

describe("Reversal — cash flow totals (CashPositionService)", () => {
  it("CPREV5 — totalCashIn preserves the physical record after NON_CASH reversals", async () => {
    // LEDGER_CORRECTION is NON_CASH: it annotates the position as 'reversed' (semantic)
    // but does not alter the cash flow record (physical). The R$1,500 CASH_IN that entered
    // the system remains in totalCashIn regardless of how many corrections follow.
    //
    // This is intentional: the ledger is an immutable audit trail. Reversals mark entries
    // as cancelled without rewriting history. Physical cash restitution requires a separate
    // CASH_OUT event representing the actual return of funds.
    const ref = makeRef();
    const { ledgerRepo, run } = setup();
    const cashSvc = new CashPositionService(ledgerRepo);
    const posSvc  = new PositionProjectionService(ledgerRepo);

    await runFraudulentReceipt(run, ref, "r-001", PROPOSAL, 1, "500.00");
    await runFraudulentReceipt(run, ref, "r-002", PROPOSAL, 2, "500.00");
    await runFraudulentReceipt(run, ref, "r-003", PROPOSAL, 3, "500.00");

    await run(ledgerReversal(ref, "r-001", "receivable:r-001", ObjectType.COMMISSION_RECEIVABLE, "500.00"));
    await run(ledgerReversal(ref, "r-002", "receivable:r-002", ObjectType.COMMISSION_RECEIVABLE, "500.00"));
    await run(ledgerReversal(ref, "r-003", "receivable:r-003", ObjectType.COMMISSION_RECEIVABLE, "500.00"));

    const cash = await cashSvc.summarize();

    // Cash flow totals are not reduced by NON_CASH corrections.
    expect(cash.totalCashIn.toString()).toBe("1500.00");
    expect(cash.totalCashOut.toString()).toBe("0.00");

    // Position tracking DOES reflect the reversals — the two surfaces serve different purposes.
    const p1 = await posSvc.summarize("receivable:r-001");
    const p2 = await posSvc.summarize("receivable:r-002");
    const p3 = await posSvc.summarize("receivable:r-003");

    expect(p1!.status).toBe("reversed");
    expect(p2!.status).toBe("reversed");
    expect(p3!.status).toBe("reversed");
  });

  it("CPREV6 — fraudulent loan reversed: drops out of openReceivables entirely", async () => {
    const ref = makeRef();
    const { ledgerRepo, run } = setup();
    const svc = new CashPositionService(ledgerRepo);

    await run(loanOrigination(ref, "fraud-loan", "3000.00"));
    await run(ledgerReversal(ref, "fraud-loan", "fraud-loan", ObjectType.LOAN, "3000.00"));

    const result = await svc.summarize();

    expect(result.openReceivables.toString()).toBe("0.00");
  });

  it("CPREV7 — fraudulent advance reversed: drops out of openReceivables entirely", async () => {
    const ref = makeRef();
    const { ledgerRepo, run } = setup();
    const svc = new CashPositionService(ledgerRepo);

    await run(advancePayment(ref, "fraud-advance", "2000.00"));
    await run(ledgerReversal(ref, "fraud-advance", "fraud-advance", ObjectType.ADVANCE, "2000.00"));

    const result = await svc.summarize();

    expect(result.openReceivables.toString()).toBe("0.00");
  });

  it("CPREV8 — only the fraudulent loan is reversed; the legitimate one still contributes to openReceivables", async () => {
    const ref = makeRef();
    const { ledgerRepo, run } = setup();
    const svc = new CashPositionService(ledgerRepo);

    await run(loanOrigination(ref, "legit-loan",  "1000.00"));
    await run(loanOrigination(ref, "fraud-loan",  "2000.00"));

    await run(ledgerReversal(ref, "fraud-loan", "fraud-loan", ObjectType.LOAN, "2000.00"));

    const result = await svc.summarize();

    expect(result.openReceivables.toString()).toBe("1000.00");
  });

  it("CPREV9 — multiple fraudulent loans all reversed: openReceivables reaches zero", async () => {
    const ref = makeRef();
    const { ledgerRepo, run } = setup();
    const svc = new CashPositionService(ledgerRepo);

    await run(loanOrigination(ref, "fraud-loan-a", "1000.00"));
    await run(loanOrigination(ref, "fraud-loan-b", "1500.00"));
    await run(loanOrigination(ref, "fraud-loan-c", "2000.00"));

    await run(ledgerReversal(ref, "fraud-loan-a", "fraud-loan-a", ObjectType.LOAN, "1000.00"));
    await run(ledgerReversal(ref, "fraud-loan-b", "fraud-loan-b", ObjectType.LOAN, "1500.00"));
    await run(ledgerReversal(ref, "fraud-loan-c", "fraud-loan-c", ObjectType.LOAN, "2000.00"));

    const result = await svc.summarize();

    expect(result.openReceivables.toString()).toBe("0.00");
  });
});
