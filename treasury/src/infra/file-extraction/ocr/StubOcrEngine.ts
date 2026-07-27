import type { OcrEnginePort } from "../../../core/application/ports/OcrEnginePort";

/**
 * Deterministic stand-in OCR engine — returns representative recognized text regardless of the
 * actual image content, matching this codebase's existing stub-adapter convention (the Ledger
 * integration itself is 100% stubbed the same way today). Swap for a real OCR library or an AI
 * vision call by implementing `OcrEnginePort` and changing one line in `src/index.ts` —
 * `ImageFormatAdapter` and everything downstream never needs to change.
 */
export class StubOcrEngine implements OcrEnginePort {
  async recognize(_image: Buffer): Promise<{ text: string; confidence?: number }> {
    return {
      text: [
        "Comprovante de transferência PIX",
        "Valor: R$ 1.250,00",
        "Data: 20/07/2026",
        "Favorecido: Fornecedor Sul Distribuidora Ltda",
        "Chave PIX: 34.567.891/0001-12",
      ].join("\n"),
      confidence: 0.62,
    };
  }
}
