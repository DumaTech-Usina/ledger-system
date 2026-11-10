import { describe, it, expect } from "vitest";
import { allOf, creditAllocations, creditTotals } from "./creditForm";

describe("crédito da seguradora — contas do formulário", () => {
  it("distribuído e o que sobra sem origem, em centavos", () => {
    expect(creditTotals({ creditDigits: "340000", allocations: { a: "12877", b: "100000", c: "217123" } })).toEqual({
      distributed: "3300.00",
      unattributed: "100.00",
      over: false,
    });
  });

  it("distribuir mais do que o crédito é sinalizado, sem sobra negativa", () => {
    expect(creditTotals({ creditDigits: "100000", allocations: { a: "150000" } })).toEqual({
      distributed: "1500.00",
      unattributed: "0.00",
      over: true,
    });
  });

  it("só envia o que foi preenchido, no formato do Ledger", () => {
    expect(creditAllocations({ creditDigits: "1", allocations: { a: "12877", b: "", c: "0" } })).toEqual([
      { objectId: "a", amount: "128.77" },
    ]);
  });

  it("'Tudo' preenche o aberto; aberto desconhecido não preenche", () => {
    expect(allOf("1000.00")).toBe("100000");
    expect(allOf(null)).toBe("");
  });
});
