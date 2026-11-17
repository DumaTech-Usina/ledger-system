import { amountFromDigits } from "@/utils/money";

/** A signed amount in the Ledger's form from the typed digits and the chosen side: "-1200.00". */
export function signedAmount(digits: string, negative: boolean): string {
  const amount = amountFromDigits(digits);
  return negative && amount !== "0.00" ? `-${amount}` : amount;
}

/** How a statement check reads: matched, a difference to explain, or nothing to compare (REQ-675). */
export function checkTone(difference: string | null): "ok" | "bad" | "unknown" {
  if (difference === null) return "unknown";
  return /^-?0\.00$/.test(difference) ? "ok" : "bad";
}

/** Today in São Paulo, the day the CFO means (REQ-225). */
export const todayInSaoPaulo = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
