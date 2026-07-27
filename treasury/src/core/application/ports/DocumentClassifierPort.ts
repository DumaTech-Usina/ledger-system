import type { RawContent, DocumentClassification } from "../dtos/ExtractionModels";

/**
 * Decides what kind of document the raw text represents (PIX receipt, boleto, invoice, ...),
 * decoupled from both format adapters and field extraction. A heuristic (keyword/regex)
 * implementation is used today; an AI-backed implementation can replace it later — the service
 * that calls this port never changes.
 */
export interface DocumentClassifierPort {
  classify(content: RawContent): DocumentClassification;
}
