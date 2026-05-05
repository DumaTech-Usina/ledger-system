import { describe, expect, it } from "vitest";
import {
  ECONOMIC_EFFECT_RELATION_MATRIX,
  OBJECT_NATURE_MATRIX,
  OBJECT_RELATION_MATRIX,
  REASON_EFFECT_MATRIX,
  REASON_RELATION_MATRIX,
} from "../../../../core/domain/policies/FormalMatrices";
import { EconomicEffect } from "../../../../core/domain/enums/EconomicEffect";
import { ObjectNature } from "../../../../core/domain/enums/ObjectNature";
import { ObjectType } from "../../../../core/domain/enums/ObjectType";
import { Relation } from "../../../../core/domain/enums/Relation";
import { ReasonType } from "../../../../core/domain/enums/ReasonType";

describe("ECONOMIC_EFFECT_RELATION_MATRIX", () => {
  it("has an entry for every EconomicEffect value", () => {
    for (const effect of Object.values(EconomicEffect)) {
      expect(
        ECONOMIC_EFFECT_RELATION_MATRIX[effect],
        `Missing entry for ${effect}`,
      ).toBeDefined();
    }
  });

  it("CASH_IN allows only ORIGINATES and SETTLES", () => {
    const allowed = ECONOMIC_EFFECT_RELATION_MATRIX[EconomicEffect.CASH_IN];
    expect(allowed).toContain(Relation.ORIGINATES);
    expect(allowed).toContain(Relation.SETTLES);
    expect(allowed).toHaveLength(2);
    expect(allowed).not.toContain(Relation.REVERSES);
    expect(allowed).not.toContain(Relation.ADJUSTS);
  });

  it("CASH_OUT allows only ORIGINATES and SETTLES", () => {
    const allowed = ECONOMIC_EFFECT_RELATION_MATRIX[EconomicEffect.CASH_OUT];
    expect(allowed).toContain(Relation.ORIGINATES);
    expect(allowed).toContain(Relation.SETTLES);
    expect(allowed).toHaveLength(2);
  });

  it("CASH_INTERNAL allows only ADJUSTS", () => {
    const allowed =
      ECONOMIC_EFFECT_RELATION_MATRIX[EconomicEffect.CASH_INTERNAL];
    expect(allowed).toEqual([Relation.ADJUSTS]);
  });

  it("NON_CASH allows REVERSES (required for reversals)", () => {
    expect(
      ECONOMIC_EFFECT_RELATION_MATRIX[EconomicEffect.NON_CASH],
    ).toContain(Relation.REVERSES);
  });

  it("CONTINGENT does not allow SETTLES or REVERSES", () => {
    const allowed = ECONOMIC_EFFECT_RELATION_MATRIX[EconomicEffect.CONTINGENT];
    expect(allowed).not.toContain(Relation.SETTLES);
    expect(allowed).not.toContain(Relation.REVERSES);
  });
});

describe("OBJECT_NATURE_MATRIX", () => {
  it("classifies CONTRACT as CONTEXTUAL", () => {
    expect(OBJECT_NATURE_MATRIX[ObjectType.CONTRACT]).toBe(
      ObjectNature.CONTEXTUAL,
    );
  });

  it("classifies PROPOSAL as CONTEXTUAL", () => {
    expect(OBJECT_NATURE_MATRIX[ObjectType.PROPOSAL]).toBe(
      ObjectNature.CONTEXTUAL,
    );
  });

  it("classifies COMMISSION_RECEIVABLE as POSITIONAL", () => {
    expect(OBJECT_NATURE_MATRIX[ObjectType.COMMISSION_RECEIVABLE]).toBe(
      ObjectNature.POSITIONAL,
    );
  });

  it("classifies ADVANCE as POSITIONAL", () => {
    expect(OBJECT_NATURE_MATRIX[ObjectType.ADVANCE]).toBe(
      ObjectNature.POSITIONAL,
    );
  });

  it("classifies PENALTY as POSITIONAL", () => {
    expect(OBJECT_NATURE_MATRIX[ObjectType.PENALTY]).toBe(
      ObjectNature.POSITIONAL,
    );
  });
});

