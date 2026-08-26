/**
 * Recognizes text in an image. `ImageFormatAdapter` depends on this port, never on a concrete OCR
 * library — swapping the engine (a real OCR library, an AI vision call, or a hybrid of the two)
 * later is a new implementation of this interface plus one line in the composition root.
 */
export interface OcrEnginePort {
  recognize(image: Buffer): Promise<{ text: string; confidence?: number }>;
}
