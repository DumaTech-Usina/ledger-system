import { describe, expect, it } from "vitest";
import { Money } from "../../../../core/domain/value-objects/Money";

describe("Money", () => {
  // ============================
  // fromDecimal
  // ============================
  describe("fromDecimal", () => {
    it("creates from integer string", () => {
      expect(Money.fromDecimal("100", "BRL").toString()).toBe("100.00");
    });

    it("creates from 1-decimal string", () => {
      expect(Money.fromDecimal("100.5", "BRL").toString()).toBe("100.50");
    });

    it("creates from 2-decimal string", () => {
      expect(Money.fromDecimal("100.99", "BRL").toString()).toBe("100.99");
    });

    it("creates zero value", () => {
      expect(Money.fromDecimal("0", "BRL").isZero()).toBe(true);
    });

    it("throws for 3 decimal places", () => {
      expect(() => Money.fromDecimal("100.123", "BRL")).toThrow(
        "Invalid decimal format",
      );
    });

    it("throws for negative value", () => {
      expect(() => Money.fromDecimal("-10", "BRL")).toThrow(
        "Invalid decimal format",
      );
    });

    it("throws for empty string", () => {
      expect(() => Money.fromDecimal("", "BRL")).toThrow("Invalid decimal format");
    });

    it("throws for non-numeric string", () => {
      expect(() => Money.fromDecimal("abc", "BRL")).toThrow(
        "Invalid decimal format",
      );
    });

    it("throws for lowercase currency", () => {
      expect(() => Money.fromDecimal("100", "brl")).toThrow(
        "Invalid currency format",
      );
    });

    it("throws for 2-letter currency", () => {
      expect(() => Money.fromDecimal("100", "BR")).toThrow(
        "Invalid currency format",
      );
    });

    it("throws for numeric currency", () => {
      expect(() => Money.fromDecimal("100", "123")).toThrow(
        "Invalid currency format",
      );
    });
  });

  // ============================
  // zero
  // ============================
  describe("zero", () => {
    it("creates zero with default BRL currency", () => {
      const m = Money.zero();
      expect(m.isZero()).toBe(true);
      expect(m.currency).toBe("BRL");
    });

    it("creates zero with specified currency", () => {
      const m = Money.zero("USD");
      expect(m.isZero()).toBe(true);
      expect(m.currency).toBe("USD");
    });
  });

  // ============================
  // add
  // ============================
  describe("add", () => {
    it("sums two values", () => {
      const a = Money.fromDecimal("100.00", "BRL");
      const b = Money.fromDecimal("50.50", "BRL");
      expect(a.add(b).toString()).toBe("150.50");
    });

    it("adds zero without changing value", () => {
      const a = Money.fromDecimal("200.00", "BRL");
      expect(a.add(Money.zero("BRL")).toString()).toBe("200.00");
    });

    it("throws on currency mismatch", () => {
      const a = Money.fromDecimal("100", "BRL");
      const b = Money.fromDecimal("100", "USD");
      expect(() => a.add(b)).toThrow("Currency mismatch");
    });
  });

  // ============================
  // subtract
  // ============================
  describe("subtract", () => {
    it("subtracts smaller from larger", () => {
      const a = Money.fromDecimal("100.00", "BRL");
      const b = Money.fromDecimal("30.00", "BRL");
      expect(a.subtract(b).toString()).toBe("70.00");
    });

    it("allows subtracting to exact zero", () => {
      const a = Money.fromDecimal("100.00", "BRL");
      expect(a.subtract(a).isZero()).toBe(true);
    });

    it("throws when result would be negative", () => {
      const a = Money.fromDecimal("10.00", "BRL");
      const b = Money.fromDecimal("20.00", "BRL");
      expect(() => a.subtract(b)).toThrow("negative");
    });

    it("throws on currency mismatch", () => {
      const a = Money.fromDecimal("100", "BRL");
      const b = Money.fromDecimal("50", "USD");
      expect(() => a.subtract(b)).toThrow("Currency mismatch");
    });
  });

  // ============================
  // equals
  // ============================
  describe("equals", () => {
    it("returns true for identical value and currency", () => {
      const a = Money.fromDecimal("100.00", "BRL");
      const b = Money.fromDecimal("100.00", "BRL");
      expect(a.equals(b)).toBe(true);
    });

    it("returns false for different amounts", () => {
      expect(
        Money.fromDecimal("100", "BRL").equals(Money.fromDecimal("200", "BRL")),
      ).toBe(false);
    });

    it("returns false for different currencies", () => {
      expect(
        Money.fromDecimal("100", "BRL").equals(Money.fromDecimal("100", "USD")),
      ).toBe(false);
    });
  });

  // ============================
  // greaterThan
  // ============================
  describe("greaterThan", () => {
    it("returns true when this is greater", () => {
      expect(
        Money.fromDecimal("200", "BRL").greaterThan(Money.fromDecimal("100", "BRL")),
      ).toBe(true);
    });

    it("returns false when equal", () => {
      const a = Money.fromDecimal("100", "BRL");
      expect(a.greaterThan(a)).toBe(false);
    });

    it("returns false when smaller", () => {
      expect(
        Money.fromDecimal("50", "BRL").greaterThan(Money.fromDecimal("100", "BRL")),
      ).toBe(false);
    });

    it("throws on currency mismatch", () => {
      expect(() =>
        Money.fromDecimal("100", "BRL").greaterThan(Money.fromDecimal("50", "USD")),
      ).toThrow("Currency mismatch");
    });
  });

  // ============================
  // isZero
  // ============================
  describe("isZero", () => {
    it("returns true for zero", () => {
      expect(Money.zero().isZero()).toBe(true);
    });

    it("returns false for non-zero", () => {
      expect(Money.fromDecimal("0.01", "BRL").isZero()).toBe(false);
    });
  });

  // ============================
  // toString / toJSON
  // ============================
  describe("serialization", () => {
    it("toString formats with 2 decimal places", () => {
      expect(Money.fromDecimal("1", "BRL").toString()).toBe("1.00");
      expect(Money.fromDecimal("1.5", "BRL").toString()).toBe("1.50");
      expect(Money.fromDecimal("1.99", "BRL").toString()).toBe("1.99");
    });

    it("toJSON returns the same as toString", () => {
      const m = Money.fromDecimal("500.25", "BRL");
      expect(m.toJSON()).toBe(m.toString());
    });
  });

  // ============================
  // fromUnits
  // ============================
  describe("fromUnits", () => {
    it("creates from bigint units (scale=2)", () => {
      // 10000 units = 100.00 BRL
      expect(Money.fromUnits(10000n, "BRL").toString()).toBe("100.00");
    });

    it("throws for negative units", () => {
      expect(() => Money.fromUnits(-1n, "BRL")).toThrow("negative");
    });
  });

  // ============================
  // Invariant: Money is never negative (Critical)
  // ============================
  describe("financial invariant — never negative", () => {
    it("cannot be created with negative fromDecimal", () => {
      expect(() => Money.fromDecimal("-0.01", "BRL")).toThrow();
    });

    it("cannot be created with negative fromUnits", () => {
      expect(() => Money.fromUnits(-100n, "BRL")).toThrow();
    });

    it("subtraction cannot produce negative", () => {
      expect(() =>
        Money.fromDecimal("1.00", "BRL").subtract(Money.fromDecimal("1.01", "BRL")),
      ).toThrow();
    });
  });
});
