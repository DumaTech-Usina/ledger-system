import { parse } from "csv-parse/sync";
import type { DocumentFormatAdapter } from "../../../core/application/ports/DocumentFormatAdapter";
import type { RawDocument, RawContent } from "../../../core/application/dtos/ExtractionModels";

const CSV_MIME_TYPES = new Set(["text/csv", "application/csv", "application/vnd.ms-excel"]);

/**
 * Turns a CSV file into a flat "column: value" text rendering (one row per line) so the
 * classifier/field-extractor can scan it exactly like any other document's text — no CSV-specific
 * knowledge leaks past this adapter.
 */
export class CsvFormatAdapter implements DocumentFormatAdapter {
  supports(mimeType: string): boolean {
    return CSV_MIME_TYPES.has(mimeType);
  }

  async extractRawContent(file: RawDocument): Promise<RawContent> {
    const raw = file.buffer.toString("utf-8");
    let rows: Record<string, string>[];
    try {
      rows = parse(raw, { columns: true, skip_empty_lines: true, relax_column_count: true });
    } catch {
      // No usable header row — fall back to plain indexed columns rather than failing outright.
      const plainRows: string[][] = parse(raw, { columns: false, skip_empty_lines: true, relax_column_count: true });
      rows = plainRows.map((cols) => Object.fromEntries(cols.map((v, i) => [`col${i + 1}`, v])));
    }
    const text = rows.map((row) => Object.entries(row).map(([k, v]) => `${k}: ${v}`).join(" | ")).join("\n");
    return { text, metadata: { rowCount: rows.length } };
  }
}
