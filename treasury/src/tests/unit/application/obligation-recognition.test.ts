import { describe, it, expect } from "vitest";
import { CandidateMapper } from "../../../core/application/services/CandidateMapper";
import { getScenario } from "../../../core/domain/scenarios/Scenario";
import { Intent } from "../../../core/domain/entities/Intent";
import { IntentStatus } from "../../../core/domain/enums/IntentStatus";
import { PARTY } from "../../fixtures/parties";

/**
 * Recognizing an obligation, in both orders of arrival.
 *
 * The Ledger derives the same position either way — the fold reads sums, never order. What Treasury
 * has to get right is that both orders name the SAME objectId, because that is the only thing that
 * makes the two facts meet on one position. These tests pin exactly that, on the candidates, before
 * anything reaches the Ledger.
 */
const USINA = PARTY.USINA;

function build(scenarioId: string, intentId: string, answers: Record<string, string>) {
  const scenario = getScenario(scenarioId)!;
  const intent = Intent.rehydrate({
    id: intentId,
    scenarioId,
    userId: "cfo",
    status: IntentStatus.AWAITING_CONFIRMATION,
    answers,
    createdAt: "2026-07-09T00:00:00.000Z",
    updatedAt: "2026-07-09T00:00:00.000Z",
  });
  return new CandidateMapper(USINA).build(intent, scenario);
}

const recognitionAnswers = {
  kind: "payroll",
  payee: PARTY.BROKER,
  amount: "45000.00",
  currency: "BRL",
  occurredAt: "2026-07-25",
};

const payrollAnswers = {
  payee: PARTY.BROKER,
  amount: "45000.00",
  currency: "BRL",
  occurredAt: "2026-07-31",
};

describe("obligation recognition — the tuple", () => {
  it("maps to OBLIGATION_RECOGNIZED · NON_CASH · ORIGINATES", () => {
    const c = build("register_obligation_recognition", "intent-R", recognitionAnswers);

    expect(c.eventType).toBe("obligation_recognized");
    expect(c.economicEffect).toBe("non_cash");
    expect(c.objects[0].relation).toBe("originates");
    expect(c.reason.type).toBe("obligation_recognition");
    // A recognition is not caused by anything the user pointed at: it carries no lineage.
    expect(c.relatedEventId).toBeUndefined();
  });

  it("no party carries a direction or an amount — nothing moved", () => {
    const c = build("register_obligation_recognition", "intent-R", recognitionAnswers);

    expect(c.parties.every((p) => p.direction === "neutral")).toBe(true);
    expect(c.parties.every((p) => !("amount" in p))).toBe(true);
    // The obligation still names both sides: who owes and who is owed.
    expect(c.parties.map((p) => p.partyId)).toEqual([USINA, PARTY.BROKER]);
  });

  it.each([
    ["payroll", "payroll"],
    ["service", "service_fee"],
    ["infrastructure", "infrastructure_cost"],
    ["tax", "tax"],
    ["other", "payable"],
  ])("the kind '%s' selects the object type %s — the economics never differ", (kind, objectType) => {
    const c = build("register_obligation_recognition", "intent-R", { ...recognitionAnswers, kind });

    expect(c.objects[0].objectType).toBe(objectType);
    expect(c.eventType).toBe("obligation_recognized");
    expect(c.economicEffect).toBe("non_cash");
  });
});

describe("obligation recognition — the forward order", () => {
  it("with no continuity answer the recognition mints a new position", () => {
    const c = build("register_obligation_recognition", "intent-R", recognitionAnswers);
    expect(c.objects[0].objectId).toBe("intent:intent-R");
    expect(c.reason.type).toBe("obligation_recognition");
  });

  it("the payment pointed at the obligation settles THAT position, not a new one", () => {
    const recognition = build("register_obligation_recognition", "intent-R", recognitionAnswers);
    const payment = build("register_payroll", "intent-P", {
      ...payrollAnswers,
      objectRef: recognition.objects[0].objectId,
    });

    expect(payment.objects[0].objectId).toBe(recognition.objects[0].objectId);
    expect(payment.objects[0].relation).toBe("settles");
    expect(payment.economicEffect).toBe("cash_out");
    // The payment's cause is unchanged: it is an ordinary payroll payment.
    expect(payment.reason.type).toBe("payroll_payment");
  });

  it("a payroll with no continuity answer keeps minting, byte for byte as before", () => {
    const c = build("register_payroll", "intent-P", payrollAnswers);
    expect(c.objects).toEqual([
      { objectId: "intent:intent-P", objectType: "payroll", relation: "settles" },
    ]);
  });
});

describe("obligation recognition — the reverse order", () => {
  it("a recognition pointed at an already-paid position originates THAT position", () => {
    const payment = build("register_payroll", "intent-P", payrollAnswers);
    const late = build("register_obligation_recognition", "intent-R", {
      ...recognitionAnswers,
      objectRef: payment.objects[0].objectId,
    });

    expect(late.objects[0].objectId).toBe(payment.objects[0].objectId);
    expect(late.objects[0].relation).toBe("originates");
  });

  it("and says the knowledge arrived late, instead of presenting it as ordinary knowledge", () => {
    const late = build("register_obligation_recognition", "intent-R", {
      ...recognitionAnswers,
      objectRef: "intent:intent-P",
    });

    expect(late.reason.type).toBe("late_awareness");
    expect(late.reason.description).toMatch(/after the payment/i);
  });

  it("still carries no lineage — a recognition is not caused by the payment it explains", () => {
    const late = build("register_obligation_recognition", "intent-R", {
      ...recognitionAnswers,
      objectRef: "intent:intent-P",
    });
    expect(late.relatedEventId).toBeUndefined();
  });

  it("a blank continuity answer is not an assertion: it mints and keeps the plain reason", () => {
    const c = build("register_obligation_recognition", "intent-R", {
      ...recognitionAnswers,
      objectRef: "   ",
    });

    expect(c.objects[0].objectId).toBe("intent:intent-R");
    expect(c.reason.type).toBe("obligation_recognition");
  });
});

describe("obligation recognition — convergence of the two orders", () => {
  it("both orders put the recognition and the payment on one and the same objectId", () => {
    // forward: recognize, then pay pointing at it
    const fwdRecognition = build("register_obligation_recognition", "intent-F1", recognitionAnswers);
    const fwdPayment = build("register_payroll", "intent-F2", {
      ...payrollAnswers,
      objectRef: fwdRecognition.objects[0].objectId,
    });

    // reverse: pay, then recognize pointing at it
    const revPayment = build("register_payroll", "intent-B1", payrollAnswers);
    const revRecognition = build("register_obligation_recognition", "intent-B2", {
      ...recognitionAnswers,
      objectRef: revPayment.objects[0].objectId,
    });

    expect(fwdPayment.objects[0].objectId).toBe(fwdRecognition.objects[0].objectId);
    expect(revRecognition.objects[0].objectId).toBe(revPayment.objects[0].objectId);

    // Same relations on both sides, so the Ledger folds the same sums either way.
    expect(fwdRecognition.objects[0].relation).toBe(revRecognition.objects[0].relation);
    expect(fwdPayment.objects[0].relation).toBe(revPayment.objects[0].relation);
    expect(fwdRecognition.objects[0].objectType).toBe(revRecognition.objects[0].objectType);
  });
});
