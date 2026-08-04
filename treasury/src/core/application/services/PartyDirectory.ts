import type { Party } from "../../domain/entities/Party";
import { resolveParty, type Resolution, type ResolutionQuery } from "../../domain/services/PartyResolution";
import type { PartyDirectoryPort } from "../ports/PartyDirectoryPort";
import type { PartyRepository } from "../repositories/PartyRepository";

/**
 * The Party Directory: the stored parties plus the deterministic cascade over them. It reads and
 * resolves; it never creates. Issuing a PartyId is an explicit decision and lives elsewhere.
 */
export class PartyDirectory implements PartyDirectoryPort {
  constructor(
    private readonly repo: PartyRepository,
    /** Omitted uses the cascade's conservative default. */
    private readonly threshold?: number,
  ) {}

  async resolve(query: ResolutionQuery): Promise<Resolution> {
    return resolveParty(query, await this.repo.findAll(), this.threshold);
  }

  async get(partyId: string): Promise<Party | undefined> {
    return (await this.repo.findById(partyId)) ?? undefined;
  }

  async list(): Promise<Party[]> {
    return this.repo.findAll();
  }
}
