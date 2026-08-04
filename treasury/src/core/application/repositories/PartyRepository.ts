import type { Party } from "../../domain/entities/Party";

/**
 * Persistence boundary for the Party Directory. In-memory for now; the durable adapter arrives in
 * its own phase, and it is a gate: a PartyId that reaches an immutable event must never be lost.
 */
export interface PartyRepository {
  save(party: Party): Promise<void>;
  findById(partyId: string): Promise<Party | null>;
  findAll(): Promise<Party[]>;
}
