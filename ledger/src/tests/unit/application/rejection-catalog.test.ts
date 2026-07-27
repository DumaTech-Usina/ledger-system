import { describe, it, expect } from "vitest";
import { classifyStagingFailure, classifyError, RejectionCode } from "../../../core/application/services/RejectionCatalog";
import { RejectionType } from "../../../core/domain/value-objects/RejectionType";

/**
 * Contract test for the boundary rejection catalog. It pins the classification of every rejection
 * the Ledger already produces into the closed {code, category, field} contract, so a client can
 * branch on category without parsing free text. `detail` is asserted only to be display-safe
 * (never leaking internal vocabulary) — not on exact wording.
 */
const SAFE = /matrix|relation|invariant|economic_effect|reason|hash|step|payer|payee|direction/i;

describe("classifyStagingFailure — schema/shape stage", () => {
  it("INVALID_AMOUNT → AMOUNT_INVALID · input · amount", () => {
    const r = classifyStagingFailure({ type: RejectionType.INVALID_AMOUNT, description: 'Invalid amount format: "x"' });
    expect(r).toMatchObject({ code: RejectionCode.AMOUNT_INVALID, category: "input", field: "amount" });
  });

  it("DUPLICATE_EVENT → DUPLICATE · duplicate", () => {
    const r = classifyStagingFailure({ type: RejectionType.DUPLICATE_EVENT, description: "Duplicate source reference" });
    expect(r).toMatchObject({ code: RejectionCode.DUPLICATE, category: "duplicate" });
  });

  it("MISSING_PARTY with a missing partyId → PARTY_MISSING · input · parties", () => {
    const r = classifyStagingFailure({ type: RejectionType.MISSING_PARTY, description: "Party at index 1 is missing partyId" });
    expect(r).toMatchObject({ code: RejectionCode.PARTY_MISSING, category: "input", field: "parties" });
  });

  it("MISSING_PARTY without a partyId hint (mapping defect) → internal", () => {
    const r = classifyStagingFailure({ type: RejectionType.MISSING_PARTY, description: "At least one party is required" });
    expect(r).toMatchObject({ code: RejectionCode.TUPLE_INVALID, category: "internal" });
  });

  it("INVALID_SCHEMA missing a USER field → FIELD_MISSING · input · <field>", () => {
    const r = classifyStagingFailure({ type: RejectionType.INVALID_SCHEMA, description: "Missing required field: occurredAt" });
    expect(r).toMatchObject({ code: RejectionCode.FIELD_MISSING, category: "input", field: "occurredAt" });
  });

  it("INVALID_SCHEMA missing a NON-user field → internal (no field leaked)", () => {
    const r = classifyStagingFailure({ type: RejectionType.INVALID_SCHEMA, description: "Missing required field: sourceReference" });
    expect(r).toMatchObject({ code: RejectionCode.TUPLE_INVALID, category: "internal" });
    expect(r.field).toBeUndefined();
  });

  it("INVALID_SCHEMA invalid enum → internal", () => {
    const r = classifyStagingFailure({ type: RejectionType.INVALID_SCHEMA, description: 'Invalid eventType: "charge_created". Valid values: ...' });
    expect(r).toMatchObject({ code: RejectionCode.TUPLE_INVALID, category: "internal" });
  });

  it("POLICY_VIOLATION → internal", () => {
    const r = classifyStagingFailure({ type: RejectionType.POLICY_VIOLATION, description: "..." });
    expect(r).toMatchObject({ code: RejectionCode.TUPLE_INVALID, category: "internal" });
  });
});

describe("classifyError — invariant/application stage", () => {
  it("Duplicate source reference → DUPLICATE · duplicate", () => {
    expect(classifyError("Duplicate source reference: intent:x")).toMatchObject({ code: RejectionCode.DUPLICATE, category: "duplicate" });
  });

  it("Origin event not found → ORIGIN_NOT_FOUND · lineage · relatedEventId", () => {
    expect(classifyError("Origin event not found: evt-1")).toMatchObject({ code: RejectionCode.ORIGIN_NOT_FOUND, category: "lineage", field: "relatedEventId" });
  });

  it("allowedOriginTypes mismatch → ORIGIN_WRONG_TYPE · lineage", () => {
    expect(classifyError("relatedEventId must point to a advance_payment event, but found loan_origination"))
      .toMatchObject({ code: RejectionCode.ORIGIN_WRONG_TYPE, category: "lineage", field: "relatedEventId" });
  });

  it("requires relatedEventId → LINEAGE_REQUIRED · lineage", () => {
    expect(classifyError("Event type commission_received requires relatedEventId pointing to its originating event"))
      .toMatchObject({ code: RejectionCode.LINEAGE_REQUIRED, category: "lineage", field: "relatedEventId" });
  });

  it("Over-settlement → OVER_SETTLEMENT · input · amount, with a safe limit hint", () => {
    const r = classifyError("Over-settlement: total settled would exceed origin amount of 500.00");
    expect(r).toMatchObject({ code: RejectionCode.OVER_SETTLEMENT, category: "input", field: "amount" });
    expect(r.hint?.limit).toBe("500.00");
  });

  it("amount cannot be zero → AMOUNT_INVALID · input · amount", () => {
    expect(classifyError("Event amount cannot be zero")).toMatchObject({ code: RejectionCode.AMOUNT_INVALID, category: "input", field: "amount" });
  });

  it("any tuple/flow/matrix violation → internal, with a display-safe detail", () => {
    const messages = [
      "Invalid economic effect cash_in for penalty_payment",
      "Relation settles not allowed for economic effect cash_internal",
      "Reason payroll_payment not allowed for advance_payment",
      "Insufficient confidence level",
      "Party party-x: PAYER cannot have direction IN",
      "Cash out total must match event amount",
      "Non-cash events require a reason",
      "Reversal events require previousHash",
    ];
    for (const m of messages) {
      const r = classifyError(m);
      expect(r, m).toMatchObject({ code: RejectionCode.TUPLE_INVALID, category: "internal" });
      expect(r.field, m).toBeUndefined();
      expect(SAFE.test(r.detail), `detail leaks internals for: ${m}`).toBe(false);
    }
  });
});
