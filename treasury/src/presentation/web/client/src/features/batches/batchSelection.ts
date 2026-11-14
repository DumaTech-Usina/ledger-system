import { amountFromDigits, digitsFromAmount, toCents } from "@/utils/money";

/** What the selection needs from an agenda line. */
export interface SelectableLine {
  objectId: string;
  currency: string;
  openBalance: string | null;
  creditors: { partyId: string }[];
}

/** One chosen line: the typed digits of what this payment puts on it (REQ-224). */
export interface Chosen {
  line: SelectableLine;
  digits: string;
}

export type Selection = Record<string, Chosen>;

/**
 * Why a line cannot enter a batch (REQ-651), or null when it can. The server refuses the same cases;
 * saying it on the line spares the CFO a round trip.
 */
export function unbatchable(line: SelectableLine): "creditor" | "creditors" | "currency" | "balance" | null {
  if (line.currency !== "BRL") return "currency";
  if (line.creditors.length === 0) return "creditor";
  if (line.creditors.length > 1) return "creditors";
  if (line.openBalance === null || (toCents(line.openBalance) ?? 0n) <= 0n) return "balance";
  return null;
}

/** Ticking a line chooses its whole open balance; ticking it again lets it go. */
export function toggle(selection: Selection, line: SelectableLine): Selection {
  const next = { ...selection };
  if (next[line.objectId]) delete next[line.objectId];
  else next[line.objectId] = { line, digits: digitsFromAmount(line.openBalance ?? "") };
  return next;
}

/** A line's amount above its open balance, or zero — the server refuses both (Q-048, prevention). */
export function lineProblem(chosen: Chosen): "zero" | "over" | null {
  const cents = BigInt(chosen.digits || "0");
  if (cents <= 0n) return "zero";
  if (cents > (toCents(chosen.line.openBalance ?? "0") ?? 0n)) return "over";
  return null;
}

/** The sum of what the user chose (REQ-246): their own figures, compared later with the bank's debit. */
export function selectionTotal(selection: Selection): string {
  return amountFromDigits(Object.values(selection).reduce((sum, c) => sum + BigInt(c.digits || "0"), 0n).toString());
}

export const selectionItems = (selection: Selection): { objectId: string; amount: string }[] =>
  Object.values(selection).map((c) => ({ objectId: c.line.objectId, amount: amountFromDigits(c.digits) }));

/** The bank's debit against the batch total: the payment is only sent when they match (REQ-653). */
export function debitMatches(debitDigits: string, total: string): boolean {
  return debitDigits !== "" && amountFromDigits(debitDigits) === total;
}
