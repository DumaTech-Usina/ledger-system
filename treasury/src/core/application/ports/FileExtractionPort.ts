import type { RawDocument, ExtractionResult } from "../dtos/ExtractionModels";

/**
 * The ONE boundary the rest of the application ever talks to for document extraction. Nothing
 * outside this port + its implementation may import an OCR/PDF/CSV/XML/parsing library — the
 * Operations Chat only ever hands over a file and gets a standardized result back.
 */
export interface FileExtractionPort {
  extract(file: RawDocument): Promise<ExtractionResult>;
}
