import type { FileExtractionPort } from "../ports/FileExtractionPort";
import type { RawDocument, ExtractedDocument } from "../dtos/DocumentExtractionModels";

/**
 * Thin orchestration for now: delegates entirely to whichever FileExtractionPort adapter is
 * wired in. This is where field rules/validation land once the target fields are defined —
 * intentionally a pass-through until then.
 */
export class ExtractDocumentDataUseCase {
  constructor(private readonly extractor: FileExtractionPort) {}

  async execute(file: RawDocument): Promise<ExtractedDocument> {
    return this.extractor.extract(file);
  }
}
