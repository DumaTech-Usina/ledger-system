import { AGENDA_WINDOWS, type AgendaWindow } from "@/features/agenda/agendaApi";
import type { DeclaredLine, Named } from "@/features/receivables/receivablesApi";

/** The window the agenda opens on: the most urgent one with something in it; with nothing, "today". */
export function firstReceivableWindow(counts: Record<AgendaWindow, { count: number }>): AgendaWindow {
  return AGENDA_WINDOWS.find((w) => counts[w].count > 0) ?? "today";
}

/** Who owes it, by name. No one named → `unknown`, never a guess (REQ-662). */
export function payerLabel(payers: Named[], unknown: string): string {
  return payers.length === 0 ? unknown : payers.map((p) => p.displayName).join(", ");
}

/** The declared list narrowed to the chosen payer; null keeps everyone (REQ-662, REQ-663). */
export function declaredOf(lines: DeclaredLine[], payer: string | null): DeclaredLine[] {
  return payer === null ? lines : lines.filter((l) => l.payerKey === payer);
}

/** REQ-251, DEC-025: what a party owes the Usina that usually comes back by compensation, not by cash. */
const COMPENSABLE = new Set(["advance", "loan"]);

/**
 * REQ-696: the actions a line offers. An advance or a loan comes back by compensation far more often
 * than by cash (confirmed with the CFO, 2026-11-18), so its main action leads to the party's page, where
 * the compensation is chosen; receiving in cash stays offered. That needs exactly one known party:
 * with none or several, the line offers what it always did. Nothing for whoever cannot write but "Ver",
 * and nothing to receive on money that came in with no origin.
 */
export function lineActions(
  line: { objectType: string; payers: Named[] },
  opts: { canReceive: boolean; unlinked: boolean },
): { primary: "compensate" | "receive" | "view"; alsoReceive: boolean } {
  if (!opts.canReceive || opts.unlinked) return { primary: "view", alsoReceive: false };
  if (COMPENSABLE.has(line.objectType) && line.payers.length === 1) return { primary: "compensate", alsoReceive: true };
  return { primary: "receive", alsoReceive: false };
}

/**
 * REQ-695: the payer a credit can be registered for, from the agenda's filter — only a group that names
 * exactly one party. "Pagador não informado" and a group of several are not someone a bank credit came from.
 */
export function creditPayer(groups: { key: string; payers: Named[] }[], key: string | null): Named | null {
  if (!key) return null;
  const group = groups.find((g) => g.key === key);
  return group && group.payers.length === 1 ? group.payers[0] : null;
}
