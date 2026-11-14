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
