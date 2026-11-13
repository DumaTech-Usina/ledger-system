import { apiGet, apiPost } from "@/api/client";

export interface PendingIdentity {
  partyId: string;
  displayName: string;
  kind: "provisional" | "unidentifiable";
  createdAt?: string;
}

export interface RegisteredParty {
  partyId: string;
  displayName: string;
  kind: string | null;
  document: string | null;
  /** Null when not known: a party loaded from elsewhere may not say. */
  hasBankAccount: boolean | null;
}

export interface RegisterPartyInput {
  displayName: string;
  kind: "person" | "company";
  hasBankAccount: boolean;
  document: string;
}

export interface PartyName {
  partyId: string;
  displayName: string;
  state: string;
}

export interface PartyEventView {
  eventId: string;
  eventType: string;
  economicEffect: string;
  amount: string;
  currency: string;
  occurredAt: string;
  recordedAt: string;
  description: string | null;
  retracted: boolean;
  parties: { partyId: string; role: string; direction: string; amount: string | null }[];
  roles: { role: string; direction: string; recordedAs: string }[];
}

export type PartyEventsResult =
  | {
      available: true;
      party: { partyId: string; displayName: string };
      identifiers: string[];
      events: PartyEventView[];
      partyNames: Record<string, string>;
    }
  | { available: false; party: { partyId: string; displayName: string } };

/** §8.4 — one open position of the party, as the server read it from the Ledger. */
export interface PageLine {
  objectId: string;
  objectType: string;
  status: string;
  openBalance: string | null;
  totalOriginated: string;
  originatedAt: string | null;
  dueAt: string | null;
  /** Null when the origination date is unknown, never zero. */
  ageDays: number | null;
  contexts: string[];
  dependsOn: {
    objectId: string;
    objectType: string;
    payerId: string | null;
    payerName: string | null;
    openBalance: string | null;
    totalSettled: string;
    context: string;
  }[];
}

export type PageAlert =
  | { code: "paid_without_obligation"; objectId: string }
  | { code: "provisional_identity" }
  | { code: "obligation_overdue"; objectId: string; dueAt: string };

/** Who recorded something: a user of Treasury or an external system. */
export interface Author {
  type: string;
  id: string;
  name: string | null;
}

export type HistoryFact = PartyEventView & {
  kind: "fact";
  source?: { system: string; reference: string };
  objects?: { objectId: string; objectType: string; relation: string }[];
  /** Null when the Ledger did not say who recorded it. */
  reporter: Author | null;
  /** Null when the fact stands. */
  retractedBy: { eventId: string; occurredAt: string; recordedAt: string; reporter: Author | null } | null;
};

export interface PendingSignal {
  kind: "signal";
  signalId: string;
  receivedAt: string;
  signalKind: string;
  recordId: string;
  proposals: { fact: string; intentId: string; intentStatus: string | null }[];
}

export type HistoryEntry = HistoryFact | PendingSignal;

export interface HistoryQuery {
  page: number;
  limit: number;
  sortOrder: "ASC" | "DESC";
  from: string;
  to: string;
  eventType: string[];
  reporter: string[];
  status: "all" | "standing" | "retracted";
}

export interface HistoryPageInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  facets: { eventTypes: string[]; reporters: Author[] };
}

export type HistoryResult = ({ available: true; entries: HistoryFact[] } & HistoryPageInfo) | { available: false };

export interface PartyHeader {
  partyId: string;
  displayName: string;
  provisional?: boolean;
}

export type Side = "usinaOwes" | "partyOwes" | "unclassified";

/** The Ledger's count and paging of one side. A count, never a sum. */
export interface SidePageInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SideQuery {
  page: number;
  limit: number;
  sortBy: "createdAt" | "dueAt";
  sortOrder: "ASC" | "DESC";
  objectType: string[];
  from: string;
  to: string;
}

export type SideResult = ({ available: true; side: Side; lines: PageLine[] } & SidePageInfo) | { available: false };

export type PartyPageResult =
  | {
      available: true;
      party: PartyHeader;
      identifiers: string[];
      operation: {
        usinaOwes: PageLine[];
        partyOwes: PageLine[];
        unclassified: PageLine[];
        pages: Record<Side, SidePageInfo>;
        kinds: Record<Side, string[]>;
      };
      alerts: PageAlert[];
      alertsPartial?: boolean;
      receivesAlsoThrough: { partyId: string; displayName: string }[];
      history: HistoryFact[];
      historyPage: HistoryPageInfo;
      pendingSignals: PendingSignal[];
      partyNames: Record<string, string>;
    }
  | { available: false; party: PartyHeader };

interface Refusal {
  error: string;
}

export const partiesApi = {
  pending: () => apiGet<{ pending: PendingIdentity[] }>("/api/parties/pending"),
  list: () => apiGet<{ parties: RegisteredParty[] }>("/api/parties"),
  names: () => apiGet<{ parties: PartyName[] }>("/api/parties/names"),
  events: (partyId: string) => apiGet<PartyEventsResult>(`/api/parties/${encodeURIComponent(partyId)}/events`),
  page: (partyId: string) => apiGet<PartyPageResult>(`/api/parties/${encodeURIComponent(partyId)}/page`),
  history: (partyId: string, q: HistoryQuery) => {
    const params = new URLSearchParams({ page: String(q.page), limit: String(q.limit), sortOrder: q.sortOrder, status: q.status });
    if (q.eventType.length) params.set("eventType", q.eventType.join(","));
    if (q.reporter.length) params.set("reporter", q.reporter.join(","));
    if (q.from) params.set("from", q.from);
    if (q.to) params.set("to", q.to);
    return apiGet<HistoryResult>(`/api/parties/${encodeURIComponent(partyId)}/history?${params}`);
  },
  side: (partyId: string, side: Side, q: SideQuery) => {
    const params = new URLSearchParams({ page: String(q.page), limit: String(q.limit), sortBy: q.sortBy, sortOrder: q.sortOrder });
    if (q.objectType.length) params.set("objectType", q.objectType.join(","));
    if (q.from) params.set("from", q.from);
    if (q.to) params.set("to", q.to);
    return apiGet<SideResult>(`/api/parties/${encodeURIComponent(partyId)}/positions/${side}?${params}`);
  },
  register: (input: RegisterPartyInput) => apiPost<{ partyId: string } | Refusal>("/api/parties", input),
  link: (identifier: string, partyId: string) =>
    apiPost<{ link: unknown } | Refusal>("/api/parties/links", { identifier, partyId }),
};
