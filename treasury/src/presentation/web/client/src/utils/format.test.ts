import { describe, it, expect } from "vitest";
import { formatDocument } from "@/utils/format";

describe("formatDocument", () => {
  it("punctuates a CPF once all eleven digits are there", () => {
    expect(formatDocument("12345678901")).toBe("123.456.789-01");
  });

  it("punctuates a CNPJ once all fourteen digits are there", () => {
    expect(formatDocument("12345678000199")).toBe("12.345.678/0001-99");
  });

  it("grows the mask only as far as the digits reach", () => {
    // A half-typed number is never punctuated as if it were complete.
    expect(formatDocument("123")).toBe("123");
    expect(formatDocument("1234")).toBe("123.4");
    expect(formatDocument("1234567")).toBe("123.456.7");
    expect(formatDocument("1234567890")).toBe("123.456.789-0");
  });

  it("switches from CPF to CNPJ shape on the twelfth digit", () => {
    expect(formatDocument("12345678901")).toBe("123.456.789-01");
    expect(formatDocument("123456789012")).toBe("12.345.678/9012");
  });

  it("ignores separators the user types themselves, so a paste re-masks cleanly", () => {
    expect(formatDocument("123.456.789-01")).toBe("123.456.789-01");
    expect(formatDocument("12.345.678/0001-99")).toBe("12.345.678/0001-99");
  });

  it("drops anything past fourteen digits rather than masking a number that cannot exist", () => {
    expect(formatDocument("123456780001999999")).toBe("12.345.678/0001-99");
  });

  it("returns empty for input with no digits at all", () => {
    expect(formatDocument("abc")).toBe("");
  });
});