describe("OBJECT_RELATION_MATRIX", () => {
  it("COMMISSION_POOL allows ADJUSTS and REVERSES (corrections can reverse pool entries)", () => {
    expect(OBJECT_RELATION_MATRIX[ObjectType.COMMISSION_POOL]).toEqual([
      Relation.ADJUSTS,
      Relation.REVERSES,
    ]);
  });

  it("COMMISSION_ENTITLEMENT allows REVERSES", () => {
    expect(
      OBJECT_RELATION_MATRIX[ObjectType.COMMISSION_ENTITLEMENT],
    ).toContain(Relation.REVERSES);
  });

  it("CONTINGENT_CLAIM does not allow SETTLES", () => {
    expect(
      OBJECT_RELATION_MATRIX[ObjectType.CONTINGENT_CLAIM],
    ).not.toContain(Relation.SETTLES);
  });

  it("COMMISSION_RECEIVABLE is restricted to financial lifecycle relations", () => {
    expect(OBJECT_RELATION_MATRIX[ObjectType.COMMISSION_RECEIVABLE]).toEqual([
      Relation.ORIGINATES,
      Relation.ADJUSTS,
      Relation.SETTLES,
      Relation.REVERSES,
    ]);
  });
});

describe("REASON_EFFECT_MATRIX", () => {
  it("COMMISSION_PAYMENT is restricted to CASH_IN", () => {
    expect(REASON_EFFECT_MATRIX[ReasonType.COMMISSION_PAYMENT]).toEqual([
      EconomicEffect.CASH_IN,
    ]);
  });

  it("COMMISSION_SPLIT allows CASH_INTERNAL and CASH_OUT", () => {
    expect(REASON_EFFECT_MATRIX[ReasonType.COMMISSION_SPLIT]).toEqual([
      EconomicEffect.CASH_INTERNAL,
      EconomicEffect.CASH_OUT,
    ]);
  });

  it("COMMISSION_WAIVER is restricted to NON_CASH", () => {
    expect(REASON_EFFECT_MATRIX[ReasonType.COMMISSION_WAIVER]).toEqual([
      EconomicEffect.NON_CASH,
    ]);
  });

  it("LOAN_ORIGINATION is restricted to CASH_OUT", () => {
    expect(REASON_EFFECT_MATRIX[ReasonType.LOAN_ORIGINATION]).toEqual([
      EconomicEffect.CASH_OUT,
    ]);
  });

  it("LOAN_REPAYMENT is restricted to CASH_IN", () => {
    expect(REASON_EFFECT_MATRIX[ReasonType.LOAN_REPAYMENT]).toEqual([
      EconomicEffect.CASH_IN,
    ]);
  });

  it("PENALTY_PAYMENT is restricted to CASH_OUT", () => {
    expect(REASON_EFFECT_MATRIX[ReasonType.PENALTY_PAYMENT]).toEqual([
      EconomicEffect.CASH_OUT,
    ]);
  });

  it("DISPUTE_OPENED is restricted to CONTINGENT", () => {
    expect(REASON_EFFECT_MATRIX[ReasonType.DISPUTE_OPENED]).toEqual([
      EconomicEffect.CONTINGENT,
    ]);
  });

  it("PAYROLL_PAYMENT is restricted to CASH_OUT", () => {
    expect(REASON_EFFECT_MATRIX[ReasonType.PAYROLL_PAYMENT]).toEqual([
      EconomicEffect.CASH_OUT,
    ]);
  });

  it("MANUAL_CORRECTION is restricted to NON_CASH", () => {
    expect(REASON_EFFECT_MATRIX[ReasonType.MANUAL_CORRECTION]).toEqual([
      EconomicEffect.NON_CASH,
    ]);
  });

  it("LATE_AWARENESS has no effect constraint (polymorphic)", () => {
    expect(REASON_EFFECT_MATRIX[ReasonType.LATE_AWARENESS]).toBeUndefined();
  });

  it("UNKNOWN_ORIGIN has no effect constraint (polymorphic)", () => {
    expect(REASON_EFFECT_MATRIX[ReasonType.UNKNOWN_ORIGIN]).toBeUndefined();
  });
});

