import type { OpenBalanceByObjectType } from "@/types/dashboard";

/**
 * The pure decision behind the composition panel — kept out of the component so the one thing that
 * is easy to get wrong here can be tested without mounting anything (see ARCHITECTURE.md).
 *
 * `unknown`  — the Ledger published no composition (an older Ledger, or a read that failed).
 * `empty`    — it published one and it is empty: nothing of that kind is outstanding.
 * `listed`   — there is something to show.
 *
 * Collapsing `unknown` into `empty` is the classic defect of this codebase in miniature: it would
 * put "nothing is committed" on screen when the truth is "we were not told". The two must render
 * differently, so they are decided here once instead of inside a ternary in the view.
 */
export type CompositionState = "unknown" | "empty" | "listed";

export function compositionState(lines: OpenBalanceByObjectType[] | undefined): CompositionState {
  if (lines === undefined) return "unknown";
  return lines.length === 0 ? "empty" : "listed";
}
