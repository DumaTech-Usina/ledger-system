/**
 * Rounds a plain decimal ("10.125") to 2 places by ABNT NBR 5891, looking at the digit right after
 * the last one kept: below 5 keeps; above 5 adds one; exactly 5 adds one if anything other than zero
 * follows it, and otherwise rounds to the even neighbour.
 *
 * Works on the digits, never on a float: 10.135 has no exact binary form, and that is the very case
 * where the rule turns on the digit that a float would have already blurred.
 */
export function roundNbr5891(value: string): string {
  const [whole, fraction = ""] = value.split(".");
  const kept = BigInt(whole + fraction.slice(0, 2).padEnd(2, "0"));
  const next = Number(fraction[2] ?? "0");
  const beyond = fraction.slice(3);

  const roundsUp = next > 5 || (next === 5 && (/[1-9]/.test(beyond) || kept % 2n === 1n));
  const cents = (kept + (roundsUp ? 1n : 0n)).toString().padStart(3, "0");
  return `${cents.slice(0, -2)}.${cents.slice(-2)}`;
}
