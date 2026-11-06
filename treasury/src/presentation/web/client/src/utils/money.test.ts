import { describe, it, expect } from "vitest";
import { amountDigits, amountFromDigits, digitsFromAmount, maskedAmount } from "@/utils/money";

const shown = (typed: string) => maskedAmount(amountDigits(typed));

describe("REQ-224 — máscara do campo de valor", () => {
  it.each([
    ["5", "R$ 0,05"],
    ["2000", "R$ 20,00"],
    ["200000", "R$ 2.000,00"],
    ["150050", "R$ 1.500,50"],
    ["15005", "R$ 150,05"], // CA-220
    ["100000000000", "R$ 1.000.000.000,00"], // sem teto
  ])("os dígitos %s mostram %s", (typed, expected) => {
    expect(shown(typed)).toBe(expected);
  });

  it("REJ-224: 2000 nunca é R$ 2.000,00", () => {
    expect(shown("2000")).not.toBe("R$ 2.000,00");
  });

  it("digitar sobre o que o campo já mostra acrescenta à direita", () => {
    expect(shown("R$ 20,00" + "5")).toBe("R$ 200,05");
  });

  it("apagar o último caractere tira o último dígito", () => {
    expect(shown("R$ 20,0")).toBe("R$ 2,00");
  });

  it("ignora o que não é dígito e zeros à esquerda", () => {
    expect(amountDigits("abc0012x")).toBe("12");
    expect(shown("abc0012x")).toBe("R$ 0,12");
  });

  it("não sobra dígito de um campo vazio", () => {
    expect(amountDigits("R$ 0,00")).toBe("");
    expect(maskedAmount("")).toBe("R$ 0,00");
  });
});

describe("REQ-228 — o que sai do campo", () => {
  it.each([
    ["150050", "1500.50"],
    ["5", "0.05"],
    ["2000", "20.00"],
    ["123456789012345678", "1234567890123456.78"], // sem perder precisão
  ])("os dígitos %s saem como %s, sem vírgula nem R$", (digits, expected) => {
    expect(amountFromDigits(digits)).toBe(expected);
  });

  it.each([
    ["1500.50", "150050"],
    ["1500.5", "150050"],
    ["1500", "150000"],
  ])("um valor gravado, %s, volta ao campo como %s", (amount, digits) => {
    expect(digitsFromAmount(amount)).toBe(digits);
    expect(digitsFromAmount(amountFromDigits(digits))).toBe(digits);
  });

  it("um valor ilegível deixa o campo vazio, sem inventar um número", () => {
    expect(digitsFromAmount("abc")).toBe("");
  });
});
