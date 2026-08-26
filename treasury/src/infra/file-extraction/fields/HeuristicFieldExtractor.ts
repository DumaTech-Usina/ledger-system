import type { FieldExtractorPort } from "../../../core/application/ports/FieldExtractorPort";
import type { RawContent, DocumentClassification, FieldExtractionOutcome } from "../../../core/application/dtos/ExtractionModels";

/**
 * Checked in order — first label found wins, most specific first. Deliberately does NOT include a
 * bare "razão social"/"emitente" match ahead of the structured NFS-e block below: on a tax document
 * that label names whoever OWES the tax (see `extractCounterparty`), and on a multi-party document
 * (an NFS-e's own EMITENTE/TOMADOR blocks) a bare label match can land on the wrong block entirely —
 * both are exactly the failure this file's counterparty extraction used to have.
 */
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

/**
 * NFS-e/DANFSe templates print the service provider under an "EMITENTE DA NFS-e"/"Prestador do
 * Serviço" block and the client under a separate "TOMADOR DO SERVIÇO" block, with the actual name a
 * few lines below a "Nome / Nome Empresarial" sub-label (CNPJ, inscrição municipal, telefone, ...
 * sit in between). The `{0,400}` bound keeps this from ever reaching into an unrelated section of a
 * long document — it only looks as far as one form block plausibly extends.
 *
 * Every scenario this app records a document for expresses an outbound act — paying a supplier, a
 * payroll, a service fee, a tax — never a receivable being billed out, so the EMITENTE (whoever
 * issued/performed the service being paid for) is the counterparty in the overwhelmingly common
 * case; the TOMADOR is typically the usina itself. This is a deliberate default, not a certainty —
 * a document where the usina is itself the EMITENTE would need the other block instead, which this
 * heuristic pass does not attempt to detect.
 */
const EMITENTE_NFSE_PATTERN =
  /(?:emitente da nfs-?e|prestador do servi[cç]o)[\s\S]{0,400}?nome\s*\/\s*nome empresarial\s*[:\s]*\n?\s*([^\n]+)/i;

/**
 * A tax payment slip (DAS/DARF/GPS/guia de recolhimento) prints the TAXPAYER's own CNPJ/razão
 * social prominently — that is who OWES the tax, not who it is paid to, so `COUNTERPARTY_LABELS`
 * would grab exactly the wrong party here. The actual payee is a government body, identified by
 * keyword rather than by any name field on the document. Checked in order, most specific first —
 * PGFN (active debt collection) is a meaningfully different payee than a routine DARF/Simples
 * Nacional collection, so it must win when both are present (e.g. a Simples Nacional DAS that has
 * gone to active debt shows both "PGFN" and "SIMPLES NACIONAL" on the same slip).
 */
const TAX_AUTHORITY_LABELS: { pattern: RegExp; name: string }[] = [
  { pattern: /\bpgfn\b|procuradoria.?geral da fazenda nacional/i, name: "Procuradoria-Geral da Fazenda Nacional (PGFN)" },
  { pattern: /\bdarf\b/i, name: "Receita Federal do Brasil" },
  { pattern: /documento de arrecada[cç][aã]o do simples nacional|\bdas-mei\b|simples nacional/i, name: "Receita Federal do Brasil" },
];

/** Last-resort fallbacks for a tax document that named neither PGFN nor a federal collection. */
const MUNICIPAL_TAX_AUTHORITY_PATTERN = /prefeitura(?:\s+municipal)?\s+d[eo]\s+([^\n,./]+)/i;

/** Strips a registration-code prefix some municipal NFS-e templates glue onto the name field itself
 * (e.g. "66.237.020 ACME LTDA" → "ACME LTDA") — never a legitimate start of a real company name. */
function cleanCounterpartyName(raw: string): string {
  return raw.trim().replace(/^[\d./-]+\s+/, "").trim();
}

