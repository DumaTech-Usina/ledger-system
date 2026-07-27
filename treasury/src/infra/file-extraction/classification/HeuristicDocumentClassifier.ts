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
  { type: "boleto", keywords: /boleto|linha digit[aá]vel|cedente|sacado/i, confidence: 0.85 },
  { type: "invoice", keywords: /nota fiscal|nf-?e|danfe/i, confidence: 0.85 },
  { type: "bank_statement", keywords: /extrato|saldo (do dia|anterior)/i, confidence: 0.7 },
  { type: "receipt", keywords: /recibo|comprovante/i, confidence: 0.55 },
];

/**
 * Heuristic (keyword/regex) classifier — decoupled from both format adapters and field
 * extraction, per the plan's requirement. The first swap target for an AI-based implementation
 * once accuracy needs to improve; `DocumentExtractionService` is unaware of which kind is in use.
 */
export class HeuristicDocumentClassifier implements DocumentClassifierPort {
  classify(content: RawContent): DocumentClassification {
    for (const rule of RULES) {
      if (rule.keywords.test(content.text)) return { documentType: rule.type, confidence: rule.confidence };
    }
    return { documentType: "generic", confidence: 0.3 };
  }
}
