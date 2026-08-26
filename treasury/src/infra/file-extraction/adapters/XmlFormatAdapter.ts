import { XMLParser } from "fast-xml-parser";
import type { DocumentFormatAdapter } from "../../../core/application/ports/DocumentFormatAdapter";
import type { RawDocument, RawContent } from "../../../core/application/dtos/ExtractionModels";

const XML_MIME_TYPES = new Set(["text/xml", "application/xml"]);

/**
 * Flattens parsed XML into "path: value" lines so the classifier/field-extractor can scan it as
 * plain text regardless of the source schema (NF-e, OFX-in-XML, a bank's own export, ...).
 */
export class XmlFormatAdapter implements DocumentFormatAdapter {
  supports(mimeType: string): boolean {
    return XML_MIME_TYPES.has(mimeType);
  }

  async extractRawContent(file: RawDocument): Promise<RawContent> {
    const raw = file.buffer.toString("utf-8");
    const parser = new XMLParser({ ignoreAttributes: false, textNodeName: "#text" });
    const parsed: unknown = parser.parse(raw);
    const lines: string[] = [];
    flatten(parsed, "", lines);
    return { text: lines.join("\n"), metadata: { rootKeys: Object.keys(parsed as object) } };
  }
}

function flatten(node: unknown, path: string, out: string[]): void {
  if (node === null || node === undefined) return;
  if (typeof node !== "object") {
    out.push(`${path}: ${node}`);
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((item, i) => flatten(item, `${path}[${i}]`, out));
    return;
  }
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    flatten(value, path ? `${path}.${key}` : key, out);
  }
}
