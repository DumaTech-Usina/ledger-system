import type { DocumentFormatAdapter } from "../../../core/application/ports/DocumentFormatAdapter";
import type { OcrEnginePort } from "../../../core/application/ports/OcrEnginePort";
import type { RawDocument, RawContent } from "../../../core/application/dtos/ExtractionModels";

const IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

/**
 * Depends only on `OcrEnginePort` — never imports an OCR library directly. Swapping the engine (a
 * real OCR library, an AI vision call, or OCR+AI hybrid) later is a new `OcrEnginePort`
 * implementation plus one line in the composition root; this adapter never changes.
 */
export class ImageFormatAdapter implements DocumentFormatAdapter {
  constructor(private readonly ocr: OcrEnginePort) {}

  supports(mimeType: string): boolean {
    return IMAGE_MIME_TYPES.has(mimeType);
  }

  async extractRawContent(file: RawDocument): Promise<RawContent> {
    const { text, confidence } = await this.ocr.recognize(file.buffer);
    return { text, metadata: { ocrConfidence: confidence } };
  }
}
