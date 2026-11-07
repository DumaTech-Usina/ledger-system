import type { PartyEvent } from "../dtos/LedgerReadModels";

/** Read-only: the events the Ledger recorded under one identifier, in any role. */
export interface PartyEventsPort {
  eventsOfParty(identifier: string): Promise<PartyEvent[]>;
}
