/*
 * Extraction is intentionally shapeless right now: which fields matter per document type is a
 * decision that hasn't been made yet. Until then every adapter reports whatever it found as a
 * flat field/value map, so no one has to guess a schema they don't own.
 */
export interface RawDocument {
  fileName: string;
  mimeType: string;
  content: Buffer;
}

export interface ExtractedDocument {
  sourceFileName: string;
  /** Adapter-assigned tag (e.g. "csv", "ofx", "pdf") — a format hint, not a business classification. */
  documentType: string;
  fields: Record<string, string>;
  extractedAt: string;
}
