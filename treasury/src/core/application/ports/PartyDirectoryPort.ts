import type { Party } from "../../domain/entities/Party";
import type { Resolution, ResolutionQuery } from "../../domain/services/PartyResolution";

/**
 * The boundary behind which the Party Directory lives — the Treasury's owner of operational
 * identity. Only `partyId` ever crosses into the Ledger; everything the Directory holds stays here.
 *
 * Read-only, deliberately. Issuing a PartyId is an explicit act, with its own use cases.
 */
export interface PartyDirectoryPort {
  /** Run the deterministic cascade against the directory. Never creates anything. */
  resolve(query: ResolutionQuery): Promise<Resolution>;

  /** Fetch one party by its canonical id. Absent = the id is not known here, which is a valid answer. */
  get(partyId: string): Promise<Party | undefined>;

  /** Every party the directory holds. Used for grounding context and for measurement. */
  list(): Promise<Party[]>;

  /** Every identifier that means this party, for reading what the Ledger recorded under each (REQ-332). */
  identifiersOf(partyId: string): Promise<string[]>;
}
