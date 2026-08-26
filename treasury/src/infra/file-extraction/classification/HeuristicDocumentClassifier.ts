import type { DocumentClassifierPort } from "../../../core/application/ports/DocumentClassifierPort";
import type { RawContent, DocumentClassification, DocumentType } from "../../../core/application/dtos/ExtractionModels";

interface Rule {
  type: DocumentType;
  keywords: RegExp;
  confidence: number;
}

/** Checked in order — first match wins, most specific keywords first. */
const RULES: Rule[] = [
  { type: "pix_receipt", keywords: /\bpix\b/i, confidence: 0.85 },
  { type: "ted_receipt", keywords: /\bted\b/i, confidence: 0.8 },
  { type: "doc_receipt", keywords: /\bdoc\b/i, confidence: 0.6 },
  // A DAS/DARF/GPS-style tax payment slip. Checked before "boleto" and "invoice" — it shares
  // vocabulary with both (it's a payment slip that may mention "Simples Nacional") but the party
  // printed on it is whoever OWES the tax, never the counterparty, so it needs its own document
  // type: `HeuristicFieldExtractor` skips name-based counterparty extraction entirely for it.
  {
    type: "tax_document",
    keywords: /documento de arrecada[cç][aã]o|\bdarf\b|\bpgfn\b|guia de recolhimento|\bdas-mei\b/i,
    confidence: 0.85,
  },
  { type: "boleto", keywords: /boleto|linha digit[aá]vel|cedente|sacado/i, confidence: 0.85 },
  { type: "invoice", keywords: /nota fiscal|nf-?e|nfs-?e|danfe|danfse/i, confidence: 0.85 },
  { type: "bank_statement", keywords: /extrato|saldo (do dia|anterior)/i, confidence: 0.7 },
  { type: "receipt", keywords: /recibo|comprovante/i, confidence: 0.55 },
];

/**
 * Heuristic (keyword/regex) classifier — decoupled from both format adapters and field
 * extraction. The first swap target for an AI-based implementation once accuracy needs to
 * improve; `DocumentExtractionService` is unaware of which kind is in use.
 */
export class HeuristicDocumentClassifier implements DocumentClassifierPort {
  classify(content: RawContent): DocumentClassification {
    for (const rule of RULES) {
      if (rule.keywords.test(content.text)) return { documentType: rule.type, confidence: rule.confidence };
    }
    return { documentType: "generic", confidence: 0.3 };
  }
}
