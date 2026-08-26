import { describe, it, expect } from "vitest";
import { HeuristicFieldExtractor } from "../../../infra/file-extraction/fields/HeuristicFieldExtractor";
import type { DocumentType } from "../../../core/application/dtos/ExtractionModels";

const extractor = new HeuristicFieldExtractor();
const classification = { documentType: "generic" as const };
const extract = (text: string) => extractor.extractFields({ text }, classification);
const extractAs = (text: string, documentType: DocumentType) =>
  extractor.extractFields({ text }, { documentType });

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

// A DAS-MEI/Simples Nacional payment slip's own taxpayer block, in roughly the order a linear PDF
// text extraction produces it — the CNPJ/razão social of whoever OWES the tax sits right at the top,
// nowhere near a "Razão Social:" label, which is exactly why counterparty extraction for a
// tax_document must never fall back to the generic name-label list.
const DAS_TEXT = [
  "Documento de Arrecadação",
  "do Simples Nacional",
  "38.463.524/0001-91 38.463.524 THALISSON FERREIRA DE LIMA ARAUJO",
  "Período de Apuração Data de Vencimento Número do Documento",
  "07.17.26212.3897750-8",
  "Pagar este documento até",
  "31/07/2026",
  "Observações",
  "PGFN-SISPAR:015040892.PAGAR ATE O VENCIMENTO DO DO",
  "CUMENTO DE ARRECADACAO",
  "Valor Total do Documento",
  "37,00",
  "CNPJ Razão Social",
  "Julho/2026 31/07/2026",
  "Código Denominação Principal Multa Juros Total",
  "Composição do Documento de Arrecadação",
  "1550 R D ATIVA - INSS - SIMPLES NACIONAL - MEI 20,51 4,10 12,39 37,00",
  "Totais 20,51 4,10 12,39 37,00",
].join("\n");

// An NFS-e/DANFSe's EMITENTE (service provider) and TOMADOR (client) blocks, in the order a linear
// PDF text extraction produces them — each is a "Nome / Nome Empresarial" sub-label a few lines
// below its own section header, with the actual value on the very next line.
const NFSE_TEXT = [
  "DANFSe v1.0",
  "Documento Auxiliar da NFS-e",
  "Chave de Acesso da NFS-e",
  "Competência da NFS-e",
  "02/07/2026",
  "EMITENTE DA NFS-e",
  "Prestador do Serviço",
  "CNPJ / CPF / NIF",
  "66.237.020/0001-99",
  "Inscrição Municipal",
  "-",
  "Telefone",
  "(81) 8351-8927",
  "Nome / Nome Empresarial",
  "66.237.020 THALISSON FERREIRA DE LIMA ARAUJO",
  "E-mail",
  "TFLAEMP@GMAIL.COM",
  "Simples Nacional na Data de Competência",
  "Optante - Microempreendedor Individual (MEI)",
  "TOMADOR DO SERVIÇO CNPJ / CPF / NIF",
  "05.293.486/0001-17",
  "Inscrição Municipal",
  "-",
  "Nome / Nome Empresarial",
  "USINA DO SEGURO ADMINISTRADORA E CORRETORA DE SEGUROS",
  "LTDA",
  "Descrição do Serviço",
  "Salário referente ao mês de Junho, mediante serviço de desenvolvimento de sistemas",
  "Valor do Serviço",
  "R$ 3.108,00",
  "Valor Líquido da NFS-e",
  "R$ 3.108,00",
].join("\n");

