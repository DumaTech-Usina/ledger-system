import { apiGet } from "@/api/client";
import type { AgendaWindow } from "@/features/agenda/agendaApi";
import type { PositionItem } from "@/types/dashboard";

/** §8.7: the five windows, or the receipts with no known origin (REQ-664). */
export type ReceivablesList = AgendaWindow | "unlinked";

export interface Named {
  partyId: string;
  displayName: string;
}

/** What the insurer declared it paid for a policy, in its latest eligibility reading (REQ-663). */
export interface InsurerClaim {
  policyId: string;
  policyLabel: string;
  claimed: string;
  eligibleAt: string | null;
  insurer: string | null;
}

export interface ReceivableLine extends PositionItem {
  payers: Named[];
  openForDays: number | null;
  partiallyReceived: boolean;
  policyId: string | null;
  declared: InsurerClaim | null;
}

export interface Summary {
  count: number;
  totals: Record<string, string>;
}

export interface PayerGroup extends Summary {
  /** The filter value: "" for the positions that name no payer. */
  key: string;
  payers: Named[];
}

/** The totals are the Ledger's (REQ-601); this screen never adds money up. */
export type ReceivablesResult =
  | {
      available: true;
      asOf: string;
      windowDays: number;
      windows: Record<AgendaWindow, Summary>;
      unlinked: Summary;
      payers: PayerGroup[];
      payer: string | null;
      window: ReceivablesList;
      lines: ReceivableLine[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }
  | { available: false };

export interface DeclaredLine extends InsurerClaim {
  objectId: string;
  received: string;
  open: string | null;
  dueAt: string | null;
  currency: string;
  payerKey: string;
  payers: Named[];
}

export type DeclaredResult = { available: true; lines: DeclaredLine[] } | { available: false };

export const receivablesApi = {
  get: (q: { window?: ReceivablesList; payer?: string | null; page?: number; limit?: number }) => {
    const params = new URLSearchParams();
    if (q.window) params.set("window", q.window);
    // "" is a real filter (no payer named); only null means "every payer".
    if (q.payer !== undefined && q.payer !== null) params.set("payer", q.payer);
    if (q.page) params.set("page", String(q.page));
    if (q.limit) params.set("limit", String(q.limit));
    return apiGet<ReceivablesResult>(`/api/dashboard/receivables?${params}`);
  },
  declared: () => apiGet<DeclaredResult>("/api/dashboard/receivables/declared"),
};
