/**
 * Document-extraction DTOs. Money is a decimal string and dates are ISO strings — never a native
 * `number`/`Date` — to match every other money/date value in this codebase (`Candidate.amount`,
 * `SlotValue`, etc.) and so a result flows into `ApplyAnswersUseCase` with zero conversion. Never
 * import an OCR/parsing library's own types here — this file is the neutral contract every adapter
 * must translate into.
 */

/** A file as it arrives at the extraction boundary — already read into memory by the HTTP layer. */
export interface RawDocument {
  buffer: Buffer;
  mimeType: string;
  filename: string;
}

/** What `DocumentFormatAdapter.extractRawContent` produces — plain text plus whatever the adapter noticed. */
export interface RawContent {
  text: string;
  metadata?: Record<string, unknown>;
}

export type DocumentType =
  | "pix_receipt"
  | "ted_receipt"
  | "doc_receipt"
  | "boleto"
  | "invoice"
  | "tax_document"
  | "bank_statement"
  | "receipt"
  | "generic";

export interface DocumentClassification {
  documentType: DocumentType;
  confidence?: number;
}

export interface ExtractedFieldData {
  counterparty?: string;
  amount?: string;
  date?: string;
  /** ISO 4217 code, e.g. "BRL"/"USD" — inferred from currency symbols/labels in the document. */
  currency?: string;
  /** A free-text memo/note line, when the document has one (e.g. "Descrição:", "Histórico:"). */
  description?: string;
}

export interface FieldExtractionOutcome {
  data: ExtractedFieldData;
  confidence?: { counterparty?: number; amount?: number; date?: number; currency?: number; description?: number };
  warnings?: string[];
}

/**
 * The single standardized result every format adapter/pipeline run produces, regardless of file
 * type. `success` is false only for a fatal failure (unsupported format, corrupted file, OCR
 * failure) — a partial extraction (some fields found, others not) is still `success: true`, with
 * the gaps explained in `warnings`.
 */
export interface ExtractionResult {
  success: boolean;
  documentType?: DocumentType;
  data: ExtractedFieldData;
  confidence?: { counterparty?: number; amount?: number; date?: number; currency?: number; description?: number };
  warnings?: string[];
  errors?: string[];
  rawText?: string;
  metadata?: Record<string, unknown>;
}
