import { apiGet, apiPost } from "@/api/client";

export interface Institution {
  key: string;
  name: string;
}

/** What the CFO informed for an institution, beside the book on the same day (REQ-675). */
export interface StatementCheck {
  day: string;
  amount: string;
  informedBy: string;
  informedAt: string;
  /** Null when no opening covered that day: there is nothing to compare. */
  book: string | null;
  difference: string | null;
}

export interface InstitutionView {
  key: string;
  name: string;
  configured: boolean;
  opening: { amount: string; day: string; eventId: string } | null;
  cashIn: string;
  cashOut: string;
  transfersIn: string;
  transfersOut: string;
  /** Null without an opening: unknown, never zero (REQ-673). */
  balance: string | null;
  statement: StatementCheck | null;
}

/** §8.8. Every figure but the difference is the Ledger's (REQ-601). */
export type InstitutionsResult =
  | {
      available: true;
      asOf: string;
      institutions: InstitutionView[];
      known: { total: string; institutions: string[] };
      unknown: { since: string | null; cashIn: string; cashOut: string; count: number };
    }
  | { available: false };

export interface RecordOutcome {
  status: string;
  intentId: string;
  ledgerReference?: string;
  reason?: string;
}

type Err = { error: string };

export const cashApi = {
  list: () => apiGet<{ institutions: Institution[] } | Err>("/api/cash/institutions/list"),
  read: (asOf?: string) => apiGet<InstitutionsResult | Err>(`/api/cash/institutions${asOf ? `?asOf=${asOf}` : ""}`),
  history: (key: string) => apiGet<{ statements: StatementCheck[] } | Err>(`/api/cash/institutions/${encodeURIComponent(key)}/statements`),
  opening: (input: { institution: string; amount: string; occurredAt: string; description?: string }) =>
    apiPost<RecordOutcome | Err>("/api/cash/openings", input),
  transfer: (input: { from: string; to: string; amount: string; occurredAt: string; description?: string }) =>
    apiPost<RecordOutcome | Err>("/api/cash/transfers", input),
  statement: (input: { institution: string; day: string; amount: string }) => apiPost<StatementCheck | Err>("/api/cash/statements", input),
};
