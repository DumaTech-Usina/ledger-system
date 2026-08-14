export function formatMoney(amount: string | number, currency: string): string {
  const n = Number(amount);
  if (Number.isNaN(n)) return `${amount} ${currency}`;
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(n);
  } catch {
    return `${amount} ${currency}`;
  }
}

/**
 * `formatMoney` for a figure the Ledger publishes unsigned, with the direction carried separately
 * (e.g. `netCash`/`netCashNegative`) — the raw string never carries a minus sign on its own, so a
 * negative figure needs it added here rather than left to read as positive.
 */
export function formatSignedMoney(amount: string | number, negative: boolean, currency: string): string {
  return formatMoney(negative ? `-${amount}` : amount, currency);
}

/** Formats a date-only business value in UTC so the calendar date never shifts across timezones. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(d);
}

/**
 * Punctuates a Brazilian tax id as it is typed — CPF (up to 11 digits) as `000.000.000-00`, CNPJ
 * (12–14) as `00.000.000/0000-00`. The mask only grows as far as the digits reach, so a
 * half-typed number is never punctuated as if it were complete.
 *
 * Purely presentational: the Party Directory compares documents digit-by-digit, so a stored value
 * carrying these separators matches one without them.
 */
export function formatDocument(value: string): string {
  const digits = value.replace(/\D+/g, "").slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
  }
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5");
}

/** Formats an event timestamp (audit trail) in the viewer's local time. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(d);
}

/**
 * The locale-aware sibling of `formatMoney`/`formatDate` — those two always render pt-BR regardless
 * of the app's language toggle, which is right for a business figure the Ledger itself reports (the
 * Ledger has no opinion on the reader's language). These are for the opposite case: putting a
 * person's own answer back in front of them, in the operations chat, where it must read in whatever
 * language they picked — not silently default to Portuguese under an English UI.
 */
export function formatMoneyForLanguage(amount: string | number, currency: string, language: string): string {
  const n = Number(amount);
  if (Number.isNaN(n)) return `${amount} ${currency}`;
  try {
    return new Intl.NumberFormat(language, { style: "currency", currency }).format(n);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function formatDateForLanguage(iso: string, language: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(language, { dateStyle: "medium", timeZone: "UTC" }).format(d);
}

/**
 * A human-typed amount, read loosely: whichever of `,`/`.` appears last is the decimal separator,
 * so "1.500,00" (pt-BR), "1,500.00" (en) and the bare "1500,00"/"1500.00" all resolve to the same
 * number. `null` when the text isn't a plain amount at all — the caller's cue to leave it alone
 * rather than guess.
 */
export function parseLooseAmount(raw: string): number | null {
  const cleaned = raw.trim().replace(/[^\d.,-]/g, "");
  if (cleaned === "") return null;
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized = cleaned;
  if (lastComma > lastDot) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    normalized = cleaned.replace(/,/g, "");
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}