describe("REASON_RELATION_MATRIX", () => {
  it("COMMISSION_PAYMENT is restricted to SETTLES", () => {
    expect(REASON_RELATION_MATRIX[ReasonType.COMMISSION_PAYMENT]).toEqual([
      Relation.SETTLES,
    ]);
  });

  it("COMMISSION_SPLIT allows ADJUSTS, SETTLES, and ORIGINATES", () => {
    expect(REASON_RELATION_MATRIX[ReasonType.COMMISSION_SPLIT]).toEqual([
      Relation.ADJUSTS,
      Relation.SETTLES,
      Relation.ORIGINATES,
    ]);
  });

  it("COMMISSION_WAIVER allows SETTLES and REVERSES", () => {
    const allowed = REASON_RELATION_MATRIX[ReasonType.COMMISSION_WAIVER]!;
    expect(allowed).toContain(Relation.SETTLES);
    expect(allowed).toContain(Relation.REVERSES);
  });

  it("LOAN_ORIGINATION is restricted to ORIGINATES", () => {
    expect(REASON_RELATION_MATRIX[ReasonType.LOAN_ORIGINATION]).toEqual([
      Relation.ORIGINATES,
    ]);
  });

  it("LOAN_REPAYMENT is restricted to SETTLES", () => {
    expect(REASON_RELATION_MATRIX[ReasonType.LOAN_REPAYMENT]).toEqual([
      Relation.SETTLES,
    ]);
  });

  it("DEBT_RESTRUCTURING is restricted to ADJUSTS", () => {
    expect(REASON_RELATION_MATRIX[ReasonType.DEBT_RESTRUCTURING]).toEqual([
      Relation.ADJUSTS,
    ]);
  });

  it("ADVANCE_PAYMENT allows ORIGINATES, ADJUSTS, and SETTLES", () => {
    const allowed = REASON_RELATION_MATRIX[ReasonType.ADVANCE_PAYMENT]!;
    expect(allowed).toContain(Relation.ORIGINATES);
    expect(allowed).toContain(Relation.ADJUSTS);
    expect(allowed).toContain(Relation.SETTLES);
  });

  it("PENALTY_PAYMENT is restricted to SETTLES", () => {
    expect(REASON_RELATION_MATRIX[ReasonType.PENALTY_PAYMENT]).toEqual([
      Relation.SETTLES,
    ]);
  });

  it("PENALTY_RECOGNITION is restricted to ORIGINATES", () => {
    expect(REASON_RELATION_MATRIX[ReasonType.PENALTY_RECOGNITION]).toEqual([
      Relation.ORIGINATES,
    ]);
  });

  it("MANUAL_CORRECTION allows REVERSES and ADJUSTS", () => {
    const allowed = REASON_RELATION_MATRIX[ReasonType.MANUAL_CORRECTION]!;
    expect(allowed).toContain(Relation.REVERSES);
    expect(allowed).toContain(Relation.ADJUSTS);
  });

  it("LATE_AWARENESS has no relation constraint (polymorphic)", () => {
    expect(REASON_RELATION_MATRIX[ReasonType.LATE_AWARENESS]).toBeUndefined();
  });

  it("UNKNOWN_ORIGIN has no relation constraint (polymorphic)", () => {
    expect(REASON_RELATION_MATRIX[ReasonType.UNKNOWN_ORIGIN]).toBeUndefined();
  });
});
