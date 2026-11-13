import type { AgendaWindow } from "@/features/agenda/agendaApi";
import { AGENDA_WINDOWS } from "@/features/agenda/agendaApi";

/**
 * The window the agenda opens on: the most urgent one that has something in it. Overdue before today,
 * today before the next days — what the CFO has to look at first. With nothing owed at all, "today".
 */
export function firstWindow(counts: Record<AgendaWindow, { count: number }>): AgendaWindow {
  return AGENDA_WINDOWS.find((w) => counts[w].count > 0) ?? "today";
}

/** A window's totals as the Ledger published them, one per currency, in a stable order. */
export function totalsOf(totals: Record<string, string>): { currency: string; amount: string }[] {
  return Object.entries(totals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, amount]) => ({ currency, amount }));
}
