import type { FileExtractionPort } from "../ports/FileExtractionPort";
import type { RawDocument, ExtractedDocument } from "../dtos/DocumentExtractionModels";

/**
 * Single agnostic entry point for "get fields out of a file", meant to be used from anywhere in
 * the project (use-cases, routes, scripts, ...) without the caller ever knowing which file format
 * it's dealing with.
 *
 * This service is itself a `FileExtractionPort` — a composite/dispatcher one. It holds no parsing
 * logic; it only owns the format → adapter routing and delegates. The real work (CSV, XLSX, OFX,
 * PDF, images/photos via OCR, and whatever else shows up) lives in per-format adapters under
 * `infra/file-extraction/*`, each implementing `FileExtractionPort` on its own.
 *
 * Because it implements the same port it composes, anything already coded against
 * `FileExtractionPort` (see `ExtractDocumentDataUseCase`) can receive this service instead of a
 * single concrete adapter with zero changes on that side.
 *
 * NOTHING BELOW IS FUNCTIONAL YET — this is scaffolding. Left as comments for later:
 *
 * - Registration: right now adapters come in as a `mimeType -> adapter` map via the constructor.
 *   Decide later whether that's still right once real adapters exist, or whether this wants a
 *   `register(mimeType, adapter)` method / DI-container wiring instead.
 *
 * - Selection key: mime type is the naive lookup key. It won't be enough on its own — e.g. photos
 *   can arrive as image/jpeg or image/png and both should probably resolve to the same OCR
 *   adapter, and some uploads may arrive with a generic/missing mime type where the real format
 *   has to be sniffed from the file extension or magic bytes instead.
 *
 * - Common formats this needs to cover once adapters exist: CSV, XLSX/Excel, OFX, PDF, and
 *   photos/images (JPEG, PNG, ...) via OCR. Confirm the final list before wiring adapters.
 *
 * - Unsupported format behavior: currently throws. PARKED — decide whether unsupported mime types
 *   should fail hard, fall back to a best-effort/generic adapter, or surface a specific
 *   "unsupported format" result the caller can show the user.
 *
 * - Field extraction rules (which fields matter, validation, normalization across adapters) are
 *   explicitly OUT of scope here — that lands in the use-case / domain layer later, once the
 *   target fields are defined. This service only ever returns whatever an adapter reports.
 */
export class DocumentExtractionService implements FileExtractionPort {
  constructor(private readonly adaptersByMimeType: Map<string, FileExtractionPort>) {}

  async extract(file: RawDocument): Promise<ExtractedDocument> {
    const adapter = this.adaptersByMimeType.get(file.mimeType);
    if (!adapter) {
      // TODO: replace with the decided unsupported-format behavior (see class comment above).
      throw new Error(`No extraction adapter registered for mime type '${file.mimeType}'`);
    }
    return adapter.extract(file);
  }
}
