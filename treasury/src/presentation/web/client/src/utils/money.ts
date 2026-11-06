/**
 * Arithmetic on the Ledger's decimal money strings.
 *
 * Money never becomes a float here. `0.1 + 0.2` in binary floating point is not `0.30`, so everything
 * is done in integer cents and rendered back as a decimal string, the shape the rest of the app
 * already formats.
 *
 * `formatMoney` still parses with `Number` and that is fine: it displays one value that was never
 * added to another. This module exists for the cases where values are added or typed.
 */

/** Exactly what the Ledger publishes: an optional sign, digits, and at most two decimal places. */
const DECIMAL = /^[+-]?\d+(\.\d{1,2})?$/;

/**
 * The value in integer cents, or null when the string is not a figure this module can add without
 * inventing precision. Null is a real answer — it travels through the sum and comes out as an
 * unknown balance rather than as a number that looks derived but is not.
 */
export function toCents(amount: string): bigint | null {
  const trimmed = amount.trim();
  if (!DECIMAL.test(trimmed)) return null;

  const negative = trimmed.startsWith("-");
  const unsigned = trimmed.replace(/^[+-]/, "");
  const [whole, fraction = ""] = unsigned.split(".");
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  return negative ? -cents : cents;
}

/** Cents back to the decimal string shape the Ledger uses, sign included: `-1250.05`. */
export function fromCents(cents: bigint): string {
  const negative = cents < 0n;
  const absolute = negative ? -cents : cents;
  const whole = absolute / 100n;
  const fraction = (absolute % 100n).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

/** REQ-224: what is typed into an amount field, reduced to its digits, without leading zeros. */
export function amountDigits(typed: string): string {
  return typed.replace(/\D/g, "").replace(/^0+/, "");
}

/** The digits as the field shows them, filling from the cents: `150050` reads `R$ 1.500,50`. */
export function maskedAmount(digits: string): string {
  const padded = digits.padStart(3, "0");
  const whole = padded.slice(0, -2).replace(/\B(?=(\d{3})+$)/g, ".");
  return `R$ ${whole},${padded.slice(-2)}`;
}

/** The same digits in the only form that leaves the field (REQ-228): `150050` is `1500.50`. */
export function amountFromDigits(digits: string): string {
  return fromCents(BigInt(digits || "0"));
}

/** A stored amount back to the digits the field works with: `1500.5` is `150050`. */
export function digitsFromAmount(amount: string): string {
  const cents = toCents(amount);
  return cents === null || cents < 0n ? "" : amountDigits(cents.toString());
}
