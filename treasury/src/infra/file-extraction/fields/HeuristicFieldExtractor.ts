import type { FieldExtractorPort } from "../../../core/application/ports/FieldExtractorPort";
import type { RawContent, DocumentClassification, FieldExtractionOutcome } from "../../../core/application/dtos/ExtractionModels";

/** Checked in order — first label found wins, most specific first. */
const COUNTERPARTY_LABELS: RegExp[] = [
  /favorecido[:\s]+([^\n|]+)/i,
  /cedente[:\s]+([^\n|]+)/i,
  /benefici[aá]rio[:\s]+([^\n|]+)/i,
  /sacado[:\s]+([^\n|]+)/i,
  /pagador[:\s]+([^\n|]+)/i,
  /fornecedor[:\s]+([^\n|]+)/i,
  /emitente[:\s]+([^\n|]+)/i,
  /raz[aã]o social[:\s]+([^\n|]+)/i,
  /para[:\s]+([^\n|]+)/i,
];

/** Brazilian currency format: "R$ 1.250,00" or "1.250,00" (dot = thousands, comma = decimal). */
const AMOUNT_PATTERN = /R?\$?\s?(\d{1,3}(?:\.\d{3})*,\d{2})/;

/** DD/MM/YYYY or DD.MM.YYYY, captured. */
const DATE_VALUE = "(\\d{2})[/.](\\d{2})[/.](\\d{4})";
const dateLabelPattern = (label: string): RegExp => new RegExp(`${label}[:\\s]+${DATE_VALUE}`, "i");

/**
 * Labels that name the payment date itself — the only ones worth full confidence. Covers the
 * wording major Brazilian banks (Itaú, Bradesco, Banco do Brasil, Caixa, Santander, Nubank, Inter,
 * C6...) use on PIX/TED/DOC receipts, plus the English equivalents foreign banks/international
 * wires use for the same concept. A bare "Data:" is included too (last, lowest priority in this
 * tier) because on a simple receipt with a single date, that IS the payment date; the regex only
 * matches when nothing else sits between "data" and the value, so it never accidentally matches
 * "Data de emissão: ...".
 */
const PAYMENT_DATE_LABELS: RegExp[] = [
  // Portuguese — Brazilian PIX/TED/DOC receipts.
  dateLabelPattern("data (?:do|de) pagamento"),
  dateLabelPattern("pag[ao] em"),
  dateLabelPattern("data da transa[cç][aã]o"),
  dateLabelPattern("data de liquida[cç][aã]o"),
  dateLabelPattern("data da opera[cç][aã]o"),
  dateLabelPattern("data de realiza[cç][aã]o"),
  dateLabelPattern("realizad[ao] em"),
  dateLabelPattern("transferid[ao] em"),
  dateLabelPattern("efetivad[ao] em"),
  dateLabelPattern("conclu[ií]d[ao] em"),
  dateLabelPattern("processad[ao] em"),
  // English — foreign banks / international wires.
  dateLabelPattern("payment date"),
  dateLabelPattern("date paid"),
  dateLabelPattern("paid on"),
  dateLabelPattern("transfer(?:red)? on"),
  dateLabelPattern("transfer date"),
  dateLabelPattern("execut(?:ed|ion) (?:on|date)"),
  dateLabelPattern("value date"),
  dateLabelPattern("completed on"),
  dateLabelPattern("date completed"),
  dateLabelPattern("processed on"),
  dateLabelPattern("\\bdata"),
];

/**
 * Labels that name a nearby but DIFFERENT date — usable as a fallback when no payment date is
 * present, but never as confidently, since an invoice's issue date can easily differ from when it
 * was actually paid. Flagged with a lower confidence + an explicit warning so the guided chat can
 * surface it for the user to double-check rather than presenting it as settled fact.
 */
const FALLBACK_DATE_LABELS: { pattern: RegExp; name: string }[] = [
  { pattern: dateLabelPattern("data de emiss[aã]o"), name: "data de emissão" },
  { pattern: dateLabelPattern("emitido em"), name: "data de emissão" },
];

/**
 * Labels that are explicitly NOT the payment date — stripped from the text before the last-resort
 * bare-date search below, so a due date or reference period can never win just by appearing
 * earlier in the document than any actual payment-date mention.
 */
const EXCLUDED_DATE_LABELS: RegExp[] = [
  dateLabelPattern("vencimento"),
  dateLabelPattern("per[ií]odo(?:\\s+de\\s+refer[eê]ncia)?"),
];

const BARE_DATE_PATTERN = new RegExp(DATE_VALUE);

