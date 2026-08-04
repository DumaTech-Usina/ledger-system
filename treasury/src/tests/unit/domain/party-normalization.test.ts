import { describe, it, expect } from "vitest";
import {
  editDistance,
  normalizeDocument,
  normalizeName,
  similarity,
} from "../../../core/domain/services/PartyNormalization";

describe("normalizeName", () => {
  it("folds case, accents and punctuation to one key", () => {
    expect(normalizeName("Fornecedor Alfa")).toBe("fornecedor alfa");
    expect(normalizeName("FORNECEDOR ALFA")).toBe("fornecedor alfa");
    expect(normalizeName("Fornecedôr  Alfa!")).toBe("fornecedor alfa");
  });

  it("strips trailing corporate suffixes", () => {
    expect(normalizeName("Alfa Ltda")).toBe("alfa");
    expect(normalizeName("Alfa LTDA.")).toBe("alfa");
    expect(normalizeName("Alfa S.A.")).toBe("alfa");
    expect(normalizeName("Alfa EIRELI")).toBe("alfa");
  });

  it("strips stacked suffixes", () => {
    expect(normalizeName("Alfa S.A. ME")).toBe("alfa");
  });

  it("keeps a name that is only a suffix rather than emptying it", () => {
    expect(normalizeName("Ltda")).toBe("ltda");
  });

  it("does not strip a suffix that is part of the name itself", () => {
    expect(normalizeName("Meta Sistemas")).toBe("meta sistemas");
  });

  it("is idempotent — normalizing an already-normalized name changes nothing", () => {
    const once = normalizeName("Fornecedor Alfa Ltda.");
    expect(normalizeName(once)).toBe(once);
  });

  it("reduces the four spellings that fragment identity today to a single key", () => {
    const keys = ["Fornecedor Alfa", "fornecedor alfa", "FORNECEDOR ALFA", "Fornecedor Alfa Ltda"];
    expect(new Set(keys.map(normalizeName)).size).toBe(1);
  });
});

describe("normalizeDocument", () => {
  it("reduces a document to its digits", () => {
    expect(normalizeDocument("12.345.678/0001-99")).toBe("12345678000199");
    expect(normalizeDocument("123.456.789-00")).toBe("12345678900");
  });

  it("agrees between punctuated and bare forms", () => {
    expect(normalizeDocument("12.345.678/0001-99")).toBe(normalizeDocument("12345678000199"));
  });
});

describe("editDistance", () => {
  it("is zero for identical strings", () => {
    expect(editDistance("alfa", "alfa")).toBe(0);
  });

  it("counts single-character edits", () => {
    expect(editDistance("alfa", "alfia")).toBe(1);
    expect(editDistance("alfa", "alga")).toBe(1);
  });

  it("degrades to length when one side is empty", () => {
    expect(editDistance("", "alfa")).toBe(4);
    expect(editDistance("alfa", "")).toBe(4);
  });

  it("is symmetric", () => {
    expect(editDistance("alfa", "beta")).toBe(editDistance("beta", "alfa"));
  });
});

describe("similarity", () => {
  it("is 1 for an exact match", () => {
    expect(similarity("alfa", "alfa")).toBe(1);
  });

  it("weighs one typo more heavily in a short name than in a long one", () => {
    const short = similarity("alfa", "alga");
    const long = similarity("fornecedor alfa", "fornecedor alga");
    expect(short).toBeLessThan(long);
  });

  it("stays within [0, 1]", () => {
    for (const [a, b] of [["alfa", "beta"], ["", "alfa"], ["alfa", ""], ["", ""]]) {
      const s = similarity(a, b);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });
});
