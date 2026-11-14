import { apiGet, apiPost } from "@/api/client";

export interface Institution {
  key: string;
  name: string;
}

export type StepStatus = "accepted" | "rejected" | "awaiting_correction" | "failed" | "not_sent";

export interface BatchLine {
  objectId: string;
  objectType: string | null;
  amount: string;
  payee: { partyId: string; displayName: string } | null;
  step?: { status: StepStatus; reason?: string; ledgerReference?: string };
}

/** §8.6. `total` is the sum of the amounts the user chose (REQ-246), not a Ledger balance. */
export interface Batch {
  batchId: string;
  preparedBy: string;
  preparedAt: string;
  total: string;
  lines: BatchLine[];
  payment?: {
    by: string;
    recordedAt: string;
    occurredAt: string;
    institution: string | null;
    debit: string;
    state: "recording" | "recorded";
    recorded: string;
    difference: string;
  };
}

export interface BatchesView {
  institutions: Institution[];
  standing: Batch[];
  recent: Batch[];
}

type Failure = { error: string };

export const batchesApi = {
  list: () => apiGet<BatchesView | Failure>("/api/batches"),
  prepare: (items: { objectId: string; amount: string }[]) => apiPost<{ batchId: string } | Failure>("/api/batches", { items }),
  discard: (batchId: string) => apiPost<{ discarded: true } | Failure>(`/api/batches/${encodeURIComponent(batchId)}/discard`, {}),
  /** `institution: null` is the explicit "not stated" (REQ-650); it is never left out. */
  pay: (batchId: string, input: { occurredAt: string; institution: string | null; debit: string }) =>
    apiPost<Batch | Failure>(`/api/batches/${encodeURIComponent(batchId)}/pay`, input),
};
