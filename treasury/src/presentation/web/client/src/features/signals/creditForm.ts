import { amountFromDigits, digitsFromAmount } from "@/utils/money";

/**
 * The credit form works in typed digits (REQ-224), like every amount field. These turn them into what
 * the screen shows and what is sent: never floating point, never a comma (REQ-228).
 */
export interface CreditDraft {
  creditDigits: string;
  /** objectId → typed digits of what goes to that expected commission. */
  allocations: Record<string, string>;
}

const cents = (digits: string): bigint => BigInt(digits || "0");

export function creditTotals(draft: CreditDraft): { distributed: string; unattributed: string; over: boolean } {
  const credit = cents(draft.creditDigits);
  const distributed = Object.values(draft.allocations).reduce((sum, d) => sum + cents(d), 0n);
  const left = credit - distributed;
  return {
    distributed: amountFromDigits(distributed.toString()),
    unattributed: amountFromDigits((left < 0n ? 0n : left).toString()),
    over: left < 0n,
  };
}

/** Only the allocations actually filled in, in the Ledger's form. */
export const creditAllocations = (draft: CreditDraft): { objectId: string; amount: string }[] =>
  Object.entries(draft.allocations)
    .filter(([, digits]) => cents(digits) > 0n)
    .map(([objectId, digits]) => ({ objectId, amount: amountFromDigits(digits) }));

/** "Tudo": the whole open balance, as typed digits. Unknown balance → nothing filled. */
export const allOf = (openBalance: string | null): string => (openBalance === null ? "" : digitsFromAmount(openBalance));

/**
 * Which open lines the credit form draws: those matching the filter, at most `limit`, plus every line
 * already given an amount (it is part of the credit, so it never hides). `matching` is how many match,
 * so the screen can say that more exist.
 */
export function visibleLines<T extends { objectId: string }>(
  lines: T[],
  allocations: Record<string, string>,
  needle: string,
  labelOf: (line: T) => string,
  limit: number,
): { shown: T[]; matching: number } {
  const filled = (l: T) => (allocations[l.objectId] ?? "") !== "";
  const matches = lines.filter((l) => !needle || labelOf(l).toLowerCase().includes(needle));
  const first = new Set(matches.slice(0, limit).map((l) => l.objectId));
  return { shown: lines.filter((l) => first.has(l.objectId) || filled(l)), matching: matches.length };
}
