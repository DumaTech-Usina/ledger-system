import { describe, it, expect } from "vitest";
import { HeuristicFieldExtractor } from "../../../infra/file-extraction/fields/HeuristicFieldExtractor";

const extractor = new HeuristicFieldExtractor();
const classification = { documentType: "generic" as const };
const extract = (text: string) => extractor.extractFields({ text }, classification);

describe("HeuristicFieldExtractor date extraction", () => {
  it("prefers an explicit payment-date label at high confidence", () => {
    const outcome = extract("Data de pagamento: 20/07/2026\nVencimento: 01/07/2026");
    expect(outcome.data.date).toBe("2026-07-20");
    expect(outcome.confidence?.date).toBeGreaterThanOrEqual(0.85);
    expect(outcome.warnings ?? []).toHaveLength(0);
  });

  it("treats a bare 'Data:' label as the payment date (simple receipts have only one date)", () => {
    const outcome = extract("Comprovante de PIX\nData: 20/07/2026\nValor: R$ 100,00");
    expect(outcome.data.date).toBe("2026-07-20");
    expect(outcome.confidence?.date).toBeGreaterThanOrEqual(0.85);
  });

  it.each([
    ["Realizado em: 20/07/2026"],
    ["Transferido em: 20/07/2026"],
    ["Efetivado em: 20/07/2026"],
    ["Concluído em: 20/07/2026"],
    ["Data da operação: 20/07/2026"],
  ])("recognizes Brazilian bank receipt wording: %s", (line) => {
    const outcome = extract(`Comprovante de TED\n${line}\nVencimento: 01/07/2026`);
    expect(outcome.data.date).toBe("2026-07-20");
    expect(outcome.confidence?.date).toBeGreaterThanOrEqual(0.85);
  });

  it.each([
    ["Payment date: 20/07/2026"],
    ["Transferred on: 20/07/2026"],
    ["Value date: 20/07/2026"],
    ["Date completed: 20/07/2026"],
  ])("recognizes foreign bank wording: %s", (line) => {
    const outcome = extract(`Wire transfer receipt\n${line}\nDue date: 01/07/2026`);
    expect(outcome.data.date).toBe("2026-07-20");
    expect(outcome.confidence?.date).toBeGreaterThanOrEqual(0.85);
  });

  it("falls back to emissão at medium confidence, with a warning", () => {
    const outcome = extract("Nota fiscal\nData de emissão: 05/07/2026\nVencimento: 20/07/2026");
    expect(outcome.data.date).toBe("2026-07-05");
    expect(outcome.confidence?.date).toBe(0.5);
    expect(outcome.warnings?.[0]).toMatch(/emissão/i);
  });

  it("never picks vencimento or período, even when they appear first in the text", () => {
    const outcome = extract("Vencimento: 01/07/2026\nPeríodo de referência: 01/06/2026\nSem outra data.");
    expect(outcome.data.date).toBeUndefined();
  });

  it("uses an unlabeled bare date only as a last resort, flagged at low confidence", () => {
    const outcome = extract("Documento genérico\nReferência 20/07/2026 sem rótulo.");
    expect(outcome.data.date).toBe("2026-07-20");
    expect(outcome.confidence?.date).toBe(0.3);
    expect(outcome.warnings?.[0]).toMatch(/sem rótulo/i);
  });
});

describe("HeuristicFieldExtractor currency extraction", () => {
  it("infers BRL from the R$ symbol", () => {
    const outcome = extract("Comprovante de PIX\nValor: R$ 1.250,00");
    expect(outcome.data.currency).toBe("BRL");
  });

  it("infers USD from the US$ symbol or the word USD", () => {
    expect(extract("Invoice\nAmount: US$ 1,250.00").data.currency).toBe("USD");
    expect(extract("Invoice\nCurrency: USD\nAmount: 1,250.00").data.currency).toBe("USD");
  });

  it("prefers an explicit 'Moeda:' label over symbol-sniffing", () => {
    const outcome = extract("Moeda: USD\nValor: R$ 1.250,00");
    expect(outcome.data.currency).toBe("USD");
  });

  it("returns undefined when there's no currency signal at all", () => {
    expect(extract("Documento genérico sem valores.").data.currency).toBeUndefined();
  });
});

describe("HeuristicFieldExtractor description extraction", () => {
  it("captures a labeled description/memo line", () => {
    const outcome = extract("Descrição: Pagamento de consultoria mensal\nValor: R$ 500,00");
    expect(outcome.data.description).toBe("Pagamento de consultoria mensal");
    expect(outcome.confidence?.description).toBeGreaterThan(0);
  });

  it("returns undefined when the document has no description/memo line", () => {
    const outcome = extract("Comprovante de PIX\nValor: R$ 500,00");
    expect(outcome.data.description).toBeUndefined();
  });
});
