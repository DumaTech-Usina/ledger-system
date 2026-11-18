import { apiGet } from "@/api/client";

export interface Summary {
  count: number;
  totals: Record<string, string>;
}

export interface Columns {
  overdue: Summary;
  /** Today and each next day of the window. */
  days: (Summary & { day: string })[];
  later: Summary;
  undated: Summary;
}

/** §8.10. Every figure is the Ledger's; nothing here is summed, netted or concluded (REQ-684). */
export type MorningPanel =
  | {
      available: true;
      asOf: string;
      windowDays: number;
      cash: {
        institutions: { key: string; name: string; balance: string | null }[];
        known: { total: string; institutions: string[] };
        missingOpening: string[];
        unknown: { since: string | null; cashIn: string; cashOut: string; count: number };
      };
      payables: Columns;
      receivables: Columns;
    }
  | { available: false };

export const morningApi = {
  get: () => apiGet<MorningPanel>("/api/dashboard/morning"),
};