/** An explicit label wins over symbol-sniffing; checked first. */
const CURRENCY_LABEL_PATTERN = /moeda[:\s]+(BRL|USD|R\$|US\$|reais?|d[oó]lares?)/i;

/** Checked in order — first label found wins, most specific first. */
const DESCRIPTION_LABELS: RegExp[] = [
  /descri[cç][aã]o[:\s]+([^\n|]+)/i,
  /hist[oó]rico[:\s]+([^\n|]+)/i,
  /discrimina[cç][aã]o[:\s]+([^\n|]+)/i,
  /referente a[:\s]+([^\n|]+)/i,
  /observa[cç][oõ]es?[:\s]+([^\n|]+)/i,
];

const normalizeAmount = (raw: string): string => raw.replace(/\./g, "").replace(",", ".");
// Date-only ISO (no time component) — matches what a manually-typed `<input type="date">` answer
// already produces, so the value round-trips through the same edit field either way.
const normalizeDate = (day: string, month: string, year: string): string =>
  new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).toISOString().slice(0, 10);

interface DateExtraction {
  date?: string;
  confidence?: number;
  warning?: string;
}

function extractDate(text: string): DateExtraction {
  for (const pattern of PAYMENT_DATE_LABELS) {
    const match = text.match(pattern);
    if (match) return { date: normalizeDate(match[1], match[2], match[3]), confidence: 0.85 };
  }
  for (const { pattern, name } of FALLBACK_DATE_LABELS) {
    const match = text.match(pattern);
    if (match) {
      return {
        date: normalizeDate(match[1], match[2], match[3]),
        confidence: 0.5,
        warning: `Não encontramos uma data de pagamento explícita — usamos a ${name} do documento. Confira antes de confirmar.`,
      };
    }
  }
  // Last resort: any bare date left in the text once known non-payment dates are stripped out.
  const withoutExcluded = EXCLUDED_DATE_LABELS.reduce((acc, pattern) => acc.replace(pattern, ""), text);
  const bare = withoutExcluded.match(BARE_DATE_PATTERN);
  if (bare) {
    return {
      date: normalizeDate(bare[1], bare[2], bare[3]),
      confidence: 0.3,
      warning: "Encontramos uma data no documento sem rótulo claro (pode não ser a data de pagamento) — confira antes de confirmar.",
    };
  }
  return {};
}

/** ISO 4217 code — an explicit "Moeda:" label wins; otherwise inferred from currency symbols. */
function extractCurrency(text: string): string | undefined {
  const labelMatch = text.match(CURRENCY_LABEL_PATTERN);
  if (labelMatch) {
    const raw = labelMatch[1].toUpperCase();
    return raw.includes("USD") || raw.includes("US$") || raw.includes("DÓLAR") || raw.includes("DOLAR") ? "USD" : "BRL";
  }
  if (/R\$/.test(text)) return "BRL";
  if (/US\$|\bUSD\b/.test(text)) return "USD";
  if (/\breais?\b/i.test(text)) return "BRL";
  return undefined;
}

/**
 * Heuristic (regex/keyword) field extraction — the first swap target for an AI-based
 * implementation once accuracy needs to improve; `DocumentExtractionService` is unaware of which
 * kind is in use. `classification` isn't weighted into the label priority yet (kept generic
 * across document types for this pass) but is already threaded through for that future tuning.
 */
export class HeuristicFieldExtractor implements FieldExtractorPort {
  extractFields(content: RawContent, _classification: DocumentClassification): FieldExtractionOutcome {
    let counterparty: string | undefined;
    for (const pattern of COUNTERPARTY_LABELS) {
      const match = content.text.match(pattern);
      if (match) {
        counterparty = match[1].trim();
        break;
      }
    }

    let description: string | undefined;
    for (const pattern of DESCRIPTION_LABELS) {
      const match = content.text.match(pattern);
      if (match) {
        description = match[1].trim();
        break;
      }
    }

    const amountMatch = content.text.match(AMOUNT_PATTERN);
    const amount = amountMatch ? normalizeAmount(amountMatch[1]) : undefined;

    const currency = extractCurrency(content.text);

    const { date, confidence: dateConfidence, warning: dateWarning } = extractDate(content.text);

    return {
      data: { counterparty, amount, date, currency, description },
      confidence: {
        counterparty: counterparty ? 0.7 : undefined,
        amount: amount ? 0.75 : undefined,
        date: dateConfidence,
        currency: currency ? 0.75 : undefined,
        description: description ? 0.65 : undefined,
      },
      warnings: dateWarning ? [dateWarning] : undefined,
    };
  }
}