/**
 * The payee on a tax document is a government body, never the taxpayer's own name printed on it —
 * resolved by keyword instead of by any name field. Returns undefined (never a guess) when no
 * known collector is named, which is honest: the guided chat then simply asks for it.
 */
function extractTaxAuthority(text: string): string | undefined {
  for (const { pattern, name } of TAX_AUTHORITY_LABELS) {
    if (pattern.test(text)) return name;
  }
  const municipal = text.match(MUNICIPAL_TAX_AUTHORITY_PATTERN);
  if (municipal) return `Prefeitura de ${municipal[1].trim()}`;
  if (/\binss\b/i.test(text)) return "INSS";
  return undefined;
}

/**
 * A tax document's payee is never a name printed on the document (see `extractTaxAuthority`) — the
 * generic label list below is skipped entirely for it, not just deprioritized, since matching it
 * would silently record the taxpayer as their own counterparty. Every other document type tries the
 * NFS-e block first (structural, so it cannot land on the wrong party's block) and falls back to the
 * single-party label list any other receipt format uses.
 */
function extractCounterparty(text: string, classification: DocumentClassification): string | undefined {
  if (classification.documentType === "tax_document") return extractTaxAuthority(text);

  const emitente = text.match(EMITENTE_NFSE_PATTERN);
  if (emitente) return cleanCounterpartyName(emitente[1]);

  for (const pattern of COUNTERPARTY_LABELS) {
    const match = text.match(pattern);
    if (match) return cleanCounterpartyName(match[1]);
  }
  return undefined;
}

/**
 * Labels that name the document's own bottom-line total — checked before the bare pattern below so
 * a dense, multi-column layout (a DAS's composition table, an NFS-e's repeated "Valor do Serviço"
 * across its municipal/federal/total sections) can never have an unrelated line-item number win
 * just by appearing earlier in the extracted text than the actual total.
 */
const AMOUNT_LABELS: RegExp[] = [
  /valor l[ií]quido da nfs-?e[:\s]+R?\$?\s?(\d{1,3}(?:\.\d{3})*,\d{2})/i,
  /valor total da nfs-?e[:\s]+R?\$?\s?(\d{1,3}(?:\.\d{3})*,\d{2})/i,
  /valor total do documento[:\s]+R?\$?\s?(\d{1,3}(?:\.\d{3})*,\d{2})/i,
  /valor do servi[cç]o[:\s]+R?\$?\s?(\d{1,3}(?:\.\d{3})*,\d{2})/i,
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
  // A tax/boleto payment slip's own due date, printed as an instruction ("pay by") rather than a
  // record of when payment happened — auto-filling it as the payment date would assert a fact the
  // slip itself does not contain (it is unpaid at the moment it is issued).
  dateLabelPattern("pagar (?:este documento )?at[eé]"),
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

/** The document's own labeled total wins over the bare pattern — see `AMOUNT_LABELS`. */
function extractAmount(text: string): string | undefined {
  for (const pattern of AMOUNT_LABELS) {
    const match = text.match(pattern);
    if (match) return normalizeAmount(match[1]);
  }
  const bare = text.match(AMOUNT_PATTERN);
  return bare ? normalizeAmount(bare[1]) : undefined;
}

/**
 * Heuristic (regex/keyword) field extraction — the first swap target for an AI-based
 * implementation once accuracy needs to improve; `DocumentExtractionService` is unaware of which
 * kind is in use. `classification` now steers counterparty extraction specifically (tax documents
 * and NFS-e need document-type-aware handling — see `extractCounterparty`); the other fields are
 * still generic across document types.
 */
export class HeuristicFieldExtractor implements FieldExtractorPort {
  extractFields(content: RawContent, classification: DocumentClassification): FieldExtractionOutcome {
    const counterparty = extractCounterparty(content.text, classification);

    let description: string | undefined;
    for (const pattern of DESCRIPTION_LABELS) {
      const match = content.text.match(pattern);
      if (match) {
        description = match[1].trim();
        break;
      }
    }

    const amount = extractAmount(content.text);

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
