import { describe, it, expect } from "vitest";
import { CandidateMapper } from "../../../core/application/services/CandidateMapper";
import { getScenario } from "../../../core/domain/scenarios/Scenario";
import { Intent } from "../../../core/domain/entities/Intent";
import { IntentStatus } from "../../../core/domain/enums/IntentStatus";

/**
 * Pins the ratified economic tuple each scenario maps to. The Ledger gate is the ultimate authority,
 * but this test guards the tuple Treasury proposes so a mapping change can never silently record an
 * operation under the wrong semantic. Tuples were verified against EVENT_CONTRACTS + FormalMatrices.
 */
const USINA = "party-usina";

function buildFor(scenarioId: string) {
  const scenario = getScenario(scenarioId)!;
  const intent = Intent.rehydrate({
    id: "intent-1",
    scenarioId,
    userId: "cfo",
    status: IntentStatus.AWAITING_CONFIRMATION,
    answers: { payee: "party-broker", amount: "1500.00", currency: "BRL", occurredAt: "2026-07-09" },
    createdAt: "2026-07-09T00:00:00.000Z",
    updatedAt: "2026-07-09T00:00:00.000Z",
  });
  return new CandidateMapper(USINA).build(intent, scenario);
}

describe("CandidateMapper — credit scenarios (Phase 1)", () => {
  it("register_advance → ADVANCE_PAYMENT · ADVANCE · ORIGINATES · CASH_OUT · ADVANCE_PAYMENT", () => {
    const c = buildFor("register_advance");
    expect(c.eventType).toBe("advance_payment");
    expect(c.economicEffect).toBe("cash_out");
    expect(c.objects).toEqual([{ objectId: "intent:intent-1", objectType: "advance", relation: "originates" }]);
    expect(c.reason.type).toBe("advance_payment");
    // usina pays out; the recipient is a neutral payee Party carrying no amount.
    expect(c.parties).toEqual([
      { partyId: USINA, role: "payer", direction: "out", amount: "1500.00" },
      { partyId: "party-broker", role: "payee", direction: "neutral" },
    ]);
  });

  it("register_loan → LOAN_ORIGINATION · LOAN · ORIGINATES · CASH_OUT · LOAN_ORIGINATION", () => {
    const c = buildFor("register_loan");
    expect(c.eventType).toBe("loan_origination");
    expect(c.economicEffect).toBe("cash_out");
    expect(c.objects).toEqual([{ objectId: "intent:intent-1", objectType: "loan", relation: "originates" }]);
    expect(c.reason.type).toBe("loan_origination");
    expect(c.parties).toEqual([
      { partyId: USINA, role: "payer", direction: "out", amount: "1500.00" },
      { partyId: "party-broker", role: "payee", direction: "neutral" },
    ]);
  });

  it("both new scenarios ORIGINATE their credit object (never SETTLE a payable)", () => {
    for (const id of ["register_advance", "register_loan"]) {
      const c = buildFor(id);
      expect(c.objects[0].relation).toBe("originates");
      expect(c.objects[0].objectType).not.toBe("payable");
    }
  });
});

describe("CandidateMapper — per-instance tuple selection (Phase 4)", () => {
  function buildIncentive(kind: string) {
    const scenario = getScenario("register_incentive")!;
    const intent = Intent.rehydrate({
      id: "intent-1",
      scenarioId: "register_incentive",
      userId: "cfo",
      status: IntentStatus.AWAITING_CONFIRMATION,
      answers: { payee: "party-broker", kind, amount: "1500.00", currency: "BRL", occurredAt: "2026-07-09" },
      createdAt: "2026-07-09T00:00:00.000Z",
      updatedAt: "2026-07-09T00:00:00.000Z",
    });
    return new CandidateMapper(USINA).build(intent, scenario);
  }

  it("kind=incentive → object INCENTIVE (base tuple)", () => {
    const c = buildIncentive("incentive");
    expect(c.eventType).toBe("incentive_payment");
    expect(c.economicEffect).toBe("cash_out");
    expect(c.objects[0]).toEqual({ objectId: "intent:intent-1", objectType: "incentive", relation: "settles" });
  });

  it("kind=bonus → object BONUS (selected override), same event/effect/reason", () => {
    const c = buildIncentive("bonus");
    expect(c.eventType).toBe("incentive_payment");
    expect(c.economicEffect).toBe("cash_out");
    expect(c.objects[0]).toEqual({ objectId: "intent:intent-1", objectType: "bonus", relation: "settles" });
    expect(c.reason.type).toBe("incentive_payment");
  });

  it("scenarios without variants are unaffected (constant tuple)", () => {
    const c = buildFor("register_penalty");
    expect(c.objects[0].objectType).toBe("penalty");
  });
});

