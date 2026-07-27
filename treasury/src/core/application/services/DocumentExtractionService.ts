import type { FileExtractionPort } from "../ports/FileExtractionPort";
import type { DocumentFormatAdapter } from "../ports/DocumentFormatAdapter";
import type { DocumentClassifierPort } from "../ports/DocumentClassifierPort";
import type { FieldExtractorPort } from "../ports/FieldExtractorPort";
import type { RawDocument, ExtractionResult } from "../dtos/ExtractionModels";

/**
 * The extraction pipeline's single orchestrator — the concrete implementation behind
 * `FileExtractionPort`. Every step after "select adapter" is format-agnostic and delegated to a
 * swappable collaborator (Strategy pattern for the format adapters; the classifier and field
 * extractor are themselves swappable ports so a heuristic implementation can be replaced by an
 * AI-backed one later without this class — or any adapter — changing).
 *
 * Never throws for an expected failure (unsupported format, corrupted file, OCR failure): those
 * become `errors`/`warnings` on the returned result, per the "never just say an error occurred"
 * requirement — the caller always gets back exactly what happened, including whichever fields DID
 * extract successfully.
 */
export class DocumentExtractionService implements FileExtractionPort {
  constructor(
    private readonly adapters: DocumentFormatAdapter[],
    private readonly classifier: DocumentClassifierPort,
    private readonly fieldExtractor: FieldExtractorPort,
  ) {}

  async extract(file: RawDocument): Promise<ExtractionResult> {
    // 2-3. Identify format / select adapter.
    const adapter = this.adapters.find((a) => a.supports(file.mimeType));
    if (!adapter) {
      return { success: false, data: {}, errors: [`Formato não suportado: ${file.mimeType || "desconhecido"}.`] };
    }

    // 4. Extract raw content.
    let content;
    try {
      content = await adapter.extractRawContent(file);
    } catch (err) {
      return {
        success: false,
        data: {},
        errors: [`Não foi possível ler o arquivo "${file.filename}": ${err instanceof Error ? err.message : String(err)}.`],
      };
    }

    if (!content.text.trim()) {
      return {
        success: false,
        data: {},
        errors: ["O documento não retornou nenhum texto legível."],
        metadata: content.metadata,
      };
    }

    // 5. Classify document.
    const classification = this.classifier.classify(content);

    // 6. Extract required fields.
    const outcome = this.fieldExtractor.extractFields(content, classification);

    // 7. Validate found data — demote anything implausible to a warning instead of passing a
    // broken value on (it would just be rejected downstream, wasting a round trip).
    const warnings = [...(outcome.warnings ?? [])];
    let { counterparty, amount, date, currency, description } = outcome.data;

    if (amount !== undefined && (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0)) {
      warnings.push(`Não foi possível confirmar o valor extraído ("${amount}") — preencha manualmente.`);
      amount = undefined;
    }
    if (date !== undefined && Number.isNaN(Date.parse(date))) {
      warnings.push(`Não foi possível confirmar a data extraída ("${date}") — preencha manualmente.`);
      date = undefined;
    }
    if (counterparty !== undefined && counterparty.trim() === "") {
      counterparty = undefined;
    }
    if (description !== undefined && description.trim() === "") {
      description = undefined;
    }

    if (!counterparty) warnings.push("Não foi possível identificar a contraparte.");
    if (!amount) warnings.push("Não foi possível identificar o valor.");
    if (!date) warnings.push("Não foi possível identificar a data.");
    // Currency/description are optional in every scenario today — their absence isn't flagged as
    // a warning, since there's no follow-up question the guided chat would ask about them anyway.

    // 8. Return the standardized result.
    return {
      success: true,
      documentType: classification.documentType,
      data: { counterparty, amount, date, currency, description },
      confidence: outcome.confidence,
      warnings,
      rawText: content.text,
      metadata: content.metadata,
    };
  }
}
