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

interface Refusal {
  error: string;
}

export const partiesApi = {
  pending: () => apiGet<{ pending: PendingIdentity[] }>("/api/parties/pending"),
  list: () => apiGet<{ parties: RegisteredParty[] }>("/api/parties"),
  names: () => apiGet<{ parties: PartyName[] }>("/api/parties/names"),
  events: (partyId: string) => apiGet<PartyEventsResult>(`/api/parties/${encodeURIComponent(partyId)}/events`),
  register: (input: RegisterPartyInput) => apiPost<{ partyId: string } | Refusal>("/api/parties", input),
  link: (identifier: string, partyId: string) =>
    apiPost<{ link: unknown } | Refusal>("/api/parties/links", { identifier, partyId }),
};