describe("HeuristicFieldExtractor counterparty extraction — tax documents", () => {
  it("names PGFN as the payee on an active-debt DAS, never the taxpayer printed on the slip", () => {
    const outcome = extractAs(DAS_TEXT, "tax_document");
    expect(outcome.data.counterparty).toBe("Procuradoria-Geral da Fazenda Nacional (PGFN)");
    expect(outcome.data.counterparty).not.toMatch(/thalisson/i);
  });

  it("names Receita Federal for a plain DARF with no PGFN mention", () => {
    const outcome = extractAs("Documento de Arrecadação de Receitas Federais\nDARF\nValor: 150,00", "tax_document");
    expect(outcome.data.counterparty).toBe("Receita Federal do Brasil");
  });

  it("names Receita Federal for a routine (non-active-debt) Simples Nacional DAS", () => {
    const outcome = extractAs("Documento de Arrecadação do Simples Nacional\nValor: 100,00", "tax_document");
    expect(outcome.data.counterparty).toBe("Receita Federal do Brasil");
  });

  it("falls back to INSS when nothing more specific is named", () => {
    const outcome = extractAs("Guia de Recolhimento\nContribuição ao INSS\nValor: 50,00", "tax_document");
    expect(outcome.data.counterparty).toBe("INSS");
  });

  it("names the municipality for a municipal tax guide", () => {
    const outcome = extractAs("Guia de Recolhimento\nPrefeitura Municipal de Recife\nISS a recolher", "tax_document");
    expect(outcome.data.counterparty).toBe("Prefeitura de Recife");
  });

  it("returns undefined rather than guessing when no known collector is named", () => {
    const outcome = extractAs("Guia de Recolhimento\nValor: 50,00", "tax_document");
    expect(outcome.data.counterparty).toBeUndefined();
  });
});

describe("HeuristicFieldExtractor counterparty extraction — NFS-e", () => {
  it("names the EMITENTE (service provider), not the TOMADOR (client, typically the usina itself)", () => {
    const outcome = extractAs(NFSE_TEXT, "invoice");
    expect(outcome.data.counterparty).toBe("THALISSON FERREIRA DE LIMA ARAUJO");
    expect(outcome.data.counterparty).not.toMatch(/usina do seguro/i);
  });

  it("strips a registration-code prefix some municipal templates glue onto the name field", () => {
    const outcome = extractAs(NFSE_TEXT, "invoice");
    expect(outcome.data.counterparty).not.toMatch(/^66\.237\.020/);
  });
});

describe("HeuristicFieldExtractor counterparty extraction — unchanged for ordinary receipts", () => {
  it("still matches the generic label list when there is no NFS-e block and it isn't a tax document", () => {
    const outcome = extract("Comprovante de PIX\nFavorecido: Fornecedor Sul Distribuidora Ltda\nValor: R$ 100,00");
    expect(outcome.data.counterparty).toBe("Fornecedor Sul Distribuidora Ltda");
  });
});

describe("HeuristicFieldExtractor amount extraction", () => {
  it("prefers the NFS-e's own labeled total over an unrelated number appearing earlier in the text", () => {
    const outcome = extractAs("Alíquota Aplicada\n5,00\nValor Líquido da NFS-e\nR$ 3.108,00", "invoice");
    expect(outcome.data.amount).toBe("3108.00");
  });

  it("prefers a DAS's labeled total over a composition-table line item appearing earlier", () => {
    const outcome = extractAs("Multa\n4,10\nValor Total do Documento\n37,00\nJuros\n12,39", "tax_document");
    expect(outcome.data.amount).toBe("37.00");
  });

  it("still falls back to the bare pattern when no labeled total is present", () => {
    const outcome = extract("Comprovante de PIX\nValor: R$ 1.250,00");
    expect(outcome.data.amount).toBe("1250.00");
  });
});

describe("HeuristicFieldExtractor date extraction — payment-slip due dates", () => {
  it("never treats 'pagar até' as the payment date, even as a last-resort bare-date guess", () => {
    const outcome = extract("Pagar este documento até\n31/07/2026");
    expect(outcome.data.date).toBeUndefined();
  });

  it("still finds a genuinely unlabeled date once 'pagar até' is excluded", () => {
    const outcome = extract("Pagar até: 31/07/2026\nGerado em 20/07/2026 às 10:00");
    expect(outcome.data.date).toBe("2026-07-20");
  });
});
