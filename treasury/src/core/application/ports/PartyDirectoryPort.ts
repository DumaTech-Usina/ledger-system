import type { Party } from "../../domain/entities/Party";
import type { Resolution, ResolutionQuery } from "../../domain/services/PartyResolution";

/**
 * The boundary behind which the Party Directory lives — the Treasury's owner of operational
 * identity. Only `partyId` ever crosses into the Ledger; everything the Directory holds stays here.
 *
 * Read-only for now, deliberately. Issuing a PartyId is an explicit decision (associate, create, or
 * declare not identifiable) and belongs to the phase that introduces those decisions; declaring the
 * write surface before it can be honoured would put an unfulfillable contract in the codebase.
 */
export interface PartyDirectoryPort {
  /** Run the deterministic cascade against the directory. Never creates anything. */
  resolve(query: ResolutionQuery): Promise<Resolution>;

  /** Fetch one party by its canonical id. Absent = the id is not known here, which is a valid answer. */
  get(partyId: string): Promise<Party | undefined>;

  /** Every party the directory holds. Used for grounding context and for measurement. */
  list(): Promise<Party[]>;
}
