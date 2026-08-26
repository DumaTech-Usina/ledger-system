import { apiGet, apiPost } from "@/api/client";

export interface PartySummary {
  partyId: string;
  displayName: string;
  document?: string;
}

export interface ListPartiesResult {
  parties: PartySummary[];
}

export interface RenamePartyResult {
  partyId: string;
  displayName: string;
}

/** A rejected rename (blank name, unknown party) answers 422 with this body — the user's to fix. */
interface ApiErrorBody {
  error: string;
}

export const partiesApi = {
  /** Every registered counterparty — never the usina's own party record. */
  list: () => apiGet<ListPartiesResult>("/api/parties"),
  rename: (partyId: string, displayName: string) =>
    apiPost<RenamePartyResult | ApiErrorBody>(`/api/parties/${encodeURIComponent(partyId)}/rename`, {
      displayName,
    }),
};
