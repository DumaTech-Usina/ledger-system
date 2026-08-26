import { describe, it, expect } from "vitest";
import { HeuristicDocumentClassifier } from "../../../infra/file-extraction/classification/HeuristicDocumentClassifier";

const classifier = new HeuristicDocumentClassifier();
const classify = (text: string) => classifier.classify({ text });

describe("HeuristicDocumentClassifier", () => {
  it("classifies a DAS/Simples Nacional payment slip as tax_document, not boleto", () => {
    const outcome = classify(
      "Documento de Arrecadação\ndo Simples Nacional\nPGFN-SISPAR:015040892.PAGAR ATE O VENCIMENTO",
    );
    expect(outcome.documentType).toBe("tax_document");
  });

  it("classifies a DARF as tax_document", () => {
    expect(classify("Documento de Arrecadação de Receitas Federais - DARF").documentType).toBe("tax_document");
  });

  it("classifies an NFS-e/DANFSe as invoice, even without the literal phrase 'nota fiscal'", () => {
    const outcome = classify("DANFSe v1.0\nDocumento Auxiliar da NFS-e\nChave de Acesso da NFS-e");
    expect(outcome.documentType).toBe("invoice");
  });

  it("still classifies a traditional NF-e as invoice", () => {
    expect(classify("DANFE - Documento Auxiliar da Nota Fiscal Eletrônica").documentType).toBe("invoice");
  });

  it("falls back to generic when nothing matches", () => {
    expect(classify("Um documento qualquer sem palavras-chave conhecidas.").documentType).toBe("generic");
  });
});
