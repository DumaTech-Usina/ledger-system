import { apiGet } from "@/api/client";
import type { PositionItem } from "@/types/dashboard";

export type AgendaWindow = "overdue" | "today" | "next" | "later" | "undated";
export const AGENDA_WINDOWS: AgendaWindow[] = ["overdue", "today", "next", "later", "undated"];

export interface AgendaLine extends PositionItem {
  creditors: { partyId: string; displayName: string }[];
  openForDays: number | null;
  partiallyPaid: boolean;
}

/** §8.5. The totals are the Ledger's (REQ-642); this screen never adds money up. */
export type AgendaResult =
  | {
      available: true;
      asOf: string;
      windowDays: number;
      windows: Record<AgendaWindow, { count: number; totals: Record<string, string> }>;
      window: AgendaWindow;
      lines: AgendaLine[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }
  | { available: false };

export const agendaApi = {
  get: (q: { window?: AgendaWindow; page?: number; limit?: number }) => {
    const params = new URLSearchParams();
    if (q.window) params.set("window", q.window);
    if (q.page) params.set("page", String(q.page));
    if (q.limit) params.set("limit", String(q.limit));
    return apiGet<AgendaResult>(`/api/dashboard/agenda?${params}`);
  },
};
