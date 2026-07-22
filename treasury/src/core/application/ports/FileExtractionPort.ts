import type { RawDocument, ExtractedDocument } from "../dtos/DocumentExtractionModels";

/**
 * Boundary between "getting fields out of a file" and everything downstream. One port, many
 * possible adapters (CSV, XLSX, OFX, PDF, ...) — the use-case, and any future domain rules, never
 * know which format produced the fields. Field selection/validation rules are PARKED for later;
 * this only reports what an adapter found.
 */
export interface FileExtractionPort {
  extract(file: RawDocument): Promise<ExtractedDocument>;
}
