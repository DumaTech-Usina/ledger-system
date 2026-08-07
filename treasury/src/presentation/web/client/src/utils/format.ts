export function formatMoney(amount: string | number, currency: string): string {
  const n = Number(amount);
  if (Number.isNaN(n)) return `${amount} ${currency}`;
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(n);
  } catch {
    return `${amount} ${currency}`;
  }
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