describe("CandidateMapper — NON_CASH party/object mold (Phase 5)", () => {
  function build(scenarioId: string, answers: Record<string, string>) {
    const scenario = getScenario(scenarioId)!;
    const intent = Intent.rehydrate({
      id: "intent-1",
      scenarioId,
      userId: "cfo",
      status: IntentStatus.AWAITING_CONFIRMATION,
      answers,
      createdAt: "2026-07-09T00:00:00.000Z",
      updatedAt: "2026-07-09T00:00:00.000Z",
    });
    return new CandidateMapper(USINA).build(intent, scenario);
  }
  const nonCashCommon = { amount: "500.00", currency: "BRL", occurredAt: "2026-07-09" };

  it("register_waiver (SETTLES) → NON_CASH, single BENEFICIARY party carrying NO amount", () => {
    const c = build("register_waiver", { payee: "party-broker", basis: "waiver", ...nonCashCommon });
    expect(c.eventType).toBe("commission_waiver");
    expect(c.economicEffect).toBe("non_cash");
    expect(c.parties).toEqual([{ partyId: "party-broker", role: "beneficiary", direction: "neutral" }]);
    expect(c.objects).toEqual([{ objectId: "intent:intent-1", objectType: "commission_entitlement", relation: "settles" }]);
    expect(c.parties.every((p) => !("amount" in p))).toBe(true); // no party carries cash on a NON_CASH event
  });

  it("register_waiver (REVERSES) → the variant selects the reversal relation", () => {
    const c = build("register_waiver", { payee: "party-broker", basis: "reversal", ...nonCashCommon });
    expect(c.objects[0].relation).toBe("reverses");
  });

  it("register_commission_accrual → NON_CASH, the USINA is the sole beneficiary party", () => {
    const c = build("register_commission_accrual", nonCashCommon);
    expect(c.eventType).toBe("commission_expected");
    expect(c.economicEffect).toBe("non_cash");
    expect(c.parties).toEqual([{ partyId: USINA, role: "beneficiary", direction: "neutral" }]);
    expect(c.objects).toEqual([{ objectId: "intent:intent-1", objectType: "commission_receivable", relation: "originates" }]);
  });

  it("register_direct_payment → NON_CASH, TWO objects with distinct ids, both SETTLES", () => {
    const c = build("register_direct_payment", { payee: "party-broker", ...nonCashCommon });
    expect(c.economicEffect).toBe("non_cash");
    expect(c.parties).toEqual([{ partyId: "party-broker", role: "beneficiary", direction: "neutral" }]);
    expect(c.objects).toEqual([
      { objectId: "intent:intent-1:commission_receivable", objectType: "commission_receivable", relation: "settles" },
      { objectId: "intent:intent-1:commission_entitlement", objectType: "commission_entitlement", relation: "settles" },
    ]);
  });
});

describe("CandidateMapper.fieldToSlot — reverse map for correction (Phase 3)", () => {
  const mapper = new CandidateMapper(USINA);

  it("maps a 'parties' rejection to the scenario's counterparty slot", () => {
    expect(mapper.fieldToSlot("register_penalty", "parties")).toBe("payee");
  });

  it("maps directly-named candidate fields to their slot", () => {
    expect(mapper.fieldToSlot("register_penalty", "amount")).toBe("amount");
    expect(mapper.fieldToSlot("register_penalty", "currency")).toBe("currency");
    expect(mapper.fieldToSlot("register_penalty", "occurredAt")).toBe("occurredAt");
  });

  it("returns undefined for fields with no slot in shape-A (e.g. relatedEventId) or unknown scenario", () => {
    expect(mapper.fieldToSlot("register_penalty", "relatedEventId")).toBeUndefined();
    expect(mapper.fieldToSlot("register_penalty", "reason")).toBeUndefined();
    expect(mapper.fieldToSlot("not_a_scenario", "amount")).toBeUndefined();
  });
});
