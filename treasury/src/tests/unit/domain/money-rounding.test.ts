import { describe, it, expect } from "vitest";
import { roundNbr5891 } from "../../../core/domain/services/MoneyRounding";

describe("CA-221b — arredondamento pela ABNT NBR 5891", () => {
  it.each([
    ["10.124", "10.12", "abaixo de 5, mantém"],
    ["10.126", "10.13", "acima de 5, soma 1"],
    ["10.1251", "10.13", "5 seguido de algo diferente de zero, soma 1"],
    ["10.125", "10.12", "5 seguido só de zeros, com o último par, mantém"],
    ["10.1250", "10.12", "zeros depois do 5 não mudam a regra"],
    ["10.135", "10.14", "5 seguido só de zeros, com o último ímpar, soma 1"],
  ])("%s → %s (%s)", (value, expected) => {
    expect(roundNbr5891(value)).toBe(expected);
  });

  it("carrega para a casa seguinte", () => {
    expect(roundNbr5891("9.995")).toBe("10.00");
    expect(roundNbr5891("999.999")).toBe("1000.00");
  });

  it("não perde precisão em valores grandes", () => {
    expect(roundNbr5891("90071992547409.936")).toBe("90071992547409.94");
  });

  it("pode chegar a zero; decidir o que fazer com isso é de quem chama", () => {
    expect(roundNbr5891("0.004")).toBe("0.00");
  });
});
