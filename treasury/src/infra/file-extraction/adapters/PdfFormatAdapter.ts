import { PDFParse } from "pdf-parse";
import type { DocumentFormatAdapter } from "../../../core/application/ports/DocumentFormatAdapter";
import type { RawDocument, RawContent } from "../../../core/application/dtos/ExtractionModels";

/**
 * Extracts a PDF's embedded text layer only. A scanned/image-only PDF (no text layer) is an
 * explicit scope cut for this pass — it returns empty text, which `DocumentExtractionService`
 * turns into a clear "no readable text" error rather than silently failing. Rasterizing pages to
 * images and running them through the same `OcrEnginePort` is a natural future adapter — it would
 * not require touching this class.
 */
export class PdfFormatAdapter implements DocumentFormatAdapter {
  supports(mimeType: string): boolean {
    return mimeType === "application/pdf";
  }

  async extractRawContent(file: RawDocument): Promise<RawContent> {
    const parser = new PDFParse({ data: file.buffer });
    try {
      const result = await parser.getText();
      return { text: result.text, metadata: { pageCount: result.pages?.length } };
    } finally {
      await parser.destroy();
    }
  }
}
