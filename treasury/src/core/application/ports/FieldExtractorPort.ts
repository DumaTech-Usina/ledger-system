import type { RawContent, DocumentClassification, FieldExtractionOutcome } from "../dtos/ExtractionModels";

/**
 * Finds counterparty/amount/date in the classified raw text. A heuristic (regex/keyword)
 * implementation is used today; an AI-backed implementation can replace it later without the
 * orchestrating service or any format adapter changing.
 */
export interface FieldExtractorPort {
  extractFields(content: RawContent, classification: DocumentClassification): FieldExtractionOutcome;
}
