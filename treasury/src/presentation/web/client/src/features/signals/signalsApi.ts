import { apiGet, apiPost } from "@/api/client";
import type { DialogState } from "@/types/operations";

export type SignalKind = "policy" | "eligibility" | "installment";
export type ProposedFactKind = "commission_expected" | "commission_obligation" | "supervisor_obligation";
/** Which external system a signal came from: insurance (§4.6) or health (§4.7). */
export type SignalSystem = "insurance" | "health";

/** How the broker was found when the signal was recorded (REQ-267). */
export type PartyOutcome =
  | { outcome: "linked"; partyId: string }
  | { outcome: "provisional"; partyId: string }
  | { outcome: "ambiguous"; candidates: string[] }
  | { outcome: "not_informed" };

export interface SignalProposal {
  fact: ProposedFactKind;
  sourceReference: string;
  intentId: string;
  reused: boolean;
  party?: PartyOutcome;
  intentStatus: string | null;
  ledgerReference?: string;
  /** REQ-286: the source sent zero — a hint that there is no obligation, never a decision. */
  suggestion?: "no_obligation";
  /** REQ-286: who declared there is no obligation, and when. */
  dismissedBy?: string;
  dismissedByName?: string;
  dismissedAt?: string;
}

export type SignalFilter = "needs_action" | "all";
export const SIGNALS_PAGE_SIZE = 20;

export interface SignalPage {
  signals: SignalView[];
  nextCursor: string | null;
}

export interface SignalView {
  id: string;
  system?: SignalSystem;
  kind: SignalKind;
  recordId: string;
  fields: Record<string, string>;
  contentHash: string;
  receivedAt: string;
  recordedBy: string;
  /** The user's name, when the server knows it. */
  recordedByName?: string;
  proposals: SignalProposal[];
}

export type PolicyNotice =
  | { code: "insurer_says_paid"; claimed: string; received: string }
  | { code: "expected_not_recorded"; claimed: string }
  | { code: "payout_without_receipt"; paid: string }
  | { code: "expected_without_due_date" };

/** One line of the policy's story (REQ-276). Signals are told as what was said, never as facts. */
export type PolicyHistoryEntry =
  | {
      kind: "expected" | "obligation" | "received" | "paid" | "other";
      at: string;
      eventId: string;
      eventType: string;
      amount: string;
      from: string | null;
      to: string | null;
      retracted: boolean;
      batchId?: string | null;
    }
  | { kind: "signal"; at: string; signalKind: SignalKind; recordedBy: string };

/** An expected commission still open with the paying side: insurer (block D) or health operator (§4.7). */
export interface InsurerReceivable {
  objectId: string;
  policyId: string | null;
  /** §4.7: the proposal and installment, when it came from the health system. */
  installment?: { proposalNumber: string; number: number } | null;
  openBalance: string | null;
  dueAt: string | null;
}

export interface CreditStep {
  objectId: string | null;
  amount: string;
  status: "accepted" | "rejected" | "awaiting_correction" | "not_sent";
  reason?: string;
}

export interface CreditResult {
  batchId: string;
  unattributed: string;
  steps: CreditStep[];
}

/** What the Ledger knows about one policy (§4.6, block C). Null parts are unknown, never zero. */
export interface PolicySituation {
  policyId: string;
  expected: { positionId: string; originated: string; received: string; open: string | null; dueAt: string | null } | null;
  obligation: { positionId: string; owed: string; paid: string; open: string | null; payee: string | null } | null;
  retained: string | null;
  notices: PolicyNotice[];
  actions: { kind: "receive" | "pay"; objectId: string; scenarioId: string }[];
  history: PolicyHistoryEntry[];
  partyNames: Record<string, string>;
}

export const signalsApi = {
  receivables: (payer: string) =>
    apiGet<{ receivables: InsurerReceivable[] } | { error: string }>(
      `/api/signals/credits/receivables?payer=${encodeURIComponent(payer)}`,
    ),
  registerCredit: (input: {
    payer: string;
    creditAmount: string;
    occurredAt: string;
    allocations: { objectId: string; amount: string }[];
    /** REQ-674: a key, or null for "não informada". */
    institution: string | null;
  }) => apiPost<CreditResult | { error: string }>("/api/signals/credits", input),
  situation: (policyId: string) =>
    apiGet<PolicySituation | { error: string }>(`/api/signals/policies/${encodeURIComponent(policyId)}`),
  /** One page, newest first. Pass the previous page's `nextCursor` as `before` to go on. */
  list: (options: { filter: SignalFilter; before?: string; limit?: number; system?: SignalSystem }) => {
    const params = new URLSearchParams({ filter: options.filter, limit: String(options.limit ?? SIGNALS_PAGE_SIZE) });
    if (options.before) params.set("before", options.before);
    if (options.system) params.set("system", options.system);
    return apiGet<SignalPage | { error: string }>(`/api/signals?${params}`);
  },
  openCount: (system?: SignalSystem) =>
    apiGet<{ count: number } | { error: string }>(`/api/signals/open-count${system ? `?system=${system}` : ""}`),
  /** REQ-286: "não há obrigação". Nothing goes to the Ledger; the decision is audited. */
  dismiss: (intentId: string) =>
    apiPost<{ intentId: string; status: "dismissed"; dismissedBy: string; dismissedAt: string } | { error: string }>(
      `/api/signals/proposals/${encodeURIComponent(intentId)}/dismiss`,
      {},
    ),
  register: (kind: SignalKind, fields: Record<string, string>) =>
    apiPost<{ signal: SignalView; proposals: SignalProposal[] } | { error: string }>("/api/signals", { kind, fields }),
  /** Where the proposal's conversation stands, without answering anything. */
  state: (intentId: string) =>
    apiPost<{ state: DialogState } | { error: string }>(`/api/conversation/${encodeURIComponent(intentId)}/apply`, {
      answers: [],
    }),
};
