import type { RawDocument, RawContent } from "../dtos/ExtractionModels";

/**
 * Strategy interface for one file format. Each adapter knows only how to turn its own mime
 * type(s) into plain text — nothing about classification, field extraction, or the rest of the
 * pipeline. Adding a new format later is a new class implementing this interface, registered once
 * in the composition root (src/index.ts) — no existing adapter or the dispatching service changes.
 */
export interface DocumentFormatAdapter {
  supports(mimeType: string): boolean;
  extractRawContent(file: RawDocument): Promise<RawContent>;
}
